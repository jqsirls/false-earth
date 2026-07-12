import { useEffect, useRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { Group, Object3D, AnimationClip } from 'three';

import { calculateBlendWeights } from '../utils/calculateBlendWeights';
import { CameraMode, useGameStore } from '../../../core/store/gameStore';
import {
  IDLE_CHAIN_CONFIG,
  IDLE_CHAIN_STAGE_CLIPS,
  INITIAL_PHYSICS_STATE,
  IdleChainStage,
  PhysicsState,
} from '../config';
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
  const { actions, mixer } = useAnimations(animations, sceneRef);

  const animState = useRef({
    lastWalkTime: 0,
    lastRunTime: 0,
    lastBackTime: 0,
    walkWasBelow: true,
    runWasBelow: true,
    backWasBelow: true,
  });

  const state = useRef<PhysicsState>({ ...INITIAL_PHYSICS_STATE });

  // Idle-variety chain: distributes the idle envelope across the idle clips
  // (Idle 6s -> Offensive x1 cycle -> Happy loop until movement).
  const idleChain = useRef({
    stage: 'base' as IdleChainStage,
    stageTime: 0,
    offensiveFinished: false,
    crossfadeTau: IDLE_CHAIN_CONFIG.crossfadeSeconds.exitToBase / 3,
    weights: { base: 1, offensive: 0, happy: 0 } as Record<IdleChainStage, number>,
  });

  // Init Animations
  useEffect(() => {
    ['Idle', 'Walk', 'Run', 'Back', 'Flight', 'IdleHappy'].forEach((name) => {
      const action = actions[name];
      if (action) {
        action.reset().play();
        action.setEffectiveWeight(name === 'Idle' ? 1.0 : 0.0);
      }
    });
    // Offensive Idle plays exactly once per chain pass — armed on stage entry.
    const offensive = actions[IDLE_CHAIN_STAGE_CLIPS.offensive];
    if (offensive) {
      offensive.setLoop(THREE.LoopOnce, 1);
      offensive.clampWhenFinished = true;
      offensive.setEffectiveWeight(0);
    }
    idleChain.current = {
      stage: 'base',
      stageTime: 0,
      offensiveFinished: false,
      crossfadeTau: IDLE_CHAIN_CONFIG.crossfadeSeconds.exitToBase / 3,
      weights: { base: 1, offensive: 0, happy: 0 },
    };
  }, [actions]);

  // One-cycle detection for Offensive Idle via the mixer's finished event.
  useEffect(() => {
    if (!mixer) return;
    const onFinished = (event: { action?: THREE.AnimationAction }) => {
      if (event.action === actions[IDLE_CHAIN_STAGE_CLIPS.offensive]) {
        idleChain.current.offensiveFinished = true;
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, actions]);

  // ~95% blended in the configured duration (tau = duration / 3).
  const IDLE_STAGE_TAU: Record<IdleChainStage, number> = {
    base: IDLE_CHAIN_CONFIG.crossfadeSeconds.exitToBase / 3,
    offensive: IDLE_CHAIN_CONFIG.crossfadeSeconds.toOffensive / 3,
    happy: IDLE_CHAIN_CONFIG.crossfadeSeconds.toHappy / 3,
  };

  const enterIdleStage = (stage: IdleChainStage) => {
    const chain = idleChain.current;
    chain.stage = stage;
    chain.stageTime = 0;
    chain.crossfadeTau = IDLE_STAGE_TAU[stage];
    const action = actions[IDLE_CHAIN_STAGE_CLIPS[stage]];
    if (!action) return;
    if (stage === 'offensive') {
      chain.offensiveFinished = false;
      action.reset().play();
    } else if (stage === 'happy') {
      // Restart Happy from its first frame so the entry looks intentional.
      action.time = 0;
    }
  };

  /** Advance the chain while resting; snap back to base the moment movement begins. */
  const updateIdleChain = (delta: number, isResting: boolean) => {
    const chain = idleChain.current;

    // Rigs without the idle-variant clips (licensed astronaut) stay on plain Idle.
    const hasVariants =
      actions[IDLE_CHAIN_STAGE_CLIPS.offensive] && actions[IDLE_CHAIN_STAGE_CLIPS.happy];
    if (!hasVariants) {
      chain.stage = 'base';
      chain.weights = { base: 1, offensive: 0, happy: 0 };
      return;
    }

    if (!isResting) {
      if (chain.stage !== 'base') enterIdleStage('base');
      chain.stageTime = 0;
    } else {
      chain.stageTime += delta;
      if (chain.stage === 'base' && chain.stageTime >= IDLE_CHAIN_CONFIG.baseHoldSeconds) {
        enterIdleStage('offensive');
      } else if (chain.stage === 'offensive') {
        const offensive = actions[IDLE_CHAIN_STAGE_CLIPS.offensive];
        const duration = offensive?.getClip().duration ?? 0;
        if (chain.offensiveFinished || !offensive || chain.stageTime >= duration) {
          enterIdleStage('happy');
        }
      }
      // 'happy' loops until movement resets the chain.
    }

    // Soft crossfade: exponential approach, ~95% blended in ~3*tau.
    const k = 1 - Math.exp(-delta / chain.crossfadeTau);
    (Object.keys(chain.weights) as IdleChainStage[]).forEach((stage) => {
      const target = stage === chain.stage ? 1 : 0;
      chain.weights[stage] = THREE.MathUtils.lerp(chain.weights[stage], target, k);
    });
  };

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

    const rotateLeft = input.isPressed('RotateLeft') || input.getAxis('horizontal') < -0.1;
    const rotateRight = input.isPressed('RotateRight') || input.getAxis('horizontal') > 0.1;
    const isRotating = (cameraMode === CameraMode.FPV) && (rotateLeft || rotateRight);

    if (isFlying) {
      s.flightWeight = THREE.MathUtils.lerp(s.flightWeight, 1, blend);
      s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, 0, blend);
      s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, 0, blend);
      s.runWeight = THREE.MathUtils.lerp(s.runWeight, 0, blend);
      s.backWeight = THREE.MathUtils.lerp(s.backWeight, 0, blend);
    } else {
      s.flightWeight = THREE.MathUtils.lerp(s.flightWeight, 0, blend);

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

    // Idle-variety chain: any movement input (walk/run/fly/turn) exits immediately.
    const isResting = !isFlying && !isRotating && Math.abs(s.speed) < 0.05;
    updateIdleChain(delta, isResting);
    const idleWeights = idleChain.current.weights;

    actions['Idle']?.setEffectiveWeight(s.idleWeight * idleWeights.base);
    actions[IDLE_CHAIN_STAGE_CLIPS.offensive]?.setEffectiveWeight(s.idleWeight * idleWeights.offensive);
    actions[IDLE_CHAIN_STAGE_CLIPS.happy]?.setEffectiveWeight(s.idleWeight * idleWeights.happy);
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
