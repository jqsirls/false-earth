/**
 * Playable-character identity + initial selection — LOCAL/DEV ONLY until the
 * owner approves The Void for production.
 *
 * Initial resolution order: `?character=void` URL param (testing override) →
 * persisted choice in localStorage → Booster (JQ). A fresh visitor with no
 * param and no persisted choice gets the shipped Booster experience.
 *
 * Live in-session switching is owned by meadowCharacterStore; this module only
 * resolves the STARTING character (also used for module-scope asset preload).
 *
 * NOTE (owner decision): character access is NEVER auth-gated. Void discovery
 * is intentional About-modal easter egg only — no main-window switcher.
 */
export type MeadowCharacterId = 'jq' | 'void';

export const MEADOW_CHARACTER_STORAGE_KEY = 'meadow_character';

/** Set when the visitor has ever switched via About (account sync + history). */
export const MEADOW_SWITCHER_SEEN_STORAGE_KEY = 'meadow_switcher_seen';

/** Display names in the HUD idiom (Cousine, uppercase). */
export const MEADOW_CHARACTER_NAMES: Record<MeadowCharacterId, string> = {
  jq: 'BOOSTER STARLING',
  void: 'THE VOID',
};

/** About-modal inline action labels (owner copy — Booster short form). */
export const MEADOW_CHARACTER_PLAY_LABELS: Record<MeadowCharacterId, string> = {
  jq: 'PLAY WITH BOOSTER',
  void: 'PLAY WITH THE VOID',
};

/** Top-strip story CTA (title case; MeadowCta CSS uppercases to HUD idiom). */
export const MEADOW_CHARACTER_CTA_LABELS: Record<MeadowCharacterId, string> = {
  jq: 'Make a story with Booster',
  void: 'Make a story with The Void',
};

export function otherMeadowCharacter(id: MeadowCharacterId): MeadowCharacterId {
  return id === 'jq' ? 'void' : 'jq';
}

function readStoredCharacter(): MeadowCharacterId | null {
  try {
    const stored = window.localStorage.getItem(MEADOW_CHARACTER_STORAGE_KEY);
    return stored === 'void' || stored === 'jq' ? stored : null;
  } catch {
    return null;
  }
}

/** Starting character for this page load (param override → persisted → JQ). */
export function getActiveMeadowCharacter(): MeadowCharacterId {
  if (typeof window === 'undefined') return 'jq';
  const param = new URLSearchParams(window.location.search).get('character');
  if (param === 'void') return 'void';
  return readStoredCharacter() ?? 'jq';
}

export function isVoidCharacterActive(): boolean {
  return getActiveMeadowCharacter() === 'void';
}

/** True when the visitor has met Void locally (About switch, param, or persisted void). */
export function hasMetVoidLocally(): boolean {
  if (typeof window === 'undefined') return false;
  const param = new URLSearchParams(window.location.search).get('character');
  if (param === 'void') return true;
  try {
    return (
      readStoredCharacter() === 'void' ||
      window.localStorage.getItem(MEADOW_SWITCHER_SEEN_STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}
