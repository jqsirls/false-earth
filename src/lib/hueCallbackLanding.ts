import {
  HUE_OAUTH_MESSAGE_TYPE,
  storeHueCallbackHandoff,
  type HueOAuthMessage,
} from './hueOAuth';

/**
 * Philips Hue OAuth popup landing.
 *
 * The Hue callback redirects the popup to booster.storytailor.com with
 * `hue_status=oauth_complete&code=...`. When that page was opened as a popup
 * (or iOS new tab) from the meadow, we must NOT boot the 3D scene here:
 * relay the params to the opener via postMessage (fast path) + a same-origin
 * localStorage handoff (reliable path), show a one-line confirmation, and
 * close ourselves.
 *
 * Returns true when this window handled the callback as a popup landing and
 * the normal app bootstrap must be skipped.
 */
export function maybeRenderHueCallbackLanding(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('hue_status') !== 'oauth_complete') return false;

  const code = params.get('code') ?? params.get('hue_code');
  if (!code) return false;

  const opener = window.opener as Window | null;
  const isPopup = Boolean(opener) && opener !== window;
  if (!isPopup) {
    // Full-redirect fallback in the main window — boot the meadow normally;
    // HueOAuthHandler picks the params up from the URL.
    return false;
  }

  const state = params.get('hue_state') ?? params.get('state') ?? undefined;

  // Reliable same-origin handoff first (survives a lost postMessage).
  storeHueCallbackHandoff({ code, state });

  const message: HueOAuthMessage = { type: HUE_OAUTH_MESSAGE_TYPE, code, state };
  try {
    opener?.postMessage(message, window.location.origin);
  } catch {
    // Opener navigated away or is gone — the localStorage handoff covers us.
  }

  renderLanding();

  // Popup windows close themselves; iOS "popup became a tab" may refuse —
  // the manual hint stays visible in that case.
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      // Ignored — manual close hint is already on screen.
    }
  }, 1400);

  return true;
}

function renderLanding(): void {
  document.title = 'Lights connected — Booster\u2019s Meadow';
  const root = document.querySelector('#root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0d14;color:#f2f5fa;font-family:Cousine,monospace;text-align:center;">
      <div style="max-width:420px;">
        <p style="margin:0 0 10px;font-size:0.7rem;letter-spacing:0.14em;opacity:0.6;">BOOSTER'S MEADOW</p>
        <p style="margin:0 0 12px;font-size:0.9rem;letter-spacing:0.04em;">Lights connected, you can close this window.</p>
        <p style="margin:0;font-size:0.7rem;letter-spacing:0.04em;opacity:0.55;">If it does not close by itself, close this tab to return to the meadow.</p>
      </div>
    </div>
  `;
}
