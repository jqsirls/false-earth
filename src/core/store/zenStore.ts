import { create } from 'zustand';

/**
 * Desktop [H] zen mode: hides ALL HUD chrome (CTA, lamp, speaker, ORBS,
 * hints, footer, timer peek). The experience and the custom cursor remain.
 * Session-only; restored by H or Esc, never by movement input.
 */
interface ZenState {
  isUiHidden: boolean;
  toggleUiHidden: () => void;
  showUi: () => void;
}

export const useZenStore = create<ZenState>((set) => ({
  isUiHidden: false,
  toggleUiHidden: () => set((state) => ({ isUiHidden: !state.isUiHidden })),
  showUi: () => set({ isUiHidden: false }),
}));
