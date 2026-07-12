import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Group } from 'three';
import { useGameStore } from '../../../core/store/gameStore';
import { CAMERA_LOOKAT } from '../CameraViewControl';

interface UseFollowCameraProps {
  characterRef: React.MutableRefObject<Group | null> | null;
  controlsRef: React.MutableRefObject<CameraControls | null>; 
  enabled: boolean;
}

/**
 * Follow-cam target tracking. Look-around is drag-based on every device:
 * CameraControls' own pointer-drag rotate handles it (no pointer lock),
 * so the cursor stays free for HUD interactions at all times.
 */
export function useFollowCamera({
  characterRef,
  controlsRef,
  enabled,
}: UseFollowCameraProps) {
  const characterFlightLiftRef = useGameStore((state) => state.characterFlightLiftRef);

  useFrame(() => {
    if (!enabled || !controlsRef.current || !characterRef?.current) return;
    
    const { x, y, z } = characterRef.current.position;
    const flightLift = characterFlightLiftRef.current;
    controlsRef.current.moveTo(x, y + CAMERA_LOOKAT.y + flightLift, z, true);
  });
}