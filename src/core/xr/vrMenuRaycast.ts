import * as THREE from 'three/webgpu';

export type LocomotionChipId = 'walk' | 'run' | 'fly' | 'land' | 'exit';

/** Local-space hit targets aligned to the Html chip arc. */
export const CHIP_HIT_LAYOUT: ReadonlyArray<{
  id: LocomotionChipId;
  position: [number, number, number];
}> = [
  { id: 'walk', position: [-0.115, 0.038, 0] },
  { id: 'run', position: [-0.038, 0.038, 0] },
  { id: 'fly', position: [0.038, 0.038, 0] },
  { id: 'land', position: [0.115, 0.038, 0] },
  { id: 'exit', position: [0, -0.028, 0] },
];

export const CHIP_HIT_WIDTH = 0.068;
export const CHIP_HIT_HEIGHT = 0.034;
export const CHIP_HIT_DEPTH = 0.012;

type Ray3 = { origin: THREE.Vector3; direction: THREE.Vector3 };

const raycaster = new THREE.Raycaster();

function poseToRay(
  pose: XRPose,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
): Ray3 {
  origin.set(
    pose.transform.position.x,
    pose.transform.position.y,
    pose.transform.position.z,
  );
  const quat = new THREE.Quaternion(
    pose.transform.orientation.x,
    pose.transform.orientation.y,
    pose.transform.orientation.z,
    pose.transform.orientation.w,
  );
  direction.set(0, 0, -1).applyQuaternion(quat);
  return { origin, direction };
}

/** Gaze + all XR input target rays (controllers, transient pointer). */
export function collectVrMenuRays(
  session: XRSession,
  frame: XRFrame,
  refSpace: XRReferenceSpace,
  camera: THREE.Camera,
  scratch: Ray3[],
): void {
  scratch.length = 0;

  const gazeOrigin = new THREE.Vector3();
  const gazeDir = new THREE.Vector3();
  camera.getWorldPosition(gazeOrigin);
  camera.getWorldDirection(gazeDir);
  scratch.push({ origin: gazeOrigin, direction: gazeDir.clone() });

  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (const source of session.inputSources) {
    const pose = frame.getPose(source.targetRaySpace, refSpace);
    if (!pose) continue;
    scratch.push(poseToRay(pose, origin.clone(), direction.clone()));
  }
}

export function raycastLocomotionChip(
  meshes: THREE.Object3D[],
  rays: Ray3[],
): LocomotionChipId | null {
  let closest: { id: LocomotionChipId; dist: number } | null = null;

  for (const ray of rays) {
    raycaster.set(ray.origin, ray.direction.normalize());
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) continue;

    const hit = hits[0];
    const id = hit.object.userData.chipId as LocomotionChipId | undefined;
    if (!id) continue;

    if (!closest || hit.distance < closest.dist) {
      closest = { id, dist: hit.distance };
    }
  }

  return closest?.id ?? null;
}

export function raycastFromInputSource(
  inputSource: XRInputSource,
  frame: XRFrame,
  refSpace: XRReferenceSpace,
  meshes: THREE.Object3D[],
): LocomotionChipId | null {
  const pose = frame.getPose(inputSource.targetRaySpace, refSpace);
  if (!pose) return null;

  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  return raycastLocomotionChip(meshes, [poseToRay(pose, origin, direction)]);
}
