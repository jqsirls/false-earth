import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { AsyncCompile } from '@core';
import { useGameStore } from '../../core/store/gameStore';
import { gameEvents } from '../../core/events';
import { uTime } from '../../core/shaders/uniforms';
import { usePrefersReducedMotion } from '../../core/utils/reducedMotion';
import { playOrbChime, prepareOrbChime } from '../../audio/orbChime';
import {
  getDefaultCompileTimeoutMs,
  getOrbGroundCount,
  getOrbSkyCount,
  shouldUseCheapOrbRendering,
} from '../../core/utils/browserCaps';
import { resolveMeadowAsset } from '../../config/meadowAssets';
import { createOrbMaterial } from './core/orbMaterial';
import { orbDrift, orbOmegaFromRandom } from './core/orbMotion';
import {
  CHARACTER_CENTER_HEIGHT,
  ORB_COLLECT_VERTICAL_TOLERANCE,
  ORB_FIELD_MAX_RADIUS,
  ORB_FIELD_MIN_RADIUS,
  ORB_GROUND_COLLECT_RADIUS,
  ORB_GROUND_COUNT,
  ORB_GROUND_HOVER_MAX,
  ORB_GROUND_HOVER_MIN,
  ORB_GROUND_SIZE,
  ORB_RESPAWN_MAX_SECONDS,
  ORB_RESPAWN_MIN_CHARACTER_DISTANCE,
  ORB_RESPAWN_MIN_SECONDS,
  ORB_SKY_COLLECT_RADIUS,
  ORB_SKY_COUNT,
  ORB_SKY_HOVER_MAX,
  ORB_SKY_HOVER_MIN,
  ORB_SKY_SIZE,
} from './core/orbConfig';

const MIN_ORB_SPACING = 6;
const RESPAWN_PLACEMENT_ATTEMPTS = 16;

// Device-static caps (research-locked band is 8–15 field + 2–4 sky):
// constrained GPUs run the floor of the band, desktop runs the full count.
const EFFECTIVE_GROUND_COUNT = getOrbGroundCount(ORB_GROUND_COUNT);
const EFFECTIVE_SKY_COUNT = getOrbSkyCount(ORB_SKY_COUNT);
const EFFECTIVE_ORB_COUNT = EFFECTIVE_GROUND_COUNT + EFFECTIVE_SKY_COUNT;

/**
 * Owner's sculpted orb (Abstract_Spherical_Shape), decimated via
 * tools/3d/blender_orb_glb.py. GLBs are .vercelignored — production loads
 * from the meadow CDN via resolveMeadowAsset, local dev from public/.
 * Constrained GPUs load the 5k-tri decimation instead of the 20k sculpt.
 */
const ORB_MODEL_PATH = resolveMeadowAsset(
  shouldUseCheapOrbRendering() ? '/models/orb-v3-lite.glb' : '/models/orb-v3.glb',
);

interface OrbsProps {
  onCompileReady?: (id: string, isReady: boolean) => void;
  compileDebug?: boolean;
}

function isSkyOrb(index: number): boolean {
  return index >= EFFECTIVE_GROUND_COUNT;
}

function randomHover(index: number): number {
  return isSkyOrb(index)
    ? ORB_SKY_HOVER_MIN + Math.random() * (ORB_SKY_HOVER_MAX - ORB_SKY_HOVER_MIN)
    : ORB_GROUND_HOVER_MIN + Math.random() * (ORB_GROUND_HOVER_MAX - ORB_GROUND_HOVER_MIN);
}

function randomFieldXZ(out: { x: number; z: number }): void {
  const radius =
    ORB_FIELD_MIN_RADIUS +
    Math.sqrt(Math.random()) * (ORB_FIELD_MAX_RADIUS - ORB_FIELD_MIN_RADIUS);
  const angle = Math.random() * Math.PI * 2;
  out.x = Math.cos(angle) * radius;
  out.z = Math.sin(angle) * radius;
}

/**
 * Orb gathering v1 (research-locked): one instanced mesh of ~14 soft glowing
 * orbs (11 ground, 3 sky on flight arcs). Motion/pulse/dissolve live in the
 * shader; this component owns the CPU side — per-frame distance collect check
 * against the character (Rose.tsx pattern), delayed off-frustum respawn, the
 * gather event, and the single warm chime.
 */
