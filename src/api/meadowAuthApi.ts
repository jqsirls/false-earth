import { MEADOW_AUTH_URL } from '../config/meadow';

export interface MeadowSession {
  userId: string;
  email: string;
  memberstackId?: string;
}

export type MeadowAuthResult =
  | { ok: true; session: MeadowSession }
  | { ok: false; message: string };

export type MeadowOtpSendResult = { ok: true } | { ok: false; message: string };

const MOCK_SESSION_KEY = 'meadow_auth_mock_session';
const MOCK_PENDING_EMAIL_KEY = 'meadow_auth_mock_pending_email';

function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('meadow-auth-mock');
}

function readMockSession(): MeadowSession | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(MOCK_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MeadowSession;
  } catch {
    return null;
  }
}

function writeMockSession(session: MeadowSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    sessionStorage.removeItem(MOCK_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
}

function notReady(): MeadowOtpSendResult {
  return { ok: false, message: "Account connection isn't ready yet" };
}

function mockSessionForEmail(email: string): MeadowSession {
  return {
    userId: `mock-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    email,
    memberstackId: `ms_mock_${Date.now()}`,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

async function postAuth<T extends MeadowOtpSendResult | MeadowAuthResult>(
  body: Record<string, string>,
): Promise<T> {
  if (!MEADOW_AUTH_URL) {
    return notReady() as T;
  }

  try {
    const response = await fetch(MEADOW_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      session?: MeadowSession;
      ok?: boolean;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        message:
          payload.message ??
          payload.error ??
          'We could not complete that request right now. Please try again.',
      } as T;
    }

    if (body.action === 'verifyOtp') {
      if (!payload.session) {
        return {
          ok: false,
          message: payload.message ?? 'That code did not match. Try again or resend.',
        } as T;
      }
      return { ok: true, session: payload.session } as T;
    }

    return { ok: true } as T;
  } catch {
    return {
      ok: false,
      message: 'We could not reach the account service. Check your connection and try again.',
    } as T;
  }
}

export async function sendOtp(email: string): Promise<MeadowOtpSendResult> {
  const trimmed = email.trim();

  if (!isValidEmail(trimmed)) {
    return { ok: false, message: 'Enter a valid email address.' };
  }

  if (isMockMode()) {
    sessionStorage.setItem(MOCK_PENDING_EMAIL_KEY, trimmed);
    return { ok: true };
  }

  return postAuth({ action: 'sendOtp', email: trimmed });
}

export async function verifyOtp(email: string, code: string): Promise<MeadowAuthResult> {
  const trimmedEmail = email.trim();
  const trimmedCode = code.trim();

  if (!isValidEmail(trimmedEmail)) {
    return { ok: false, message: 'Enter a valid email address.' };
  }

  if (!isValidOtpCode(trimmedCode)) {
    return { ok: false, message: 'Enter the 6-digit code from your email.' };
  }

  if (isMockMode()) {
    const pending = sessionStorage.getItem(MOCK_PENDING_EMAIL_KEY);
    if (pending && pending !== trimmedEmail) {
      return { ok: false, message: 'That code did not match. Try again or resend.' };
    }
    const session = mockSessionForEmail(trimmedEmail);
    writeMockSession(session);
    sessionStorage.removeItem(MOCK_PENDING_EMAIL_KEY);
    return { ok: true, session };
  }

  return postAuth({ action: 'verifyOtp', email: trimmedEmail, code: trimmedCode });
}

export async function signOut(): Promise<void> {
  if (isMockMode()) {
    writeMockSession(null);
    sessionStorage.removeItem(MOCK_PENDING_EMAIL_KEY);
    return;
  }

  if (!MEADOW_AUTH_URL) return;

  try {
    await fetch(MEADOW_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'signOut' }),
    });
  } catch {
    // Best-effort sign-out — local session is cleared by the store.
  }
}

export async function getSession(): Promise<MeadowSession | null> {
  if (isMockMode()) {
    return readMockSession();
  }

  if (!MEADOW_AUTH_URL) {
    return null;
  }

  try {
    const response = await fetch(`${MEADOW_AUTH_URL}?action=getSession`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { session?: MeadowSession | null };
    return payload.session ?? null;
  } catch {
    return null;
  }
}
