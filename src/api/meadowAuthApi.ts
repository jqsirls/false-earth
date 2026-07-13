import { MEADOW_AUTH_URL } from '../config/meadow';

export interface MeadowSession {
  userId: string;
  email: string;
  memberstackId?: string;
  /** Account-level "met The Void" marker (auth user_metadata) — cross-device switcher availability. */
  meadowMetVoid?: boolean;
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

/** Refresh proactively when the access token is within this margin of expiry. */
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

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

function parseTokens(raw: string | null): ClientTokens | null {
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

/**
 * Persistent session lives in localStorage so sign-in survives tab close and
 * revisits. Legacy sessionStorage tokens (pre-persistence) migrate on read.
 */
export function readClientTokens(): ClientTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const persisted = parseTokens(localStorage.getItem(CLIENT_TOKENS_KEY));
    if (persisted) return persisted;

    const legacy = parseTokens(sessionStorage.getItem(CLIENT_TOKENS_KEY));
    if (legacy) {
      writeClientTokens(legacy);
      sessionStorage.removeItem(CLIENT_TOKENS_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

function writeClientTokens(tokens: ClientTokens | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!tokens?.access_token) {
      localStorage.removeItem(CLIENT_TOKENS_KEY);
      sessionStorage.removeItem(CLIENT_TOKENS_KEY);
      return;
    }
    localStorage.setItem(CLIENT_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Storage blocked (private mode edge cases) — session degrades to in-memory.
  }
}

/** Epoch ms expiry from the access token JWT payload; null when undecodable. */
function accessTokenExpiryMs(accessToken: string): number | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the stored refresh token for a new pair via the meadow-auth proxy.
 * Concurrent callers share one in-flight refresh. On a definitive rejection
 * (401) the session is cleared so the UI shows the signed-out state quietly.
 */
export async function refreshClientTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const tokens = readClientTokens();
    if (!tokens?.refresh_token || !MEADOW_AUTH_URL) return false;

    try {
      const response = await fetch(MEADOW_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'refresh', refresh_token: tokens.refresh_token }),
      });

      if (response.status === 401) {
        writeClientTokens(null);
        return false;
      }
      if (!response.ok) {
        // Transient failure (network/5xx): keep tokens for a later retry.
        return false;
      }

      const payload = (await response.json()) as {
        tokens?: { access_token?: string; refresh_token?: string };
      };
      if (!payload.tokens?.access_token) return false;

      writeClientTokens({
        access_token: payload.tokens.access_token,
        refresh_token: payload.tokens.refresh_token ?? tokens.refresh_token,
      });
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/** Proactively refresh when the access token is missing/near expiry. */
export async function ensureFreshTokens(): Promise<void> {
  const tokens = readClientTokens();
  if (!tokens?.access_token || !tokens.refresh_token) return;
  const expiry = accessTokenExpiryMs(tokens.access_token);
  if (expiry !== null && expiry - Date.now() > REFRESH_MARGIN_MS) return;
  await refreshClientTokens();
}

/**
 * Authenticated fetch for meadow services: refreshes ahead of expiry, and on a
 * 401 attempts one refresh + retry before surfacing the response.
 */
export async function meadowAuthedFetch(
  input: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> },
): Promise<Response> {
  await ensureFreshTokens();

  const doFetch = () =>
    fetch(input, {
      ...init,
      credentials: 'include',
      headers: meadowAuthHeaders(init.headers),
    });

  const response = await doFetch();
  if (response.status !== 401 || !readClientTokens()?.refresh_token) {
    return response;
  }

  const refreshed = await refreshClientTokens();
  if (!refreshed) return response;
  return doFetch();
}

/**
 * Story handoff — carries the signed-in meadow user toward the Storytailor app
 * (v3/app hosts) via a short-lived root-domain cookie holding `userId.nonce`
 * (never tokens). The app exchanges it once for a fresh session pair.
 */
const HANDOFF_COOKIE = 'st_meadow_handoff';
const HANDOFF_COOKIE_MAX_AGE_S = 5 * 60;

function onStorytailorDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return /(?:^|\.)storytailor\.com$/i.test(window.location.hostname);
}

function clearStoryHandoffCookie(): void {
  if (!onStorytailorDomain() || typeof document === 'undefined') return;
  document.cookie = `${HANDOFF_COOKIE}=; Domain=.storytailor.com; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

/** Mint (or renew) the handoff cookie. Best-effort, fire-and-forget safe. */
export async function mintStoryHandoff(): Promise<void> {
  if (isMockMode() || !MEADOW_AUTH_URL || !onStorytailorDomain()) return;
  if (!readClientTokens()?.access_token) return;

  try {
    const response = await meadowAuthedFetch(MEADOW_AUTH_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'mintHandoff' }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { ok?: boolean; handoff?: string };
    if (!payload.ok || !payload.handoff) return;
    document.cookie = `${HANDOFF_COOKIE}=${encodeURIComponent(payload.handoff)}; Domain=.storytailor.com; Path=/; Max-Age=${HANDOFF_COOKIE_MAX_AGE_S}; Secure; SameSite=Lax`;
  } catch {
    // Handoff is progressive enhancement — the app still offers normal sign-in.
  }
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
    const response = await meadowAuthedFetch(MEADOW_AUTH_URL, {
      method: 'POST',
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
    const response = await meadowAuthedFetch(MEADOW_AUTH_URL, {
      method: 'POST',
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

/**
 * Push the "met The Void" flag to the signed-in account (user_metadata via
 * meadow-auth `meadowFlags`). Merge-only — the server never clears it, and the
 * local flag is never cleared either. Best-effort, fire-and-forget safe:
 * character access is NEVER auth-gated (owner law), this only syncs
 * availability across devices.
 */
export async function pushMeadowMetVoidFlag(): Promise<void> {
  if (isMockMode() || !MEADOW_AUTH_URL) return;
  if (!readClientTokens()?.access_token) return;

  try {
    await meadowAuthedFetch(MEADOW_AUTH_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'meadowFlags', set: { meadow_met_void: true } }),
    });
  } catch {
    // Best-effort — localStorage remains the local source of truth.
  }
}

export async function signOut(): Promise<void> {
  if (isMockMode()) {
    writeMockSession(null);
    sessionStorage.removeItem(MOCK_PENDING_EMAIL_KEY);
    return;
  }

  writeClientTokens(null);
  clearStoryHandoffCookie();

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
    const response = await meadowAuthedFetch(`${MEADOW_AUTH_URL}?action=getSession`, {
      method: 'GET',
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { session?: MeadowSession | null };
    return payload.session ?? null;
  } catch {
    return null;
  }
}
