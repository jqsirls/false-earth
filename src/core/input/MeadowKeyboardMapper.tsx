import { useEffect } from 'react';
import { InputSystem } from '@core';
import type { GameAction } from './controls';
import { useMeadowAuthStore } from '../store/meadowAuthStore';
import { useMeadowUiStore } from '../store/meadowUiStore';
import { getIsMeadowOverlayOpen, isFormFieldFocused } from '../utils/meadowInputGuards';

/** Movement keys: block browser scroll / focus moves so arrows match WASD. */
const GAME_KEY_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space',
]);

function resolveAction(
  keyMap: Record<string, GameAction>,
  e: KeyboardEvent,
): GameAction | undefined {
  // Arrow keys: prefer e.key over e.code. Some drivers report swapped
  // Arrow* codes while e.key stays canonical — that reads as inverted
  // movement (up→down, left→right) even when WASD codes are fine.
  if (e.key.startsWith('Arrow')) {
    return keyMap[e.key] ?? keyMap[e.code];
  }
  return keyMap[e.code] ?? keyMap[e.key] ?? keyMap[e.key.toLowerCase()];
}

interface MeadowKeyboardMapperProps {
  input: InputSystem<GameAction>;
  keyMap: Record<string, GameAction>;
}

export function MeadowKeyboardMapper({ input, keyMap }: MeadowKeyboardMapperProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (isFormFieldFocused()) return;

      if (getIsMeadowOverlayOpen()) {
        if (isDown) input.reset();
        return;
      }

      const action = resolveAction(keyMap, e);
      if (!action) return;
      if (GAME_KEY_CODES.has(e.code) || e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
      input.setButton(action, isDown);
    };

    const onDown = (e: KeyboardEvent) => !e.repeat && handleKey(e, true);
    const onUp = (e: KeyboardEvent) => handleKey(e, false);
    const onBlur = () => input.reset();

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      input.reset();
    };
  }, [input, keyMap]);

  // Drop any held movement keys when a sheet/modal opens.
  useEffect(() => {
    const resetOnOverlay = () => {
      if (getIsMeadowOverlayOpen()) input.reset();
    };

    const unsubAuth = useMeadowAuthStore.subscribe(resetOnOverlay);
    const unsubUi = useMeadowUiStore.subscribe(resetOnOverlay);

    return () => {
      unsubAuth();
      unsubUi();
    };
  }, [input]);

  return null;
}
