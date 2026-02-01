import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CameraControls } from '@react-three/drei';
import { useFPVCamera } from './hooks/useFPVCamera';
import { useFollowCamera } from './hooks/useFollowCamera';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';

type Props = {
  boneName?: string;
};

export const CAMERA_POSITION = new THREE.Vector3(-4, 2, -0.5);
export const CAMERA_LOOKAT = new THREE.Vector3(0, 1, 0);

export function CameraViewControl({ boneName = 'head' }: Props) {
  // Read mode and character ref directly from Store
  const cameraMode = useGameStore((state) => state.cameraMode);
  const characterRef = useGameStore((state) => state.characterRef);
  const isGameLoaded = useGameStore((state) => state.isGameStarted);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const setControlEnabled = useGameStore((state) => state.setControlEnabled);

  const controlsRef = useRef<CameraControls>(null);

  useFPVCamera({
    characterRef,
    boneName,
    enabled: cameraMode === CameraMode.FPV && isControlEnabled,
  });

  useFollowCamera({
    characterRef,
    controlsRef,
    enabled: cameraMode === CameraMode.Follow && isControlEnabled,
  });

  useEffect(() => {
    if (isGameLoaded && !isControlEnabled && characterRef?.current && controlsRef.current) {
      const charPos = characterRef.current.position;
      const pos = charPos.clone().add(CAMERA_POSITION);
      const lookAt = charPos.clone().add(CAMERA_LOOKAT);

      document.body.style.cursor = 'wait';

      controlsRef.current.setLookAt(pos.x, pos.y, pos.z, lookAt.x, lookAt.y, lookAt.z, true).then(() => {
        setControlEnabled(true);
        document.body.style.cursor = 'default';
      });
    }
  }, [isGameLoaded, isControlEnabled, characterRef]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode !== CameraMode.FPV && isControlEnabled}
      minDistance={2}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2}
      smoothTime={ isControlEnabled ? 0.1 : 1 }
    />
  );
}
