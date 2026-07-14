import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';
import { useGameStore } from '../store/gameStore';
import { useVrStore } from '../store/vrStore';
import { input } from './controls';
import { applyVrSnapTurn } from '../xr/vrLocomotion';
import {
  VR_SNAP_STICK_THRESHOLD,
  VR_STICK_DEADZONE,
} from '../../config/vrProfile';
import { getIsMeadowOverlayOpen } from '../utils/meadowInputGuards';

/**
 * xr-standard gamepad layout (Quest 2/3, PCVR OpenXR → WebXR):
 * axes[0,1] = thumbstick X/Y
 * buttons[0] trigger, [1] squeeze/grip, [2] thumbstick click
 * buttons[4] primary (X left / A right), [5] secondary (Y left / B right)
 */
const BTN_SQUEEZE = 1;
const BTN_STICK_CLICK = 2;
const BTN_PRIMARY = 4;
const BTN_SECONDARY = 5;

const AXIS_X = 0;
const AXIS_Y = 1;

type StickSnapPhase = 'center' | 'left' | 'right';

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * ((Math.abs(value) - deadzone) / (1 - deadzone));
}

function isButtonDown(gamepad: Gamepad, index: number): boolean {
  const btn = gamepad.buttons[index];
  if (!btn) return false;
  return btn.pressed || btn.value > 0.5;
}

function wasButtonRising(prev: boolean, next: boolean): boolean {
  return next && !prev;
}

/**
 * Poll WebXR session input sources each frame for Quest / PCVR locomotion.
 * Keyboard parity stays on MeadowKeyboardMapper + VrSessionBridge snap subscriptions.
 */
export function useVrControllerInput(): void {
  const { gl, camera } = useThree();
  const isActive = useVrStore((state) => state.isActive);

  const prevButtonsRef = useRef<Map<XRInputSource, boolean[]>>(new Map());
  const rightStickPhaseRef = useRef<StickSnapPhase>('center');

  useEffect(() => {
    if (!isActive) {
      input.setAxis('horizontal', 0);
      input.setAxis('vertical', 0);
      input.setButton('Run', false);
      prevButtonsRef.current.clear();
      rightStickPhaseRef.current = 'center';
      return undefined;
    }

    return () => {
      input.setAxis('horizontal', 0);
      input.setAxis('vertical', 0);
      input.setButton('Run', false);
      prevButtonsRef.current.clear();
      rightStickPhaseRef.current = 'center';
    };
  }, [isActive]);

  useFrame(() => {
    if (!isActive) return;
    if (!useGameStore.getState().isControlEnabled) return;
    if (getIsMeadowOverlayOpen()) return;

    const renderer = gl as unknown as WebGPURenderer;
    const session = renderer.xr?.getSession();
    if (!session) return;

    let moveX = 0;
    let moveY = 0;
    let runHeld = false;
    let rightStickX = 0;

    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad) continue;

      const handedness = source.handedness;
      const prevButtons = prevButtonsRef.current.get(source) ?? [];
      const nextButtons = gamepad.buttons.map((b) => b.pressed || b.value > 0.5);

      const squeeze = isButtonDown(gamepad, BTN_SQUEEZE);
      const stickClick = isButtonDown(gamepad, BTN_STICK_CLICK);

      if (handedness === 'left') {
        moveX = applyDeadzone(gamepad.axes[AXIS_X] ?? 0, VR_STICK_DEADZONE);
        moveY = applyDeadzone(gamepad.axes[AXIS_Y] ?? 0, VR_STICK_DEADZONE);
        if (squeeze || stickClick) runHeld = true;
      }

      // PRD: either-hand grip while moving counts as run.
      if (handedness === 'right' && (squeeze || stickClick)) {
        runHeld = true;
      }

      if (handedness === 'right') {
        rightStickX = applyDeadzone(gamepad.axes[AXIS_X] ?? 0, VR_STICK_DEADZONE);
      }

      // Fly: Y (left secondary) or X (right primary). Land: same while flying, or B (right secondary).
      const yPress = handedness === 'left' && isButtonDown(gamepad, BTN_SECONDARY);
      const xPress = handedness === 'right' && isButtonDown(gamepad, BTN_PRIMARY);
      const bPress = handedness === 'right' && isButtonDown(gamepad, BTN_SECONDARY);

      const prevY = prevButtons[BTN_SECONDARY] ?? false;
      const prevX = prevButtons[BTN_PRIMARY] ?? false;
      const prevB = prevButtons[BTN_SECONDARY] ?? false;

      if (wasButtonRising(prevY, yPress) || wasButtonRising(prevX, xPress)) {
        handleFlyToggle();
      }
      if (wasButtonRising(prevB, bPress)) {
        handleLand();
      }

      prevButtonsRef.current.set(source, nextButtons);
    }

    // Left stick: screen Y is inverted vs world forward (match TouchJoystick).
    input.setAxis('horizontal', moveX);
    input.setAxis('vertical', -moveY);
    input.setButton('Run', runHeld);

    // Right stick horizontal: one 30° snap per flick (return to deadzone to re-arm).
    const phase = rightStickPhaseRef.current;
    if (Math.abs(rightStickX) < VR_STICK_DEADZONE) {
      rightStickPhaseRef.current = 'center';
    } else if (phase === 'center') {
      if (rightStickX <= -VR_SNAP_STICK_THRESHOLD) {
        applyVrSnapTurn(camera, 'left');
        rightStickPhaseRef.current = 'left';
      } else if (rightStickX >= VR_SNAP_STICK_THRESHOLD) {
        applyVrSnapTurn(camera, 'right');
        rightStickPhaseRef.current = 'right';
      }
    }
  });
}

function handleFlyToggle(): void {
  const game = useGameStore.getState();
  if (game.isFlying) {
    game.setIsFlying(false);
    useVrStore.getState().setVrRunLatch(false);
  } else {
    game.setIsFlying(true);
  }
}

function handleLand(): void {
  useGameStore.getState().setIsFlying(false);
  useVrStore.getState().setVrRunLatch(false);
}
