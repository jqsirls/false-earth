import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { WebGPURenderer } from 'three/webgpu';
import * as THREE from 'three/webgpu';
import { useGameStore } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import {
  VR_GAZE_DWELL_MS,
  VR_MENU_ACTIVE_OPACITY,
  VR_MENU_CHIP_PULSE_MS,
  VR_MENU_IDLE_FADE_MS,
  VR_MENU_IDLE_OPACITY,
} from '../../config/vrProfile';
import { endImmersiveVrSession, getVrRenderer } from '../../core/xr/webXrSession';
import {
  CHIP_HIT_DEPTH,
  CHIP_HIT_HEIGHT,
  CHIP_HIT_LAYOUT,
  CHIP_HIT_WIDTH,
  collectVrMenuRays,
  raycastFromInputSource,
  raycastLocomotionChip,
  type LocomotionChipId,
} from '../../core/xr/vrMenuRaycast';
import { usePrefersReducedMotion } from '../../core/utils/reducedMotion';

type LocomotionVerb = 'walk' | 'run' | 'fly' | 'land';

const CHIP_STYLE: CSSProperties = {
  fontFamily: 'Cousine, monospace',
  fontSize: '0.65rem',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '4px',
  padding: '8px 12px',
  minWidth: '72px',
  minHeight: '36px',
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
};

const CHIP_ACTIVE: CSSProperties = {
  color: '#ffffff',
  background: 'rgba(255,255,255,0.14)',
};

function chipLabel(verb: LocomotionVerb): string {
  return verb === 'land' ? 'STOP FLYING' : verb.toUpperCase();
}

function chipStyleFor(
  baseActive: boolean,
  isTarget: boolean,
  dwellProgress: number,
  isPulsing: boolean,
): CSSProperties {
  const base = { ...CHIP_STYLE, ...(baseActive ? CHIP_ACTIVE : {}) };

  if (isPulsing) {
    return {
      ...base,
      color: '#ffffff',
      background: 'rgba(255,255,255,0.22)',
      boxShadow: '0 0 12px rgba(255,255,255,0.25)',
    };
  }

  if (isTarget && dwellProgress > 0) {
    const t = Math.min(1, dwellProgress);
    return {
      ...base,
      color: `rgba(255,255,255,${0.55 + 0.45 * t})`,
      background: `rgba(255,255,255,${0.06 + 0.08 * t})`,
      boxShadow: t > 0.08 ? `0 0 ${10 * t}px rgba(255,255,255,${0.18 * t})` : undefined,
    };
  }

  if (isTarget) {
    return {
      ...base,
      color: 'rgba(255,255,255,0.88)',
      background: 'rgba(255,255,255,0.11)',
    };
  }

  return base;
}

/**
 * World-anchored locomotion ring (PRD §2.5.2).
 * Quest/PCVR: aim controller ray, dwell 0.8s or trigger for instant select.
 * Vision Pro: gaze or transient-pointer ray dwell; pinch for instant select.
 */
