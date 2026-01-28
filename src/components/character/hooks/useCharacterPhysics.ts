import { useEffect, useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { Group, Object3D, AnimationClip } from 'three';
import { CharacterInputState } from './useCharacterInput';

export function useCharacterPhysics(
  groupRef: MutableRefObject<Group | null>,
  scene: Object3D | null,
  animations: AnimationClip[],
  input: CharacterInputState
) {
  const sceneRef = useRef<Object3D | null>(null);
  sceneRef.current = scene;
  const { actions } = useAnimations(animations, sceneRef);

  // Physics State
  const state = useRef({
    speed: 0,
    rotationVelocity: 0, // Current smoothed rotation velocity
    // Animation weights
    idleWeight: 1.0,
    walkWeight: 0.0,
    runWeight: 0.0,
    // Parameters
    walkSpeed: 1.0,
    runSpeed: 3.5,
    rotateSpeed: 2.5,
    speedLerpFactor: 0.1,
    rotationLerpFactor: 0.15, // Smoothing factor for rotation
    animBlendLerpFactor: 0.15,
  });


  // Initial Animation Start
  useEffect(() => {
    ['Idle', 'Walk', 'Run'].forEach(name => {
      const action = actions[name];
      if (action) {
        action.reset().play();
        action.setEffectiveWeight(name === 'Idle' ? 1.0 : 0.0);
      }
    });
  }, [actions]);

  // Game Loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = state.current;

    // --- Rotation ---
    let targetRotationVelocity = 0;
    if (input.rotateLeft) {
      targetRotationVelocity = s.rotateSpeed;
    } else if (input.rotateRight) {
      targetRotationVelocity = -s.rotateSpeed;
    }
    
    s.rotationVelocity = THREE.MathUtils.lerp(s.rotationVelocity, targetRotationVelocity, s.rotationLerpFactor);
    
    if (Math.abs(s.rotationVelocity) > 0.001) {
      groupRef.current.rotation.y += s.rotationVelocity * delta;
    }

    // --- Movement Calculation ---
    const currentMaxSpeed = input.run ? s.runSpeed : s.walkSpeed;
    const targetSpeed = input.moveForward ? currentMaxSpeed : 0;
    
    s.speed = THREE.MathUtils.lerp(s.speed, targetSpeed, s.speedLerpFactor);
    
    if (Math.abs(s.speed) > 0.01) {
      groupRef.current.translateZ(s.speed * delta);
    }

    // --- Animation Blending Logic (Blend Tree) ---
    const isRotating = input.rotateLeft || input.rotateRight;
    const isStationary = Math.abs(s.speed) < 0.05;
    const isTurningInPlace = isRotating && isStationary;

    let targetIdle = 0;
    let targetWalk = 0;
    let targetRun = 0;

    if (isTurningInPlace) {
      targetIdle = 0.3;
      targetWalk = 0.7;
      targetRun = 0;
    } else {
      // Two-stage blending based on actual speed (1D Blend Tree)
      // Stage 1: 0 -> walkSpeed (Idle blend Walk)
      if (s.speed <= s.walkSpeed) {
        const t = s.speed / s.walkSpeed; // 0 ~ 1
        targetIdle = 1 - t;
        targetWalk = t;
        targetRun = 0;
      } 
      // Stage 2: walkSpeed -> runSpeed (Walk blend Run)
      else {
        // Calculate how much over walkSpeed as a ratio
        const t = (s.speed - s.walkSpeed) / (s.runSpeed - s.walkSpeed);
        const clampT = Math.min(Math.max(t, 0), 1);
        
        targetIdle = 0;
        targetWalk = 1 - clampT;
        targetRun = clampT;
      }
    }

    // Apply smooth weight transitions
    s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, targetIdle, s.animBlendLerpFactor);
    s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, targetWalk, s.animBlendLerpFactor);
    s.runWeight = THREE.MathUtils.lerp(s.runWeight, targetRun, s.animBlendLerpFactor);

    actions['Idle']?.setEffectiveWeight(s.idleWeight);
    actions['Walk']?.setEffectiveWeight(s.walkWeight);
    actions['Run']?.setEffectiveWeight(s.runWeight);
  });
}
