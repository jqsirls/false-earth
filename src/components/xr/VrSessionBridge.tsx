import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import { input } from '../../core/input/controls';
import { useVrControllerInput } from '../../core/input/useVrControllerInput';
import { applyVrSnapTurn } from '../../core/xr/vrLocomotion';
import { shouldForceWebGlRendererBackend } from '../../config/vrProfile';
import { isDebugMode } from '../../core/utils/browserCaps';
import { logVrSession } from '../../core/xr/vrSessionDebug';

/**
 * In-session VR locomotion: controller thumbsticks + keyboard parity (PRD §2.5).
 */
export function VrSessionBridge() {
  const { camera, scene, gl } = useThree();
  const isActive = useVrStore((state) => state.isActive);
  const xrFrameCount = useRef(0);

  useVrControllerInput();

  useEffect(() => {
    if (!isActive) return undefined;

    logVrSession('bridge_active');

    const xr = gl.xr;
    const onSessionStart = () => logVrSession('xr_event_sessionstart', { isPresenting: xr?.isPresenting });
    const onSessionEnd = () => logVrSession('xr_event_sessionend');
    xr?.addEventListener('sessionstart', onSessionStart);
    xr?.addEventListener('sessionend', onSessionEnd);

    const previousBackground = scene.background;
    const previousBackgroundNode = scene.backgroundNode;
    // Clear opaque scene background in ALL immersive paths — XR compositor owns clear.
    // (Previously WebGL-only; WebGPU XR on VP also blacks out with a solid background.)
    scene.background = null;
    scene.backgroundNode = null;
    logVrSession('scene_background_cleared', {
      webglBackend: shouldForceWebGlRendererBackend(),
    });

    return () => {
      scene.background = previousBackground;
      scene.backgroundNode = previousBackgroundNode;
      xr?.removeEventListener('sessionstart', onSessionStart);
      xr?.removeEventListener('sessionend', onSessionEnd);
      xrFrameCount.current = 0;
    };
  }, [gl, isActive, scene]);

  useEffect(() => {
    if (!isActive) return undefined;

    const turnIfReady = (direction: 'left' | 'right') => {
      if (!useVrStore.getState().isActive) return;
      if (!useGameStore.getState().isControlEnabled) return;
      applyVrSnapTurn(camera, direction);
    };

    const unsubLeft = input.subscribe('RotateLeft', () => turnIfReady('left'));
    const unsubRight = input.subscribe('RotateRight', () => turnIfReady('right'));

    return () => {
      unsubLeft();
      unsubRight();
    };
  }, [camera, isActive]);

  useFrame((_state, _delta, frame) => {
    if (!gl.xr?.isPresenting || !frame) return;

    xrFrameCount.current += 1;
    if (isDebugMode() && (xrFrameCount.current <= 5 || xrFrameCount.current % 120 === 0)) {
      const cam = gl.xr.getCamera();
      logVrSession('xr_frame', {
        n: xrFrameCount.current,
        cameras: cam.cameras.length,
        hasPose: cam.cameras.length > 0,
        webglBackend: shouldForceWebGlRendererBackend(),
      });
    }
  });

  return null;
}
