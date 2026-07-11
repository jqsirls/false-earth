const PENDING_CODE_KEY = 'meadow.huePendingCode';
const PENDING_STATE_KEY = 'meadow.huePendingState';
const CALLBACK_HANDOFF_KEY = 'meadow.hueCallbackHandoff';
const CALLBACK_HANDOFF_TTL_MS = 10 * 60 * 1000;

/** postMessage type used by the popup callback landing → opener handoff. */
export const HUE_OAUTH_MESSAGE_TYPE = 'meadow:hue-oauth';

export type HueOAuthMessage = {
  type: typeof HUE_OAUTH_MESSAGE_TYPE;
  code: string;
  state?: string;
};

export type PendingHueOAuth = {
  code: string;
  state?: string;
};

export function storePendingHueOAuth(payload: PendingHueOAuth): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_CODE_KEY, payload.code);
  if (payload.state) {
    window.sessionStorage.setItem(PENDING_STATE_KEY, payload.state);
  }
}

export function readPendingHueOAuth(): PendingHueOAuth | null {
  if (typeof window === 'undefined') return null;
  const code = window.sessionStorage.getItem(PENDING_CODE_KEY);
  if (!code) return null;
  const state = window.sessionStorage.getItem(PENDING_STATE_KEY) ?? undefined;
  return { code, state };
}

export function clearPendingHueOAuth(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_CODE_KEY);
  window.sessionStorage.removeItem(PENDING_STATE_KEY);
}

export function clearHueOAuthQueryParams(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('hue_status');
  url.searchParams.delete('hue_state');
  url.searchParams.delete('code');
  url.searchParams.delete('hue_code');
  url.searchParams.delete('state');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function readHueOAuthFromUrl(): PendingHueOAuth | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('hue_status') !== 'oauth_complete') return null;
  const code = params.get('code') ?? params.get('hue_code');
  if (!code) return null;
  return {
    code,
    state: params.get('hue_state') ?? params.get('state') ?? undefined,
  };
}

export function isHueOAuthMessage(data: unknown): data is HueOAuthMessage {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return (
    record.type === HUE_OAUTH_MESSAGE_TYPE &&
    typeof record.code === 'string' &&
    record.code.length > 0
  );
}

/**
 * Same-origin fallback handoff: the popup writes the callback params to
 * localStorage so the main meadow tab can pick them up even if the
 * postMessage was lost (opener gone, tab reopened, iOS new-tab flow).
 */
export function storeHueCallbackHandoff(payload: PendingHueOAuth): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CALLBACK_HANDOFF_KEY,
      JSON.stringify({ ...payload, at: Date.now() }),
    );
  } catch {
    // Storage full/blocked — postMessage and getStatus polling still cover us.
  }
}

export function takeHueCallbackHandoff(): PendingHueOAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CALLBACK_HANDOFF_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(CALLBACK_HANDOFF_KEY);
    const parsed = JSON.parse(raw) as { code?: string; state?: string; at?: number };
    if (!parsed.code) return null;
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > CALLBACK_HANDOFF_TTL_MS) {
      return null;
    }
    return { code: parsed.code, state: parsed.state };
  } catch {
    return null;
  }
}

export function storeHueConnectState(state: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_STATE_KEY, state);
}

export function readHueConnectState(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PENDING_STATE_KEY);
}

export function clearHueConnectState(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_STATE_KEY);
}
