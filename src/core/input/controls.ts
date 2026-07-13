import { InputSystem } from '@core';

export type GameAction = 'MoveForward' | 'MoveBackward' | 'RotateLeft' | 'RotateRight' | 'Run' | 'Jump';

export const input = new InputSystem<GameAction>();

export const keyBindings: Record<string, GameAction> = {
  KeyW: 'MoveForward', ArrowUp: 'MoveForward', w: 'MoveForward', arrowup: 'MoveForward',
  KeyS: 'MoveBackward', ArrowDown: 'MoveBackward', s: 'MoveBackward', arrowdown: 'MoveBackward',
  KeyA: 'RotateLeft', ArrowLeft: 'RotateLeft', a: 'RotateLeft', arrowleft: 'RotateLeft',
  KeyD: 'RotateRight', ArrowRight: 'RotateRight', d: 'RotateRight', arrowright: 'RotateRight',
  ShiftLeft: 'Run', ShiftRight: 'Run',
  Space: 'Jump',
};