import { create } from 'zustand';

// Owner-approved presets (calculator modal was considered and rejected as
// overbuilt): 15/30 for wind-downs, 1H/2H for adults running the meadow
// ambiently (bath, resting, Hue lights on in a room).
export const SESSION_TIMER_CHOICES_MIN = [15, 30, 60, 120] as const;

/** Quiet labels inside the expanded row: minutes implied, hours abbreviated. */
export function sessionTimerLabel(minutes: number | null): string {
  if (minutes === null) return 'OFF';
  if (minutes % 60 === 0) return `${minutes / 60}H`;
  return `${minutes}`;
}

/** Collapsed echo under START: `TIMER`, `TIMER 30 MIN`, `TIMER 1H`. */
export function sessionTimerEchoLabel(minutes: number | null): string {
  if (minutes === null) return 'TIMER';
  if (minutes % 60 === 0) return `TIMER ${minutes / 60}H`;
  return `TIMER ${minutes} MIN`;
}
export const SESSION_TIMER_EXTENSION_MIN = 10;

interface SessionTimerState {
  /** Splash selection. null = no timer (default). Session-only, never persisted. */
  selectedMinutes: number | null;
  setSelectedMinutes: (minutes: number | null) => void;

  /** Epoch ms when the session softly ends. null = untimed. */
  endsAt: number | null;

  /** Arm the timer at START from the splash selection. */
  startTimer: () => void;

  /** Stay a little longer: gentle default extension from now. */
  extend: () => void;

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

  extend: () => set({ endsAt: Date.now() + SESSION_TIMER_EXTENSION_MIN * 60_000 }),

  clear: () => set({ endsAt: null, selectedMinutes: null }),
}));
