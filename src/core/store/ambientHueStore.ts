import { create } from 'zustand';
import { gameEvents } from '../events';
import { useGameStore } from './gameStore';
import { useMeadowAuthStore } from './meadowAuthStore';
import {
  accentMeadowHueAmbient,
  activityMeadowHueAmbient,
  startMeadowHueAmbient,
  stopMeadowHueAmbient,
  stopMeadowHueAmbientOnHide,
  type HueAmbientStage,
  type HueAmbientStopMode,
} from '../../api/meadowHueApi';
import { meadowAuthHeaders } from '../../api/meadowAuthApi';

/**
 * Meadow lights (ambient Hue) controller. Progressive enhancement all the way
 * down: every failure is silent or a single quiet sheet notice — the meadow
 * itself never reacts to lighting problems.
 *
 * Lifecycle: a stage button starts a server-owned looping session (~14 min max);
 * a heartbeat re-issues the start every ~13 min while the tab is visible and the
 * experience is running (the new session supersedes the old server-side). Stop
 * paths: OFF, sign-out, Hue disconnect, tab hide (keepalive stop; server TTL is
 * the backstop). Orb gathers send a debounced accent while a session is live.
 */

const HEARTBEAT_MS = 13 * 60 * 1000;
const ACCENT_THROTTLE_MS = 15000;
// Activity hint: numbers only (0 idle, 0.5 walking, 1 flying). Sampled every 10s,
// sent at most once per 30s and only when the level changes — never per-frame.
const ACTIVITY_SAMPLE_MS = 10000;
const ACTIVITY_SEND_MIN_GAP_MS = 30000;
const ACTIVITY_MOVE_WINDOW_MS = 15000;
const MOVEMENT_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);

export type AmbientStageSetting = 'off' | HueAmbientStage;

interface AmbientHueState {
  stage: AmbientStageSetting;
  sessionId: string | null;
  isBusy: boolean;
  /** Plain human copy for the sheet (e.g. no color lights) — never an error code. */
  notice: string | null;
  setStage: (stage: AmbientStageSetting) => Promise<void>;
  /**
   * Restore-mode stop for leave-the-meadow paths (Hue disconnect, sign-out):
   * the room returns to its pre-session state. The OFF stage button does NOT
   * use this — OFF means "lights off" (see setStage).
   */
  releaseSession: () => Promise<void>;
}

let heartbeatTimer: number | null = null;
let lastAccentAtMs = 0;
let listenersBound = false;
let activityTimer: number | null = null;
let lastMovementKeyAtMs = 0;
let lastSentActivity = 0;
let lastActivitySentAtMs = 0;

function currentActivityLevel(): number {
  if (useGameStore.getState().isFlying) return 1;
  return Date.now() - lastMovementKeyAtMs < ACTIVITY_MOVE_WINDOW_MS ? 0.5 : 0;
}

function clearActivityTimer(): void {
  if (activityTimer !== null) {
    window.clearInterval(activityTimer);
    activityTimer = null;
  }
}

function startActivityTimer(): void {
  clearActivityTimer();
  // Server initializes every session at activity 0.
  lastSentActivity = 0;
  lastActivitySentAtMs = 0;
  activityTimer = window.setInterval(() => {
    const { sessionId } = useAmbientHueStore.getState();
    if (!sessionId || !canRun()) return;
    const level = currentActivityLevel();
    const now = Date.now();
    if (level === lastSentActivity) return;
    if (now - lastActivitySentAtMs < ACTIVITY_SEND_MIN_GAP_MS) return;
    lastSentActivity = level;
    lastActivitySentAtMs = now;
    void activityMeadowHueAmbient(sessionId, level).catch(() => undefined);
  }, ACTIVITY_SAMPLE_MS);
}

