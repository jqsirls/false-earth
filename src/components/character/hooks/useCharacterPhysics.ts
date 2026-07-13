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

export interface CharacterPhysicsOptions {
  /**
   * Per-character lerp factor for the flight-state weight crossfade only
   * (ground locomotion blending is untouched). The Void's held flight pose is
   * a large shape change and needs a slower ~0.6s ease; Booster keeps the
   * default when this is omitted.
   */
  flightBlendLerpFactor?: number;
}

export function useCharacterPhysics(
  groupRef: MutableRefObject<Group | null>,
  scene: Object3D | null,
  animations: AnimationClip[],
  onStep: (event: StepEvent) => void,
  options?: CharacterPhysicsOptions
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

  // Idle-variety chain (Idle 6s -> Offensive x1 cycle -> Happy loop until
  // movement). Stage handoffs are true mixer crossfades — both actions keep
  // playing while the mixer ramps their weights linearly — so each idle flows
  // into the next instead of cutting.
  const idleChain = useRef({
    stage: 'base' as IdleChainStage,
    stageTime: 0,
    offensiveFinished: false,
  });

  // Init Animations
  useEffect(() => {
    ['Idle', 'Walk', 'Run', 'Back', 'Flight'].forEach((name) => {
      const action = actions[name];
      if (action) {
        action.reset().play();
        action.setEffectiveWeight(name === 'Idle' ? 1.0 : 0.0);
      }
    });
    // Idle variants start on chain-stage entry (reset().play() + crossfade),
    // never at init. Offensive plays exactly once per chain pass.
    const offensive = actions[IDLE_CHAIN_STAGE_CLIPS.offensive];
    if (offensive) {
      offensive.setLoop(THREE.LoopOnce, 1);
      offensive.clampWhenFinished = true;
    }
    idleChain.current = { stage: 'base', stageTime: 0, offensiveFinished: false };
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

  const IDLE_STAGE_FADE: Record<IdleChainStage, number> = {
    base: IDLE_CHAIN_CONFIG.crossfadeSeconds.exitToBase,
    offensive: IDLE_CHAIN_CONFIG.crossfadeSeconds.toOffensive,
    happy: IDLE_CHAIN_CONFIG.crossfadeSeconds.toHappy,
  };

  /**
   * Mixer crossfade into the next stage: the incoming action restarts and
   * plays, the outgoing action keeps playing while both weights ramp
   * linearly. No timescale warp — these are same-tempo idles.
   */
  const enterIdleStage = (stage: IdleChainStage) => {
    const chain = idleChain.current;
    const from = actions[IDLE_CHAIN_STAGE_CLIPS[chain.stage]];
    const to = actions[IDLE_CHAIN_STAGE_CLIPS[stage]];
    chain.stage = stage;
    chain.stageTime = 0;
    if (!to || to === from) return;
    if (stage === 'offensive') chain.offensiveFinished = false;
    to.reset().play();
    if (from && from.enabled) {
      from.crossFadeTo(to, IDLE_STAGE_FADE[stage], false);
    } else {
      to.fadeIn(IDLE_STAGE_FADE[stage]);
    }
  };

  /** Advance the chain while resting; snap back to base the moment movement begins. */
  const updateIdleChain = (delta: number, isResting: boolean) => {
    const chain = idleChain.current;

    // Rigs without the idle-variant clips (licensed astronaut) stay on plain Idle.
    const hasVariants =
      actions[IDLE_CHAIN_STAGE_CLIPS.offensive] && actions[IDLE_CHAIN_STAGE_CLIPS.happy];
    if (!hasVariants) return;

    if (!isResting) {
      if (chain.stage !== 'base') enterIdleStage('base');
      chain.stageTime = 0;
      return;
    }

    chain.stageTime += delta;
    if (chain.stage === 'base' && chain.stageTime >= IDLE_CHAIN_CONFIG.baseHoldSeconds) {
      enterIdleStage('offensive');
    } else if (chain.stage === 'offensive') {
      const offensive = actions[IDLE_CHAIN_STAGE_CLIPS.offensive];
      const duration = offensive?.getClip().duration ?? 0;
      // Begin the Happy fade BEFORE the clip ends so the outgoing pose is
      // still moving through the whole crossfade (a clamped end frame would
      // read as a freeze). The finished event stays as a backstop.
      const fadeLead = IDLE_CHAIN_CONFIG.crossfadeSeconds.toHappy;
      if (
        !offensive ||
        chain.offensiveFinished ||
        offensive.time >= Math.max(duration - fadeLead, 0)
      ) {
        enterIdleStage('happy');
      }
    }
    // 'happy' loops until movement resets the chain.
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

    const flightBlend = options?.flightBlendLerpFactor ?? blend;

    if (isFlying) {
      s.flightWeight = THREE.MathUtils.lerp(s.flightWeight, 1, flightBlend);
      s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, 0, flightBlend);
      s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, 0, flightBlend);
      s.runWeight = THREE.MathUtils.lerp(s.runWeight, 0, flightBlend);
      s.backWeight = THREE.MathUtils.lerp(s.backWeight, 0, flightBlend);
    } else {
      s.flightWeight = THREE.MathUtils.lerp(s.flightWeight, 0, flightBlend);

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

    // All idle-chain actions share the locomotion idle envelope as their base
    // weight; the mixer's crossfade interpolants multiply on top (and keep
    // faded-out actions at 0 via enabled=false). Assign `.weight` directly —
    // setEffectiveWeight() calls stopFading() and would kill the crossfade.
    const setIdleBaseWeight = (name: string) => {
      const action = actions[name];
      if (action) action.weight = s.idleWeight;
    };
    setIdleBaseWeight('Idle');
    setIdleBaseWeight(IDLE_CHAIN_STAGE_CLIPS.offensive);
    setIdleBaseWeight(IDLE_CHAIN_STAGE_CLIPS.happy);
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
