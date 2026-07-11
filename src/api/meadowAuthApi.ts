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

export type MeadowProfileStatus =
  | { complete: true }
  | {
      complete: false;
      requiredFields: string[];
      prefill: { firstName?: string; lastName?: string };
    };

export type MeadowProfileStatusResult =
  | { ok: true; status: MeadowProfileStatus }
  | { ok: false; message: string };

export type MeadowCompleteProfileInput = {
  firstName: string;
  lastName?: string;
  birthday: string;
  userType: string;
};

export type MeadowCompleteProfileResult = { ok: true } | { ok: false; message: string };

/** Path A BA-019 adult-only userType enum (AuthRoutes ADULT_USER_TYPES). */
export const MEADOW_USER_TYPE_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'aunt_uncle', label: 'Aunt / Uncle' },
  { value: 'older_sibling', label: 'Older sibling' },
  { value: 'foster_caregiver', label: 'Foster caregiver' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'afterschool_leader', label: 'After-school leader' },
  { value: 'childcare_provider', label: 'Childcare provider' },
  { value: 'nanny', label: 'Nanny' },
  { value: 'child_life_specialist', label: 'Child life specialist' },
  { value: 'therapist', label: 'Therapist' },
  { value: 'medical_professional', label: 'Medical professional' },
  { value: 'coach_mentor', label: 'Coach / Mentor' },
  { value: 'enthusiast', label: 'Enthusiast' },
  { value: 'other', label: 'Other' },
] as const;

const MOCK_SESSION_KEY = 'meadow_auth_mock_session';
const MOCK_PENDING_EMAIL_KEY = 'meadow_auth_mock_pending_email';
const MOCK_PROFILE_COMPLETE_KEY = 'meadow_auth_mock_profile_complete';
const MOCK_PROFILE_PREFILL_KEY = 'meadow_auth_mock_profile_prefill';

/** Client-held tokens — required because cross-origin HttpOnly cookies from supabase.co are blocked. */
const CLIENT_TOKENS_KEY = 'meadow_sb_tokens';

type ClientTokens = {
  access_token: string;
  refresh_token: string;
};

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
    sessionStorage.removeItem(MOCK_PROFILE_COMPLETE_KEY);
    sessionStorage.removeItem(MOCK_PROFILE_PREFILL_KEY);
    return;
  }
  sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
}

export function readClientTokens(): ClientTokens | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(CLIENT_TOKENS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ClientTokens;
    if (!parsed.access_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token ?? '',
    };
  } catch {
    return null;
  }
}

function writeClientTokens(tokens: ClientTokens | null): void {
  if (typeof window === 'undefined') return;
  if (!tokens?.access_token) {
    sessionStorage.removeItem(CLIENT_TOKENS_KEY);
    return;
  }
  sessionStorage.setItem(CLIENT_TOKENS_KEY, JSON.stringify(tokens));
}

/** Authorization header for meadow-auth / meadow-hue when cookie session is unavailable. */
export function meadowAuthHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  };
  const tokens = readClientTokens();
  if (tokens?.access_token) {
    headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return headers;
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
      headers: meadowAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      session?: MeadowSession;
      tokens?: { access_token?: string; refresh_token?: string };
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
      if (payload.tokens?.access_token) {
        writeClientTokens({
          access_token: payload.tokens.access_token,
          refresh_token: payload.tokens.refresh_token ?? '',
        });
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
    // Mock: code must be 000000
    if (trimmedCode !== '000000') {
      return { ok: false, message: 'That code did not match. Try again or resend.' };
    }
    const session = mockSessionForEmail(trimmedEmail);
    writeMockSession(session);
    sessionStorage.setItem(MOCK_PROFILE_COMPLETE_KEY, '0');
    // Prefill names for "existing member" simulation when email contains "member"
    if (/member/i.test(trimmedEmail)) {
      sessionStorage.setItem(
        MOCK_PROFILE_PREFILL_KEY,
        JSON.stringify({ firstName: 'Jordan', lastName: 'Lee' }),
      );
    } else {
      sessionStorage.removeItem(MOCK_PROFILE_PREFILL_KEY);
    }
    sessionStorage.removeItem(MOCK_PENDING_EMAIL_KEY);
    return { ok: true, session };
  }

  return postAuth({ action: 'verifyOtp', email: trimmedEmail, code: trimmedCode });
}

