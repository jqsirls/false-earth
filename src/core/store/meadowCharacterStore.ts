import { create } from 'zustand';
import { Vector3, Quaternion } from 'three';
import {
  MEADOW_CHARACTER_STORAGE_KEY,
  MEADOW_SWITCHER_SEEN_STORAGE_KEY,
  MEADOW_CHARACTER_NAMES,
  getActiveMeadowCharacter,
  hasMetVoidLocally,
  otherMeadowCharacter,
  type MeadowCharacterId,
} from '../../config/meadowCharacter';
import { useGameStore } from './gameStore';
import { useMeadowAuthStore } from './meadowAuthStore';
import { pushMeadowMetVoidFlag } from '../../api/meadowAuthApi';

/**
 * Live character switching (Booster ↔ The Void) — LOCAL ONLY until the owner
 * approves The Void for production.
 *
 * The switch is a React remount of the character rig under its own Suspense
 * (WorldController) — the session (orbs, timer, music, Hue, auth) is never
 * touched. The incoming character's name overlay (CharacterSwitchOverlay)
 * covers the model swap; the remount is deferred until the overlay is fully
 * opaque so there is never a visible hard pop.
 *
 * Discovery is About-modal easter egg only (`[ PLAY WITH THE VOID ]` /
 * `[ PLAY WITH BOOSTER ]`). No main-window switcher.
 *
 * "Met The Void" follows the visitor two ways:
 * - localStorage (`meadow_switcher_seen`) — always, works anonymously.
 * - Supabase auth user_metadata (`meadow_met_void`) — when signed in (merge-only).
 *
 * NOTE (owner decision, explicit and repeated): switching is NEVER auth-gated.
 */

/** Overlay fade-in — the swap fires once this completes (cover, no pop). */
export const SWITCH_OVERLAY_FADE_IN_MS = 400;
/** Name holds centered on screen (2–3s per spec). */
export const SWITCH_OVERLAY_HOLD_MS = 2200;
/** Overlay fade-out. */
export const SWITCH_OVERLAY_FADE_OUT_MS = 400;

/**
 * Outgoing character transform, applied to the incoming rig on mount so the
 * switch happens in place (no teleport back to spawn).
 */
let pendingTransform: { position: Vector3; quaternion: Quaternion } | null = null;

export function consumePendingCharacterTransform():
  | { position: Vector3; quaternion: Quaternion }
  | null {
  const transform = pendingTransform;
  pendingTransform = null;
  return transform;
}

/** One account push per page load is enough — the server flag is monotonic. */
let metVoidPushedThisLoad = false;

function pushMetVoidToAccountIfSignedIn(): void {
  if (metVoidPushedThisLoad) return;
  if (!useMeadowAuthStore.getState().isAuthenticated) return;
  metVoidPushedThisLoad = true;
  void pushMeadowMetVoidFlag();
}

function persistCharacterChoice(id: MeadowCharacterId): void {
  try {
    window.localStorage.setItem(MEADOW_CHARACTER_STORAGE_KEY, id);
    window.localStorage.setItem(MEADOW_SWITCHER_SEEN_STORAGE_KEY, '1');
  } catch {
    // Private-mode storage failures never block the in-session switch.
  }
}

function markMetVoidLocally(): void {
  try {
    window.localStorage.setItem(MEADOW_SWITCHER_SEEN_STORAGE_KEY, '1');
  } catch {
    // In-memory session still works — anonymous path unchanged.
  }
}

interface MeadowCharacterState {
  activeCharacter: MeadowCharacterId;
  /** True from switch tap until the name overlay has fully faded out. */
  isSwitching: boolean;
  /** Incoming character name while the overlay is up, else null. */
  overlayName: string | null;
  switchCharacter: () => void;
}

export const useMeadowCharacterStore = create<MeadowCharacterState>((set, get) => ({
  activeCharacter: getActiveMeadowCharacter(),
  isSwitching: false,
  overlayName: null,

  switchCharacter: () => {
    const { activeCharacter, isSwitching } = get();
    if (isSwitching) return;
    const incoming = otherMeadowCharacter(activeCharacter);

    set({
      isSwitching: true,
      overlayName: MEADOW_CHARACTER_NAMES[incoming],
    });

    // Defer the remount until the overlay is opaque — the model swap (and any
    // asset-load Suspense gap) happens under full cover.
    window.setTimeout(() => {
      const group = useGameStore.getState().characterRef?.current;
      pendingTransform = group
        ? { position: group.position.clone(), quaternion: group.quaternion.clone() }
        : null;
      persistCharacterChoice(incoming);
      set({ activeCharacter: incoming });
    }, SWITCH_OVERLAY_FADE_IN_MS + 50);

    window.setTimeout(() => {
      set({ isSwitching: false, overlayName: null });
    }, SWITCH_OVERLAY_FADE_IN_MS + SWITCH_OVERLAY_HOLD_MS + SWITCH_OVERLAY_FADE_OUT_MS);

    pushMetVoidToAccountIfSignedIn();
  },
}));

// Account ⇄ local merge on sign-in / hydration (merge only, never clear):
// - account has the flag → local seen flips on.
// - local met Void anonymously, account doesn't know yet → push up.
let lastSyncedUserId: string | null = null;
useMeadowAuthStore.subscribe((state) => {
  const session = state.session;
  if (!session) {
    lastSyncedUserId = null;
    return;
  }
  if (session.userId === lastSyncedUserId) return;
  lastSyncedUserId = session.userId;

  if (session.meadowMetVoid === true) {
    markMetVoidLocally();
  } else if (hasMetVoidLocally()) {
    pushMetVoidToAccountIfSignedIn();
  }
});
