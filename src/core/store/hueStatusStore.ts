import { create } from 'zustand';

/**
 * Shared Hue connection state for the lamp pill and Hue sheet.
 * `connected` is null until the first real getStatus result arrives —
 * writers are the HueSheet phases (load/connect success/disconnect) plus
 * one lamp-mount check; no background polling.
 */
interface HueStatusState {
  connected: boolean | null;
  setConnected: (connected: boolean | null) => void;
}

export const useHueStatusStore = create<HueStatusState>((set) => ({
  connected: null,
  setConnected: (connected) => set({ connected }),
}));