export async function getProfileStatus(): Promise<MeadowProfileStatusResult> {
  if (isMockMode()) {
    if (!readMockSession()) {
      return { ok: false, message: 'Sign in again to continue.' };
    }
    if (sessionStorage.getItem(MOCK_PROFILE_COMPLETE_KEY) === '1') {
      return { ok: true, status: { complete: true } };
    }
    let prefill: { firstName?: string; lastName?: string } = {};
    try {
      const raw = sessionStorage.getItem(MOCK_PROFILE_PREFILL_KEY);
      if (raw) prefill = JSON.parse(raw) as { firstName?: string; lastName?: string };
    } catch {
      prefill = {};
    }
    return {
      ok: true,
      status: {
        complete: false,
        requiredFields: ['userType', 'firstName', 'ageVerification'],
        prefill,
      },
    };
  }

  if (!MEADOW_AUTH_URL) {
    return { ok: false, message: "Account connection isn't ready yet" };
  }

  try {
    const response = await fetch(MEADOW_AUTH_URL, {
      method: 'POST',
      headers: meadowAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ action: 'profileStatus' }),
    });

    const payload = (await response.json()) as {
      complete?: boolean;
      requiredFields?: string[];
      prefill?: { firstName?: string; lastName?: string };
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message ?? 'We could not check your profile right now.',
      };
    }

    if (payload.complete === true) {
      return { ok: true, status: { complete: true } };
    }

    return {
      ok: true,
      status: {
        complete: false,
        requiredFields: payload.requiredFields ?? ['userType', 'firstName', 'ageVerification'],
        prefill: payload.prefill ?? {},
      },
    };
  } catch {
    return {
      ok: false,
      message: 'We could not reach the account service. Check your connection and try again.',
    };
  }
}

export async function completeProfile(
  input: MeadowCompleteProfileInput,
): Promise<MeadowCompleteProfileResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName?.trim() ?? '';
  const birthday = input.birthday.trim();
  const userType = input.userType.trim();

  if (!firstName) {
    return { ok: false, message: 'Enter your first name.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return { ok: false, message: 'Enter a valid birthday.' };
  }
  if (!MEADOW_USER_TYPE_OPTIONS.some((option) => option.value === userType)) {
    return { ok: false, message: 'Choose how you use Storytailor.' };
  }

  if (isMockMode()) {
    if (!readMockSession()) {
      return { ok: false, message: 'Sign in again to continue.' };
    }
    sessionStorage.setItem(MOCK_PROFILE_COMPLETE_KEY, '1');
    return { ok: true };
  }

  if (!MEADOW_AUTH_URL) {
    return { ok: false, message: "Account connection isn't ready yet" };
  }

  try {
    const response = await fetch(MEADOW_AUTH_URL, {
      method: 'POST',
      headers: meadowAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        action: 'completeProfile',
        firstName,
        lastName,
        birthday,
        userType,
      }),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || payload.ok === false) {
      return {
        ok: false,
        message: payload.message ?? 'We could not save your details right now. Please try again.',
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'We could not reach the account service. Check your connection and try again.',
    };
  }
}

export async function signOut(): Promise<void> {
  if (isMockMode()) {
    writeMockSession(null);
    sessionStorage.removeItem(MOCK_PENDING_EMAIL_KEY);
    return;
  }

  writeClientTokens(null);

  if (!MEADOW_AUTH_URL) return;

  try {
    await fetch(MEADOW_AUTH_URL, {
      method: 'POST',
      headers: meadowAuthHeaders(),
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
      headers: meadowAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { session?: MeadowSession | null };
    return payload.session ?? null;
  } catch {
    return null;
  }
}
