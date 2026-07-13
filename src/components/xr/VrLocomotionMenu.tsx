import { useRef, type CSSProperties } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { useGameStore } from '../../core/store/gameStore';
import { useVrStore } from '../../core/store/vrStore';
import { VR_GAZE_DWELL_MS } from '../../config/vrProfile';

type LocomotionVerb = 'walk' | 'run' | 'fly' | 'land';

const CHIP_STYLE: CSSProperties = {
  fontFamily: 'Cousine, monospace',
  fontSize: '0.65rem',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '4px',
  padding: '6px 10px',
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'color 0.2s ease, background 0.2s ease',
};

const CHIP_ACTIVE: CSSProperties = {
  color: '#ffffff',
  background: 'rgba(255,255,255,0.14)',
};

/**
 * World-anchored locomotion ring stub (PRD §2.5.2).
 * Pinch/click maps the four verbs; dwell highlight is a v1.1 polish pass.
 */
export function VrLocomotionMenu() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const isActive = useVrStore((state) => state.isActive);
  const vrRunLatch = useVrStore((state) => state.vrRunLatch);
  const setVrRunLatch = useVrStore((state) => state.setVrRunLatch);
  const setIsFlying = useGameStore((state) => state.setIsFlying);
  const isFlying = useGameStore((state) => state.isFlying);
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !isActive) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();

    const target = camera.position.clone().add(forward.multiplyScalar(1.2));
    target.y = camera.position.y - 0.35;
    group.position.lerp(target, 0.08);

    group.lookAt(camera.position.x, group.position.y, camera.position.z);
  });

  if (!isActive || !isControlEnabled) return null;

  const onVerb = (verb: LocomotionVerb) => {
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
  };

  return (
    <group ref={groupRef}>
      <Html
        center
        distanceFactor={1.4}
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
            opacity: 0.92,
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
            {(['walk', 'run', 'fly', 'land'] as const).map((verb) => {
              const label =
                verb === 'land' ? 'STOP FLYING' : verb.toUpperCase();
              const active =
                (verb === 'fly' && isFlying) ||
                (verb === 'land' && isFlying) ||
                (verb === 'run' && vrRunLatch && !isFlying) ||
                (verb === 'walk' && !isFlying && !vrRunLatch);
              return (
                <button
                  key={verb}
                  type="button"
                  style={{ ...CHIP_STYLE, ...(active ? CHIP_ACTIVE : {}) }}
                  onClick={() => onVerb(verb)}
                  title={`Dwell ${VR_GAZE_DWELL_MS}ms on Vision Pro (v1.1)`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Html>
    </group>
  );
}
