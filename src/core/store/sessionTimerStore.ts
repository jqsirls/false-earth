import { create } from 'zustand';

// Owner-approved presets (calculator modal was considered and rejected as
// overbuilt): 15/30 for wind-downs, 1H/2H for adults running the meadow
// ambiently (bath, resting, Hue lights on in a room).
export const SESSION_TIMER_CHOICES_MIN = [15, 30, 60, 120] as const;

/** Quiet labels inside the expanded row: minutes implied, hours abbreviated. */
export function sessionTimerLabel(minutes: number | null): string {
  if (minutes === null) return 'NONE';
  if (minutes % 60 === 0) return `${minutes / 60}H`;
  return `${minutes}`;
}

/** Collapsed echo under START: `SET TIME LIMIT`, `TIME LIMIT 30 MIN`, `TIME LIMIT 1H`. */
export function sessionTimerEchoLabel(minutes: number | null): string {
  if (minutes === null) return 'SET TIME LIMIT';
  if (minutes % 60 === 0) return `TIME LIMIT ${minutes / 60}H`;
  return `TIME LIMIT ${minutes} MIN`;
}
interface SessionTimerState {
  /** Splash selection. null = no timer (default). Session-only, never persisted. */
  selectedMinutes: number | null;
  setSelectedMinutes: (minutes: number | null) => void;

  /** Epoch ms when the session softly ends. null = untimed. */
  endsAt: number | null;

  /** Arm the timer at START from the splash selection. */
  startTimer: () => void;

  /**
   * Soft-ending re-choice: arm a fresh limit from now, or NONE to stay
   * untimed. Replaces the old fixed +10-minute extend.
   */
  restart: (minutes: number | null) => void;

  clear: () => void;
}

/** Verification hook only: `?meadow-timer-seconds=15` shortens a CHOSEN timer. */
function testDurationMs(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('meadow-timer-seconds');
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : null;
}

export const useSessionTimerStore = create<SessionTimerState>((set, get) => ({
  selectedMinutes: null,
  setSelectedMinutes: (minutes) => set({ selectedMinutes: minutes }),

  endsAt: null,

  startTimer: () => {
    const { selectedMinutes } = get();
    if (!selectedMinutes) {
      set({ endsAt: null });
      return;
    }
    const durationMs = testDurationMs() ?? selectedMinutes * 60_000;
    set({ endsAt: Date.now() + durationMs });
  },

  restart: (minutes) => {
    if (!minutes) {
      set({ selectedMinutes: null, endsAt: null });
      return;
    }
    const durationMs = testDurationMs() ?? minutes * 60_000;
    set({ selectedMinutes: minutes, endsAt: Date.now() + durationMs });
  },

  clear: () => set({ endsAt: null, selectedMinutes: null }),
}));