export default function Orbs({ onCompileReady, compileDebug = false }: OrbsProps) {
  const characterRef = useGameStore((state) => state.characterRef);
  const isGameStarted = useGameStore((state) => state.isGameStarted);
  const flightLiftRef = useGameStore((state) => state.characterFlightLiftRef);
  const audioListener = useGameStore((state) => state.audioListener);
  const reducedMotion = usePrefersReducedMotion();
  const { camera } = useThree();

  const gltf = useGLTF(ORB_MODEL_PATH);
  const orbGeometry = useMemo(() => {
    let found: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((node) => {
      if (!found && (node as THREE.Mesh).isMesh) {
        found = (node as THREE.Mesh).geometry as THREE.BufferGeometry;
      }
    });
    return found as THREE.BufferGeometry | null;
  }, [gltf]);

  const system = useMemo(() => {
    const gpu = createOrbMaterial(EFFECTIVE_ORB_COUNT);
    const candidate = { x: 0, z: 0 };

    for (let i = 0; i < EFFECTIVE_ORB_COUNT; i += 1) {
      // Sparse scatter: rejection-sample for mutual spacing.
      for (let attempt = 0; attempt < 24; attempt += 1) {
        randomFieldXZ(candidate);
        let tooClose = false;
        for (let j = 0; j < i; j += 1) {
          const other = gpu.baseArray[j];
          if (Math.hypot(candidate.x - other.x, candidate.z - other.z) < MIN_ORB_SPACING) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) break;
      }

      gpu.baseArray[i].set(candidate.x, randomHover(i), candidate.z, Math.random());
      gpu.motionArray[i].set(
        orbOmegaFromRandom(Math.random()),
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      gpu.stateArray[i].set(1, -1000, isSkyOrb(i) ? ORB_SKY_SIZE : ORB_GROUND_SIZE, 0);
    }

    // Fallback icosphere only if the GLB somehow has no mesh.
    const geometry = orbGeometry ?? new THREE.IcosahedronGeometry(1, 2);
    const ownsGeometry = !orbGeometry;
    const mesh = new THREE.InstancedMesh(geometry, gpu.material, EFFECTIVE_ORB_COUNT);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return { gpu, mesh, geometry, ownsGeometry };
  }, [orbGeometry]);

  useEffect(() => {
    system.gpu.uMotionScale.value = reducedMotion ? 0 : 1;
  }, [system, reducedMotion]);

  useEffect(() => {
    prepareOrbChime(audioListener);
  }, [audioListener]);

  useEffect(() => {
    return () => {
      if (system.ownsGeometry) system.geometry.dispose();
      system.gpu.material.dispose();
    };
  }, [system]);

  const gatheredCountRef = useRef(0);
  const respawnAtRef = useRef<Float64Array>(new Float64Array(EFFECTIVE_ORB_COUNT).fill(-1));

  const collectOrb = (index: number, t: number) => {
    const state = system.gpu.stateArray[index];
    if (state.x < 0.5) return false;
    state.x = 0;
    state.y = t;
    respawnAtRef.current[index] =
      t +
      ORB_RESPAWN_MIN_SECONDS +
      Math.random() * (ORB_RESPAWN_MAX_SECONDS - ORB_RESPAWN_MIN_SECONDS);
    gatheredCountRef.current += 1;
    playOrbChime(audioListener, useGameStore.getState().meadowBgmPlaying);
    gameEvents.emit('orb:gathered', { count: gatheredCountRef.current });
    return true;
  };
  const collectOrbRef = useRef(collectOrb);
  collectOrbRef.current = collectOrb;

  // Dev/debug-only hook (?debug=true) — lets verification simulate collects
  // without driving the character into an orb. Never active in normal sessions.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== 'true') return undefined;
    const debugApi = {
      collect: (index = 0) => collectOrbRef.current(index, uTime.value),
      collectNext: () => {
        for (let i = 0; i < EFFECTIVE_ORB_COUNT; i += 1) {
          if (collectOrbRef.current(i, uTime.value)) return i;
        }
        return -1;
      },
      positions: () =>
        system.gpu.baseArray.map((v, i) => ({
          index: i,
          x: v.x,
          hover: v.y,
          z: v.z,
          active: system.gpu.stateArray[i].x >= 0.5,
        })),
      summon: (index: number, x: number, z: number, hover = 1.0) => {
        const base = system.gpu.baseArray[index];
        if (!base) return false;
        base.x = x;
        base.z = z;
        base.y = hover;
        system.gpu.stateArray[index].set(
          1,
          -1000,
          isSkyOrb(index) ? ORB_SKY_SIZE : ORB_GROUND_SIZE,
          0,
        );
        respawnAtRef.current[index] = -1;
        return true;
      },
    };
    (window as unknown as Record<string, unknown>).__meadowOrbs = debugApi;
    return () => {
      delete (window as unknown as Record<string, unknown>).__meadowOrbs;
    };
  }, [system]);
  const characterPos = useMemo(() => new THREE.Vector3(), []);
  const drift = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const frustumMatrix = useMemo(() => new THREE.Matrix4(), []);
  const respawnSphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), 4), []);

  useFrame(() => {
    if (!isGameStarted || !characterRef?.current) return;

    const t = uTime.value;
    characterRef.current.getWorldPosition(characterPos);
    const characterCenterY = flightLiftRef.current + CHARACTER_CENTER_HEIGHT;

    const { baseArray, motionArray, stateArray } = system.gpu;
    let frustumReady = false;

    for (let i = 0; i < EFFECTIVE_ORB_COUNT; i += 1) {
      const state = stateArray[i];

      if (state.x >= 0.5) {
        // Active — collect check at the drifted (visible) position.
        const base = baseArray[i];
        const motion = motionArray[i];
        if (reducedMotion) {
          drift.x = 0;
          drift.y = 0;
          drift.z = 0;
        } else {
          orbDrift(t, motion.x, motion.y, motion.z, motion.w, drift);
        }

        const dx = base.x + drift.x - characterPos.x;
        const dz = base.z + drift.z - characterPos.z;
        const dy = base.y + drift.y - characterCenterY;
        const radius = isSkyOrb(i) ? ORB_SKY_COLLECT_RADIUS : ORB_GROUND_COLLECT_RADIUS;

        if (
          dx * dx + dz * dz < radius * radius &&
          Math.abs(dy) < ORB_COLLECT_VERTICAL_TOLERANCE
        ) {
          collectOrbRef.current(i, t);
        }
        continue;
      }

      // Collected — delayed respawn strictly outside the camera frustum
      // plus a distance buffer from the character.
      const respawnAt = respawnAtRef.current[i];
      if (respawnAt < 0 || t < respawnAt) continue;

      if (!frustumReady) {
        frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(frustumMatrix);
        frustumReady = true;
      }

      for (let attempt = 0; attempt < RESPAWN_PLACEMENT_ATTEMPTS; attempt += 1) {
        randomFieldXZ(drift);
        const distToCharacter = Math.hypot(
          drift.x - characterPos.x,
          drift.z - characterPos.z,
        );
        if (distToCharacter < ORB_RESPAWN_MIN_CHARACTER_DISTANCE) continue;

        respawnSphere.center.set(drift.x, 1.5, drift.z);
        if (frustum.intersectsSphere(respawnSphere)) continue;

        baseArray[i].set(drift.x, randomHover(i), drift.z, Math.random());
        motionArray[i].set(
          orbOmegaFromRandom(Math.random()),
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
        );
        stateArray[i].set(1, -1000, isSkyOrb(i) ? ORB_SKY_SIZE : ORB_GROUND_SIZE, 0);
        respawnAtRef.current[i] = -1;
        break;
      }
      // No valid spot this frame (camera covers the field) — retry next frame.
    }
  });

  return (
    <AsyncCompile
      id="orb"
      onReady={onCompileReady}
      debug={compileDebug}
      timeout={getDefaultCompileTimeoutMs()}
    >
      <primitive object={system.mesh} />
    </AsyncCompile>
  );
}
