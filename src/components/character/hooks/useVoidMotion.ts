import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useGameStore } from '../../../core/store/gameStore';
import {
  VOID_FLIGHT_MOTION_CONFIG,
  VOID_GLOW_CONFIG,
  VOID_WING_CONFIG,
  isVoidGlowOn,
} from '../voidConfig';
import type { VoidCharacterAssets } from './useVoidCharacterAssets';

/**
 * The Void's life layer — all procedural:
 *
 * - Wings: continuous insectoid flutter driven by rotating the four dedicated
 *   VOID_wing* BONES (children of Spine2; each wing mesh is rigid-skinned 100%
 *   to its bone, so nothing can warp). No clip carries tracks for these bones,
 *   so the mixer never fights the procedural motion. Intensity scales with
 *   movement speed — slow shimmer at rest, faster flutter when traveling,
 *   strongest spread+shimmer in flight (owner: flight is a held pose, "wings
 *   carry all the life"). A short burst envelope kicks when movement starts.
 * - Flight secondary motion: slow vertical bob + slight eased lean into the
 *   travel direction (gentle; intentionally kept under reduced motion).
 * - Glow: emissive breath pulse when on, eased to dark when off.
 */

interface WingRuntime {
  node: THREE.Object3D;
  baseQuaternion: THREE.Quaternion;
  /** Upper/lower pairs run out of phase. */
  phase: number;
}

/**
 * Wing-bone local axes (Blender export): Y runs along the bone from the spine
 * hinge outward through the wing; rotating about local X pitches the wing
 * up/down around the hinge — the flap. The exporter builds the LEFT bone
 * frames as exact world mirrors of the RIGHT ones (head, direction and roll),
 * so the SAME local angle on both sides is world-symmetric — no per-side sign
 * (a sign here on top of mirrored frames is what read as crooked wings).
 */
const FLAP_AXIS = new THREE.Vector3(1, 0, 0);

