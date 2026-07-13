import { create } from 'zustand';

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
  vrRunLatch: false,
  setVrRunLatch: (latched) => set({ vrRunLatch: latched }),
}));
