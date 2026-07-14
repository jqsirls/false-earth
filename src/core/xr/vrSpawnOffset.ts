import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { CAMERA_POSITION } from '../../components/camera/CameraViewControl';
import { useGameStore } from '../store/gameStore';
import { logVrSession } from './vrSessionDebug';

/** Third-person offset — feet on ground behind Booster, not inside the rig. */
const SPAWN_FEET_OFFSET = new THREE.Vector3(CAMERA_POSITION.x, 0, CAMERA_POSITION.z);

const quatScratch = new THREE.Quaternion();
const eulerScratch = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Place the XR rig at the flat follow-cam ring instead of character origin.
 * Without this, Quest/PCVR users spawn inside Booster at floor level.
 */
export async function applyVrSpawnOffset(renderer: WebGPURenderer, session: XRSession): Promise<void> {
  const xr = renderer.xr;
  if (!xr) return;

  const character = useGameStore.getState().characterRef?.current;
  const charX = character?.position.x ?? 0;
  const charZ = character?.position.z ?? 0;

  const offsetPos = {
    x: charX + SPAWN_FEET_OFFSET.x,
    y: SPAWN_FEET_OFFSET.y,
    z: charZ + SPAWN_FEET_OFFSET.z,
  };

  const dx = charX - offsetPos.x;
  const dz = charZ - offsetPos.z;
  const yaw = Math.atan2(dx, dz);
  eulerScratch.set(0, yaw, 0);
  quatScratch.setFromEuler(eulerScratch);

  const transform = new XRRigidTransform(offsetPos, {
    x: quatScratch.x,
    y: quatScratch.y,
    z: quatScratch.z,
    w: quatScratch.w,
  });

  try {
    const baseSpace = await session.requestReferenceSpace('local-floor');
    const offsetSpace = baseSpace.getOffsetReferenceSpace(transform);
    xr.setReferenceSpace(offsetSpace);
    logVrSession('spawn_offset_applied', { ...offsetPos, yaw });
  } catch (error) {
    logVrSession('spawn_offset_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