export function useVoidMotion(assets: VoidCharacterAssets): void {
  const { scene, wingNodes, glowMaterials } = assets;

  const isFlying = useGameStore((state) => state.isFlying);
  const characterRef = useGameStore((state) => state.characterRef);

  const wings = useMemo<WingRuntime[]>(
    () =>
      wingNodes.map((node) => ({
        node,
        baseQuaternion: node.quaternion.clone(),
        phase: node.name.includes('lower') ? VOID_WING_CONFIG.lowerWingPhaseRad : 0,
      })),
    [wingNodes],
  );

  const prevPosRef = useRef<THREE.Vector3 | null>(null);
  const speedRef = useRef(0);
  const burstRef = useRef(0);
  const wasMovingRef = useRef(false);
  const flightBlendRef = useRef(0);
  const leanRef = useRef(0);
  const glowLevelRef = useRef(isVoidGlowOn() ? 1 : 0);
  const wingPhaseRef = useRef(0);

  const scratchQuat = useMemo(() => new THREE.Quaternion(), []);
  const scratchVec = useMemo(() => new THREE.Vector3(), []);
  const scratchForward = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!scene) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.1);

    // --- speed from the physics-driven character group ---
    let speed = 0;
    let forwardSpeed = 0;
    const group = characterRef?.current;
    if (group) {
      scratchVec.setFromMatrixPosition(group.matrixWorld);
      if (prevPosRef.current) {
        const dist = scratchVec.distanceTo(prevPosRef.current);
        if (dt > 0) speed = dist / dt;
        scratchForward.set(0, 0, 1).applyQuaternion(group.quaternion);
        const dx = scratchVec.x - prevPosRef.current.x;
        const dz = scratchVec.z - prevPosRef.current.z;
        forwardSpeed = dt > 0 ? (dx * scratchForward.x + dz * scratchForward.z) / dt : 0;
        prevPosRef.current.copy(scratchVec);
      } else {
        prevPosRef.current = scratchVec.clone();
      }
    }
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, speed, 0.2);
    const smoothSpeed = speedRef.current;

    // --- movement-start shimmer burst ---
    const movingNow = smoothSpeed > 0.35;
    if (movingNow && !wasMovingRef.current) burstRef.current = 1;
    wasMovingRef.current = movingNow;
    burstRef.current = Math.max(
      0,
      burstRef.current - dt / VOID_WING_CONFIG.burstDecaySeconds,
    );

    // --- wing flutter ---
    const cfg = VOID_WING_CONFIG;
    const speedNorm = THREE.MathUtils.clamp(smoothSpeed / 3.5, 0, 1);
    flightBlendRef.current = THREE.MathUtils.lerp(
      flightBlendRef.current,
      isFlying ? 1 : 0,
      0.06,
    );
    const flight = flightBlendRef.current;

    const groundFreq = THREE.MathUtils.lerp(cfg.restFrequencyHz, cfg.moveFrequencyHz, speedNorm);
    const groundAmp = THREE.MathUtils.lerp(cfg.restAmplitudeRad, cfg.moveAmplitudeRad, speedNorm);
    const flightSpeedNorm = THREE.MathUtils.clamp(smoothSpeed / 4.0, 0, 1);
    const flightFreq = THREE.MathUtils.lerp(cfg.restFrequencyHz * 2, cfg.flightFrequencyHz, flightSpeedNorm);
    const flightAmp = THREE.MathUtils.lerp(cfg.restAmplitudeRad * 1.6, cfg.flightAmplitudeRad, flightSpeedNorm);

    let freq = THREE.MathUtils.lerp(groundFreq, flightFreq, flight);
    let amp = THREE.MathUtils.lerp(groundAmp, flightAmp, flight);
    const burst = burstRef.current * cfg.burstGain;
    freq *= 1 + burst;
    amp *= 1 + burst;

    // integrate phase so frequency changes never snap the waveform
    wingPhaseRef.current += dt * freq * Math.PI * 2;
    const phase = wingPhaseRef.current;
    const spread = cfg.flightSpreadRad * flight;

    for (const wing of wings) {
      // Symmetric stance: the spread term is identical for all wings; only the
      // small oscillation carries the organic upper/lower phase offset.
      const flap = Math.sin(phase + wing.phase) * amp + spread;
      scratchQuat.setFromAxisAngle(FLAP_AXIS, flap);
      wing.node.quaternion.copy(wing.baseQuaternion).multiply(scratchQuat);
    }

    // --- flight bob + lean (gentle by design; kept under reduced motion) ---
    const fm = VOID_FLIGHT_MOTION_CONFIG;
    const groundY = (scene.userData.voidGroundY as number) ?? scene.position.y;
    const bob = Math.sin((t * Math.PI * 2) / fm.bobPeriodSeconds) * fm.bobAmplitudeLocal * flight;
    scene.position.y = groundY + bob;

    const leanTarget =
      flight * THREE.MathUtils.clamp(forwardSpeed / 4.0, -1, 1) * fm.leanMaxRad;
    leanRef.current = THREE.MathUtils.lerp(leanRef.current, leanTarget, fm.leanEase);
    scene.rotation.x = leanRef.current;

    // --- glow breath ---
    if (glowMaterials.length > 0) {
      const g = VOID_GLOW_CONFIG;
      const target = isVoidGlowOn() ? 1 : 0;
      const step = dt / g.transitionSeconds;
      glowLevelRef.current = THREE.MathUtils.clamp(
        glowLevelRef.current + Math.sign(target - glowLevelRef.current) * step,
        0,
        1,
      );
      const breath =
        g.onIntensityBase +
        Math.sin((t * Math.PI * 2) / g.breathPeriodSeconds) * g.onIntensityAmplitude;
      const intensity = THREE.MathUtils.lerp(g.offIntensity, breath, glowLevelRef.current);
      for (const mat of glowMaterials) {
        mat.emissiveIntensity = intensity;
      }
    }
  });
}
