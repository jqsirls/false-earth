import { useMeadowAuthStore } from '../store/meadowAuthStore';
import { useMeadowUiStore } from '../store/meadowUiStore';
import { getIsMeadowOverlayOpen } from '../utils/meadowInputGuards';

export { getIsMeadowOverlayOpen };

/** True when legal modal, auth sheet, or Hue sheet is open — hide joystick / block game HUD input. */
export function useIsMeadowOverlayOpen(): boolean {
  const legalModal = useMeadowUiStore((state) => state.legalModal);
  const isAuthSheetOpen = useMeadowAuthStore((state) => state.isAuthSheetOpen);
  const isHueSheetOpen = useMeadowAuthStore((state) => state.isHueSheetOpen);
  return Boolean(legalModal || isAuthSheetOpen || isHueSheetOpen);
}
