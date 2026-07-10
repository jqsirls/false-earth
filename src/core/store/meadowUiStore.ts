import { create } from 'zustand';
import type { LegalModalId } from '../../ui/legalModalContent';

interface MeadowUiState {
  legalModal: LegalModalId | null;
  openLegalModal: (id: LegalModalId) => void;
  closeLegalModal: () => void;
  isAnyOverlayOpen: () => boolean;
}

export const useMeadowUiStore = create<MeadowUiState>((set, get) => ({
  legalModal: null,
  openLegalModal: (id) => set({ legalModal: id }),
  closeLegalModal: () => set({ legalModal: null }),
  isAnyOverlayOpen: () => get().legalModal !== null,
}));
