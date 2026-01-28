import { useEffect, useRef } from 'react';

export interface CharacterInputState {
  moveForward: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  run: boolean;
}

/** Returns a stable ref holding current input intent. Physics layer uses this, not raw keys. */
export function useCharacterInput() {
  const input = useRef<CharacterInputState>({
    moveForward: false,
    rotateLeft: false,
    rotateRight: false,
    run: false,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      switch (key) {
        case 'w':
        case 'arrowup':
          input.current.moveForward = isDown;
          break;
        case 'a':
        case 'arrowleft':
          input.current.rotateLeft = isDown;
          break;
        case 'd':
        case 'arrowright':
          input.current.rotateRight = isDown;
          break;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') input.current.run = isDown;
    };

    const onDown = (e: KeyboardEvent) => handleKey(e, true);
    const onUp = (e: KeyboardEvent) => handleKey(e, false);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  return input;
}
