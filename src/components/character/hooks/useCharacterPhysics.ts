import { useEffect, useRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { Group, Object3D, AnimationClip } from 'three';

import { calculateBlendWeights } from '../utils/calculateBlendWeights';
import { CameraMode, useGameStore } from '../../../core/store/gameStore';
import { INITIAL_PHYSICS_STATE, PhysicsState } from '../config';
import { solveTank } from '../utils/solveTank';
import { solveCam } from '../utils/solveCam';
import { input } from '../../../core/input/controls';

export type StepType = 'walk' | 'run' | 'back';
export interface StepEvent {
  type: StepType;
  volume: number;
}

export function useCharacterPhysics(
  groupRef: MutableRefObject<Group | null>,
  scene: Object3D | null,
  animations: AnimationClip[],
  onStep: (event: StepEvent) => void
) {
  const { camera } = useThree();
  const cameraMode = useGameStore((state) => state.cameraMode);
  const isMobile = useGameStore((state) => state.isMobile);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isFlying = useGameStore((state) => state.isFlying);

  const sceneRef = useRef<Object3D | null>(null);
  sceneRef.current = scene;
  const { actions } = useAnimations(animations, sceneRef);

  const animState = useRef({
    lastWalkTime: 0,
    lastRunTime: 0,
    lastBackTime: 0,
    walkWasBelow: true,
    runWasBelow: true,
    backWasBelow: true,
  });

  const state = useRef<PhysicsState>({ ...INITIAL_PHYSICS_STATE });

  // Init Animations
  useEffect(() => {
    ['Idle', 'Walk', 'Run', 'Back', 'Flight'].forEach((name) => {
      const action = actions[name];
      if (action) {
        action.reset().play();
        action.setEffectiveWeight(name === 'Idle' ? 1.0 : 0.0);
      }
    });
  }, [actions]);

  const processFootstep = (
    actionName: string,
    weight: number,
    thresholds: number[],
    stateKey: 'lastWalkTime' | 'lastRunTime' | 'lastBackTime',
    belowKey: 'walkWasBelow' | 'runWasBelow' | 'backWasBelow',
    type: StepType
  ) => {
    const action = actions[actionName];
    if (!action) return;

    const effectiveWeight = action.getEffectiveWeight();
    if (effectiveWeight <= 0.12) {
      animState.current[belowKey] = true;
      return;
    }

    const duration = action.getClip().duration;
    const time = (action.time % duration) / duration;
    let lastTime = animState.current[stateKey];

    // Resync cycle when locomotion weight ramps in — avoids missing the first step.
    if (animState.current[belowKey]) {
      lastTime = time;
      animState.current[stateKey] = time;
      animState.current[belowKey] = false;
    }

    thresholds.forEach(t => {
      if (lastTime < t && time >= t) {
        onStep?.({ type, volume: Math.max(effectiveWeight, weight) });
      }
    });

    animState.current[stateKey] = time;
  };

  useFrame((_, delta) => {
    if (!groupRef.current || !isControlEnabled) return;
    
    const s = state.current;

    if (cameraMode === CameraMode.FPV) {
      solveTank(groupRef.current, s, delta, isMobile);
    } else {
      solveCam(groupRef.current, camera, s, delta, { isFlying });
    }

    const blend = s.animBlendLerpFactor;

    if (isFlying) {
      s.flightWeight = THREE.MathUtils.lerp(s.flightWeight, 1, blend);
      s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, 0, blend);
      s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, 0, blend);
      s.runWeight = THREE.MathUtils.lerp(s.runWeight, 0, blend);
      s.backWeight = THREE.MathUtils.lerp(s.backWeight, 0, blend);
    } else {
      s.flightWeight = THREE.MathUtils.lerp(s.flightWeight, 0, blend);

      const rotateLeft = input.isPressed('RotateLeft') || input.getAxis('horizontal') < -0.1;
      const rotateRight = input.isPressed('RotateRight') || input.getAxis('horizontal') > 0.1;
      const isRotating = (cameraMode === CameraMode.FPV) && (rotateLeft || rotateRight);
      const signedSpeed = Math.abs(s.speed);
      const targetWeights = calculateBlendWeights(
        signedSpeed,
        isRotating,
        s.walkSpeed,
        s.runSpeed,
        s.backSpeed,
      );

      s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, targetWeights.idle, blend);
      s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, targetWeights.walk, blend);
      s.runWeight = THREE.MathUtils.lerp(s.runWeight, targetWeights.run, blend);
      s.backWeight = THREE.MathUtils.lerp(s.backWeight, targetWeights.back, blend);
    }

    actions['Idle']?.setEffectiveWeight(s.idleWeight);
    actions['Walk']?.setEffectiveWeight(s.walkWeight);
    actions['Run']?.setEffectiveWeight(s.runWeight);
    actions['Back']?.setEffectiveWeight(s.backWeight);
    actions['Flight']?.setEffectiveWeight(s.flightWeight);

    if (!isFlying) {
      processFootstep('Walk', s.walkWeight, [0.05, 0.55], 'lastWalkTime', 'walkWasBelow', 'walk');
      processFootstep('Run', s.runWeight, [0.1, 0.6], 'lastRunTime', 'runWasBelow', 'run');
      processFootstep('Back', s.backWeight, [0.1, 0.6], 'lastBackTime', 'backWasBelow', 'back');
    }
  });
}
