import { useEffect } from 'react';
import { useMeadowAuthStore } from '../store/meadowAuthStore';
import { useMeadowUiStore } from '../store/meadowUiStore';

/**
 * ESC stacking: legal modal → auth sheet → hue sheet → pointer lock release.
 */
export function useMeadowOverlayEsc() {
  const legalModal = useMeadowUiStore((state) => state.legalModal);
  const closeLegalModal = useMeadowUiStore((state) => state.closeLegalModal);
  const isAuthSheetOpen = useMeadowAuthStore((state) => state.isAuthSheetOpen);
  const closeAuthSheet = useMeadowAuthStore((state) => state.closeAuthSheet);
  const isHueSheetOpen = useMeadowAuthStore((state) => state.isHueSheetOpen);
  const closeHueSheet = useMeadowAuthStore((state) => state.closeHueSheet);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (legalModal) {
        event.preventDefault();
        event.stopPropagation();
        closeLegalModal();
        return;
      }

      if (isAuthSheetOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeAuthSheet();
        return;
      }

      if (isHueSheetOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeHueSheet();
        return;
      }

      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    legalModal,
    closeLegalModal,
    isAuthSheetOpen,
    closeAuthSheet,
    isHueSheetOpen,
    closeHueSheet,
  ]);
}