function clearHeartbeat(): void {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function canRun(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  return useGameStore.getState().isGameStarted;
}

async function startSession(stage: HueAmbientStage): Promise<void> {
  const result = await startMeadowHueAmbient(stage);
  if (!result.ok) {
    clearHeartbeat();
    if (result.code === 'HUE_NO_COLOR_LIGHTS') {
      useAmbientHueStore.setState({
        stage: 'off',
        sessionId: null,
        isBusy: false,
        notice: 'This room has no color lights, so Booster will keep the glow on screen.',
      });
      return;
    }
    useAmbientHueStore.setState({
      stage: 'off',
      sessionId: null,
      isBusy: false,
      notice: 'The lights could not join in right now. The meadow is unaffected.',
    });
    return;
  }

  useAmbientHueStore.setState({
    stage: result.data.stage,
    sessionId: result.data.sessionId,
    isBusy: false,
    notice: null,
  });

  startActivityTimer();
  clearHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    const { stage: currentStage } = useAmbientHueStore.getState();
    if (currentStage === 'off' || !canRun()) return;
    void startSession(currentStage);
  }, HEARTBEAT_MS);
}

/**
 * Stop semantics (owner intent): the explicit OFF stage button means "turn the
 * lights OFF" ('lights_off' — a gentle ~2s fade to off), while leaving the meadow
 * (tab hide, sign-out, Hue disconnect) means "put my room back" ('restore').
 */
async function stopSession(mode: HueAmbientStopMode, silent = false): Promise<void> {
  clearHeartbeat();
  clearActivityTimer();
  const { sessionId } = useAmbientHueStore.getState();
  useAmbientHueStore.setState({ stage: 'off', sessionId: null, isBusy: false, notice: null });
  if (!sessionId) return;
  const result = await stopMeadowHueAmbient(sessionId, mode).catch(() => null);
  if (!silent && (!result || !result.ok)) {
    // Best effort: the server session TTL restores the room within minutes.
  }
}

export const useAmbientHueStore = create<AmbientHueState>((set, get) => ({
  stage: 'off',
  sessionId: null,
  isBusy: false,
  notice: null,
  setStage: async (stage) => {
    if (get().isBusy) return;
    bindAmbientHueListeners();
    set({ isBusy: true, notice: null });
    if (stage === 'off') {
      // OFF is a command, not a dismissal: the room's lights go off.
      await stopSession('lights_off');
      return;
    }
    set({ stage });
    await startSession(stage);
  },
  releaseSession: async () => {
    await stopSession('restore', true);
  },
}));

/** Idempotent global wiring: orb accents, tab hide/show, sign-out. */
export function bindAmbientHueListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  // Passive movement sensing for the activity hint — read-only listeners, no
  // interaction with the character/camera systems.
  window.addEventListener(
    'keydown',
    (event) => {
      if (MOVEMENT_KEYS.has(event.key.toLowerCase())) {
        lastMovementKeyAtMs = Date.now();
      }
    },
    { passive: true },
  );

  gameEvents.on('orb:gathered', () => {
    const { sessionId } = useAmbientHueStore.getState();
    if (!sessionId || !canRun()) return;
    const now = Date.now();
    if (now - lastAccentAtMs < ACCENT_THROTTLE_MS) return;
    lastAccentAtMs = now;
    void accentMeadowHueAmbient(sessionId).catch(() => undefined);
  });

  const stopOnHide = () => {
    const { sessionId } = useAmbientHueStore.getState();
    if (!sessionId) return;
    stopMeadowHueAmbientOnHide(sessionId, meadowAuthHeaders());
    clearHeartbeat();
    clearActivityTimer();
    useAmbientHueStore.setState({ sessionId: null });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopOnHide();
      return;
    }
    // Back to the meadow: quietly resume the chosen stage.
    const { stage, sessionId } = useAmbientHueStore.getState();
    if (stage !== 'off' && !sessionId && canRun()) {
      void startSession(stage);
    }
  });
  window.addEventListener('pagehide', stopOnHide);

  useMeadowAuthStore.subscribe((state, prev) => {
    if (prev.session && !state.session) {
      // Sign-out is a leave-the-meadow path: restore the room, don't black it out.
      void stopSession('restore', true);
    }
  });
}
