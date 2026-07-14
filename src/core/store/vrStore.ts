import { create } from 'zustand';
import { VR_SNAP_COMFORT_MS } from '../../config/vrProfile';

export type VrComfortSettings = {
  snapTurnDegrees: number;
  smoothTurnEnabled: boolean;
};

interface VrState {
  isSupported: boolean;
  setIsSupported: (supported: boolean) => void;
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  isEntering: boolean;
  setIsEntering: (entering: boolean) => void;
  lastError: string | null;
  setLastError: (error: string | null) => void;
  comfort: VrComfortSettings;
  /** 0–1 comfort vignette pulse on snap turn; decays in Effects. */
  snapComfortStrength: number;
  snapComfortUntilMs: number;
  pulseSnapComfort: () => void;
  decaySnapComfort: (nowMs: number) => void;
  /** VP gaze RUN chip / flat Shift equivalent while in VR. */
  vrRunLatch: boolean;
  setVrRunLatch: (latched: boolean) => void;
}

export const useVrStore = create<VrState>((set) => ({
  isSupported: false,
  setIsSupported: (supported) => set({ isSupported: supported }),
  isActive: false,
  setIsActive: (active) => set({ isActive: active, ...(active ? {} : { vrRunLatch: false }) }),
  isEntering: false,
  setIsEntering: (entering) => set({ isEntering: entering }),
  lastError: null,
  setLastError: (error) => set({ lastError: error }),
  comfort: {
    snapTurnDegrees: 30,
    smoothTurnEnabled: false,
  },
  snapComfortStrength: 0,
  snapComfortUntilMs: 0,
  pulseSnapComfort: () =>
    set({
      snapComfortStrength: 1,
      snapComfortUntilMs: performance.now() + VR_SNAP_COMFORT_MS,
    }),
  decaySnapComfort: (nowMs) =>
    set((state) => {
      if (state.snapComfortStrength <= 0) return state;
      const remaining = state.snapComfortUntilMs - nowMs;
      if (remaining <= 0) {
        return { snapComfortStrength: 0, snapComfortUntilMs: 0 };
      }
      return {
        snapComfortStrength: Math.min(1, remaining / VR_SNAP_COMFORT_MS),
      };
    }),
  vrRunLatch: false,
  setVrRunLatch: (latched) => set({ vrRunLatch: latched }),
}));
