import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import { CameraControls } from '@react-three/drei';
import { useFPVCamera } from './hooks/useFPVCamera';
import { useFollowCamera } from './hooks/useFollowCamera';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';

type Props = {
  boneName?: string;
};

export const CAMERA_POSITION = new THREE.Vector3(-4, 2, -0.5);
export const CAMERA_LOOKAT = new THREE.Vector3(0, 1, 0);

/** Readonly hook for programmatic production verification — same pattern as __MEADOW_EVENTS__. */
declare global {
  interface Window {
    __MEADOW_CAMERA__?: { readonly azimuth: number | null };
  }
}

export function CameraViewControl({ boneName = 'head' }: Props) {
  const cameraMode = useGameStore((state) => state.cameraMode);
  const isVrActive = useVrStore((state) => state.isActive);
  const isMobile = useGameStore((state) => state.isMobile);
  const characterRef = useGameStore((state) => state.characterRef);
  const isGameLoaded = useGameStore((state) => state.isGameStarted);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const setControlEnabled = useGameStore((state) => state.setControlEnabled);

  const controlsRef = useRef<CameraControls>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__MEADOW_CAMERA__ = {
      get azimuth() {
        return controlsRef.current?.azimuthAngle ?? null;
      },
    };
    return () => {
      delete window.__MEADOW_CAMERA__;
    };
  }, []);

  const cameraRigEnabled = isControlEnabled && !isVrActive;

  useFPVCamera({
    characterRef,
    boneName,
    enabled: cameraMode === CameraMode.FPV && cameraRigEnabled,
  });

  useFollowCamera({
    characterRef,
    controlsRef,
    enabled: cameraMode === CameraMode.Follow && cameraRigEnabled,
  });

  const characterFlightLiftRef = useGameStore((state) => state.characterFlightLiftRef);

  const resetCamera = useCallback((earlyStop: boolean = true) => {
    if (!characterRef?.current || !controlsRef.current) return Promise.resolve();

    const charPos = characterRef.current.position;
    const flightLift = characterFlightLiftRef.current;
    const pos = charPos.clone().add(CAMERA_POSITION);
    pos.y += flightLift;
    const lookAt = charPos.clone().add(CAMERA_LOOKAT);
    lookAt.y += flightLift;

    const originalThreshold = controlsRef.current.restThreshold;
    controlsRef.current.restThreshold = earlyStop ? 0.05 : originalThreshold;

    return controlsRef.current.setLookAt(
      pos.x, pos.y, pos.z,
      lookAt.x, lookAt.y, lookAt.z,
      true
    ).then(() => {
      if (controlsRef.current) {
        controlsRef.current.restThreshold = originalThreshold;
      }
    });
  }, [characterRef, characterFlightLiftRef]);

  // initial sequence, reset camera to back
  useEffect(() => {
    if (isGameLoaded && !isControlEnabled) {
      document.body.style.cursor = 'wait';

      let isMounted = true;

      resetCamera(true).then(() => {
        if (isMounted) {
          setControlEnabled(true);
          document.body.style.cursor = 'default';
        }
      });

      return () => {
        isMounted = false;
        document.body.style.cursor = 'default';
      };
    }
  }, [isGameLoaded, isControlEnabled, resetCamera, setControlEnabled]);

  useEffect(() => {
    if (isControlEnabled && cameraMode !== CameraMode.FPV) {
      resetCamera(false);
    }
  }, [cameraMode, isControlEnabled, resetCamera]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode !== CameraMode.FPV && cameraRigEnabled}
      minDistance={2}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2}
      // Desktop drag-look: slower than the library default so it feels
      // deliberate, not twitchy. Mobile keeps its existing touch feel.
      azimuthRotateSpeed={isMobile ? 1 : 0.55}
      polarRotateSpeed={isMobile ? 1 : 0.55}
      smoothTime={isControlEnabled ? 0.1 : 1}
    />
  );
}
