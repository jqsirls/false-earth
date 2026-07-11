import { create } from 'zustand';
import { gameEvents } from '../events';
import { useGameStore } from './gameStore';
import { useMeadowAuthStore } from './meadowAuthStore';
import {
  accentMeadowHueAmbient,
  startMeadowHueAmbient,
  stopMeadowHueAmbient,
  stopMeadowHueAmbientOnHide,
  type HueAmbientStage,
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

export type AmbientStageSetting = 'off' | HueAmbientStage;

interface AmbientHueState {
  stage: AmbientStageSetting;
  sessionId: string | null;
  isBusy: boolean;
  /** Plain human copy for the sheet (e.g. no color lights) — never an error code. */
  notice: string | null;
  setStage: (stage: AmbientStageSetting) => Promise<void>;
}

let heartbeatTimer: number | null = null;
let lastAccentAtMs = 0;
let listenersBound = false;

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

  clearHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    const { stage: currentStage } = useAmbientHueStore.getState();
    if (currentStage === 'off' || !canRun()) return;
    void startSession(currentStage);
  }, HEARTBEAT_MS);
}

async function stopSession(silent = false): Promise<void> {
  clearHeartbeat();
  const { sessionId } = useAmbientHueStore.getState();
  useAmbientHueStore.setState({ stage: 'off', sessionId: null, isBusy: false, notice: null });
  if (!sessionId) return;
  const result = await stopMeadowHueAmbient(sessionId).catch(() => null);
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
      await stopSession();
      return;
    }
    set({ stage });
    await startSession(stage);
  },
}));

/** Idempotent global wiring: orb accents, tab hide/show, sign-out. */
export function bindAmbientHueListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

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
      void stopSession(true);
    }
  });
}