export function VrLocomotionMenu() {
  const groupRef = useRef<THREE.Group>(null);
  const hitMeshesRef = useRef<THREE.Mesh[]>([]);
  const raysScratchRef = useRef<{ origin: THREE.Vector3; direction: THREE.Vector3 }[]>([]);
  const dwellElapsedRef = useRef(0);
  const dwellTargetRef = useRef<LocomotionChipId | null>(null);
  const domHoverRef = useRef<LocomotionChipId | null>(null);
  const lastInteractionRef = useRef(performance.now());
  const menuOpacityRef = useRef(VR_MENU_ACTIVE_OPACITY);

  const { camera, gl } = useThree();
  const reducedMotion = usePrefersReducedMotion();

  const isActive = useVrStore((state) => state.isActive);
  const isEntering = useVrStore((state) => state.isEntering);
  const setIsEntering = useVrStore((state) => state.setIsEntering);
  const setLastError = useVrStore((state) => state.setLastError);
  const vrRunLatch = useVrStore((state) => state.vrRunLatch);
  const setVrRunLatch = useVrStore((state) => state.setVrRunLatch);
  const setIsFlying = useGameStore((state) => state.setIsFlying);
  const isFlying = useGameStore((state) => state.isFlying);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);

  const [isExiting, setIsExiting] = useState(false);
  const [dwellTarget, setDwellTarget] = useState<LocomotionChipId | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [menuOpacity, setMenuOpacity] = useState(VR_MENU_ACTIVE_OPACITY);
  const [pulseChip, setPulseChip] = useState<LocomotionChipId | null>(null);

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = performance.now();
  }, []);

  const onVerb = useCallback(
    (verb: LocomotionVerb) => {
      switch (verb) {
        case 'walk':
          setIsFlying(false);
          setVrRunLatch(false);
          break;
        case 'run':
          setIsFlying(false);
          setVrRunLatch(true);
          break;
        case 'fly':
          setIsFlying(true);
          break;
        case 'land':
          setIsFlying(false);
          break;
        default: {
          const _exhaustive: never = verb;
          return _exhaustive;
        }
      }
    },
    [setIsFlying, setVrRunLatch],
  );

  const onExitVr = useCallback(async () => {
    if (isExiting || isEntering) return;
    setLastError(null);
    setIsExiting(true);
    setIsEntering(true);
    try {
      const renderer = getVrRenderer();
      if (!renderer) {
        throw new Error('WebGPU XR renderer not ready');
      }
      await endImmersiveVrSession(renderer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VR exit failed';
      setLastError(message);
    } finally {
      setIsExiting(false);
      setIsEntering(false);
    }
  }, [isEntering, isExiting, setIsEntering, setLastError]);

  const activateChip = useCallback(
    (chipId: LocomotionChipId) => {
      markInteraction();
      dwellElapsedRef.current = 0;
      dwellTargetRef.current = null;
      setDwellTarget(null);
      setDwellProgress(0);

      setPulseChip(chipId);
      window.setTimeout(() => setPulseChip(null), VR_MENU_CHIP_PULSE_MS);

      if (chipId === 'exit') {
        void onExitVr();
        return;
      }
      onVerb(chipId);
    },
    [markInteraction, onExitVr, onVerb],
  );

  const hitMeshNodes = useMemo(
    () =>
      CHIP_HIT_LAYOUT.map((chip) => (
        <mesh
          key={chip.id}
          position={chip.position}
          userData={{ chipId: chip.id }}
          ref={(node) => {
            if (!node) return;
            const list = hitMeshesRef.current;
            const idx = list.findIndex((m) => m.userData.chipId === chip.id);
            if (idx >= 0) list[idx] = node;
            else list.push(node);
          }}
        >
          <boxGeometry args={[CHIP_HIT_WIDTH, CHIP_HIT_HEIGHT, CHIP_HIT_DEPTH]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )),
    [],
  );

  useEffect(() => {
    if (!isActive) {
      dwellElapsedRef.current = 0;
      dwellTargetRef.current = null;
      domHoverRef.current = null;
      setDwellTarget(null);
      setDwellProgress(0);
      menuOpacityRef.current = VR_MENU_ACTIVE_OPACITY;
      setMenuOpacity(VR_MENU_ACTIVE_OPACITY);
      return undefined;
    }

    markInteraction();

    const renderer = gl as unknown as WebGPURenderer;
    const attachSelect = () => {
      const session = renderer.xr?.getSession();
      if (!session) return undefined;

      const onSelect = (event: XRInputSourceEvent) => {
        const refSpace = renderer.xr?.getReferenceSpace();
        if (!refSpace) return;

        markInteraction();
        const chipId = raycastFromInputSource(
          event.inputSource,
          event.frame,
          refSpace,
          hitMeshesRef.current,
        );
        if (chipId) activateChip(chipId);
      };

      session.addEventListener('select', onSelect);
      return () => session.removeEventListener('select', onSelect);
    };

    let detachSelect = attachSelect();
    const retry = window.setInterval(() => {
      if (detachSelect) return;
      detachSelect = attachSelect();
    }, 250);

    return () => {
      window.clearInterval(retry);
      detachSelect?.();
    };
  }, [activateChip, gl, isActive, markInteraction]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !isActive) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() >= 1e-6) {
      forward.normalize();
      const target = camera.position.clone().add(forward.multiplyScalar(1.2));
      target.y = camera.position.y - 0.35;
      group.position.lerp(target, 0.08);
      group.lookAt(camera.position.x, group.position.y, camera.position.z);
    }

    const renderer = gl as unknown as WebGPURenderer;
    const session = renderer.xr?.getSession();
    const frame = renderer.xr?.getFrame() ?? null;
    const refSpace = renderer.xr?.getReferenceSpace() ?? null;

    let xrTarget: LocomotionChipId | null = null;
    if (session && frame && refSpace && hitMeshesRef.current.length > 0) {
      collectVrMenuRays(session, frame, refSpace, camera, raysScratchRef.current);
      xrTarget = raycastLocomotionChip(hitMeshesRef.current, raysScratchRef.current);
    }

    const combinedTarget = domHoverRef.current ?? xrTarget;

    if (combinedTarget) {
      markInteraction();
      if (combinedTarget === dwellTargetRef.current) {
        if (!reducedMotion) {
          dwellElapsedRef.current += delta * 1000;
          const progress = Math.min(1, dwellElapsedRef.current / VR_GAZE_DWELL_MS);
          setDwellProgress(progress);
          if (dwellElapsedRef.current >= VR_GAZE_DWELL_MS) {
            activateChip(combinedTarget);
          }
        }
      } else {
        dwellTargetRef.current = combinedTarget;
        dwellElapsedRef.current = 0;
        setDwellTarget(combinedTarget);
        setDwellProgress(0);
      }
    } else if (dwellTargetRef.current !== null) {
      dwellTargetRef.current = null;
      dwellElapsedRef.current = 0;
      setDwellTarget(null);
      setDwellProgress(0);
    }

    const idleMs = performance.now() - lastInteractionRef.current;
    const targetOpacity =
      idleMs >= VR_MENU_IDLE_FADE_MS ? VR_MENU_IDLE_OPACITY : VR_MENU_ACTIVE_OPACITY;
    menuOpacityRef.current = THREE.MathUtils.lerp(menuOpacityRef.current, targetOpacity, 0.12);
    setMenuOpacity(menuOpacityRef.current);
  });

  if (!isActive || !isControlEnabled) return null;

  const verbChips: LocomotionVerb[] = ['walk', 'run', 'fly', 'land'];

  return (
    <group ref={groupRef}>
      {hitMeshNodes}
      <Html
        center
        distanceFactor={1.4}
        transform
        occlude={false}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
        zIndexRange={[40, 0]}
      >
        <div
          role="toolbar"
          aria-label="Locomotion"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            opacity: menuOpacity,
            transition: reducedMotion ? undefined : 'opacity 0.35s ease',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
            {verbChips.map((verb) => {
              const active =
                (verb === 'fly' && isFlying) ||
                (verb === 'land' && isFlying) ||
                (verb === 'run' && vrRunLatch && !isFlying) ||
                (verb === 'walk' && !isFlying && !vrRunLatch);
              const isTarget = dwellTarget === verb;
              return (
                <button
                  key={verb}
                  type="button"
                  style={chipStyleFor(
                    active,
                    isTarget,
                    isTarget ? dwellProgress : 0,
                    pulseChip === verb,
                  )}
                  onPointerEnter={() => {
                    domHoverRef.current = verb;
                    markInteraction();
                  }}
                  onPointerLeave={() => {
                    if (domHoverRef.current === verb) domHoverRef.current = null;
                  }}
                  onClick={() => activateChip(verb)}
                >
                  {chipLabel(verb)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            style={{
              ...chipStyleFor(
                false,
                dwellTarget === 'exit',
                dwellTarget === 'exit' ? dwellProgress : 0,
                pulseChip === 'exit',
              ),
              cursor: isExiting || isEntering ? 'wait' : 'pointer',
              opacity: isExiting || isEntering ? 0.6 : 1,
            }}
            onPointerEnter={() => {
              domHoverRef.current = 'exit';
              markInteraction();
            }}
            onPointerLeave={() => {
              if (domHoverRef.current === 'exit') domHoverRef.current = null;
            }}
            onClick={() => activateChip('exit')}
            disabled={isExiting || isEntering}
            aria-label="Exit VR"
          >
            EXIT
          </button>
        </div>
      </Html>
    </group>
  );
}
