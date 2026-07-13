import { useMeadowAuthStore } from '../store/meadowAuthStore';
import { useMeadowUiStore } from '../store/meadowUiStore';

/** True when focus is in a field that should receive normal typing. */
export function isFormFieldFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Legal modal, auth sheet, or Hue sheet — game movement and shortcuts should no-op. */
export function getIsMeadowOverlayOpen(): boolean {
  const legalModal = useMeadowUiStore.getState().legalModal;
  const { isAuthSheetOpen, isHueSheetOpen } = useMeadowAuthStore.getState();
  return Boolean(legalModal || isAuthSheetOpen || isHueSheetOpen);
}

/** Block meadow game keyboard / pointer shortcuts (not form typing). */
export function isMeadowGameInputBlocked(): boolean {
  return getIsMeadowOverlayOpen() || isFormFieldFocused();
}
