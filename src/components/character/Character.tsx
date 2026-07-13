import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CharacterProps, CHARACTER_CONFIG } from './config';
import { useCharacterAssets as useLicensedCharacterAssets } from './hooks/useCharacterAssets';
import { useStorytailorCharacterAssets } from './hooks/useStorytailorCharacterAssets';
import { useVoidCharacterAssets } from './hooks/useVoidCharacterAssets';
import { useVoidMotion } from './hooks/useVoidMotion';
import { STORYTAILOR } from '../../config/storytailor';
import {
  consumePendingCharacterTransform,
  useMeadowCharacterStore,
} from '../../core/store/meadowCharacterStore';
import { VOID_CHARACTER_SCALE, setVoidGlow } from './voidConfig';
import { useCharacterPhysics, CharacterPhysicsOptions } from './hooks/useCharacterPhysics';
import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CharacterAudio, CharacterAudioHandle, FlightLoopConfig } from './CharacterAudio';
import {
  MEADOW_VOID_FLIGHT_LOOP_PATH,
  MEADOW_VOID_FLIGHT_MOVE_SPEED_THRESHOLD,
} from '../../config/meadowAudio';

type CharacterAssetResult = ReturnType<typeof useLicensedCharacterAssets> & {
  helmetMaterials?: THREE.Material[];
};

type CharacterRigProps = CharacterProps & {
  assets: CharacterAssetResult;
  uWorldPos: { value: THREE.Vector3 };
  uFlightLift?: { value: number };
  physicsOptions?: CharacterPhysicsOptions;
  flightLoop?: FlightLoopConfig;
};

function CharacterRig({
  position = [0, 0, 0],
  scale = STORYTAILOR.useJqCharacter ? STORYTAILOR.characterScale : 1,
  visible = true,
  assets,
  uWorldPos,
  uFlightLift,
  physicsOptions,
  flightLoop,
}: CharacterRigProps) {
  const groupRef = useRef<Group>(null);
  const audioRef = useRef<CharacterAudioHandle>(null);

  const hasPrevFrameRef = useRef(false);
  const worldPosRef = useRef(new THREE.Vector3());
  const prevWorldPosRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());

  const uVelocity = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);

  const characterFlightLiftRef = useGameStore((state) => state.characterFlightLiftRef);
  const setCharacterRef = useGameStore((state) => state.setCharacterRef);
  const isFlying = useGameStore((state) => state.isFlying);
  const cameraMode = useGameStore((state) => state.cameraMode);

  const { scene, animations, helmets, helmetMaterials = [] } = assets;

  useCharacterPhysics(
    groupRef,
    scene,
    animations,
    (event) => {
      audioRef.current?.playStep(event.type, event.volume);
    },
    physicsOptions,
  );

  useEffect(() => {
    setCharacterRef(groupRef);
    // Live character switch: the incoming rig picks up exactly where the
    // outgoing one stood (meadowCharacterStore captures the transform before
    // the remount) — no teleport back to spawn.
    const pending = consumePendingCharacterTransform();
    if (pending && groupRef.current) {
      groupRef.current.position.copy(pending.position);
      groupRef.current.quaternion.copy(pending.quaternion);
    }
    return () => setCharacterRef(null);
  }, [setCharacterRef]);

  useEffect(() => {
    const shouldBeVisible = cameraMode !== CameraMode.FPV;
    if (helmetMaterials.length > 0) {
      helmetMaterials.forEach((mat) => {
        mat.visible = shouldBeVisible;
      });
      return;
    }
    helmets?.forEach((helmet) => {
      helmet.visible = shouldBeVisible;
    });
  }, [cameraMode, helmets, helmetMaterials]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.updateMatrixWorld(true);
    const worldPos = worldPosRef.current;
    worldPos.setFromMatrixPosition(groupRef.current.matrixWorld);

    uWorldPos.value.set(worldPos.x, worldPos.y, worldPos.z);

    const targetLift = isFlying ? CHARACTER_CONFIG.flightHoverLift : 0;
    if (uFlightLift) {
      uFlightLift.value = THREE.MathUtils.lerp(uFlightLift.value, targetLift, 0.12);
      characterFlightLiftRef.current = uFlightLift.value;
    } else {
      characterFlightLiftRef.current = 0;
    }

    if (hasPrevFrameRef.current) {
      const velocity = velocityRef.current;
      velocity.subVectors(worldPos, prevWorldPosRef.current);
      if (delta > 0) velocity.divideScalar(delta);
      uVelocity.value.set(velocity.x, velocity.y, velocity.z);
    } else {
      uVelocity.value.set(0, 0, 0);
      hasPrevFrameRef.current = true;
    }

    prevWorldPosRef.current.copy(worldPos);
  });

  if (!scene) return null;

  return (
    <group ref={groupRef} position={position} scale={scale} visible={visible} dispose={null}>
      <primitive object={scene} />
      <CharacterAudio ref={audioRef} flightLoop={flightLoop} />
    </group>
  );
}

function LicensedCharacter(props: CharacterProps) {
  const uWorldPos = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);
  const assets = useLicensedCharacterAssets(uWorldPos);
  return (
    <CharacterRig
      {...props}
      assets={{ ...assets, helmetMaterials: [] }}
      uWorldPos={uWorldPos}
    />
  );
}

function JqCharacter(props: CharacterProps) {
  const uWorldPos = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);
  const uFlightLift = useMemo(() => uniform(0), []);
  const assets = useStorytailorCharacterAssets(uWorldPos, uFlightLift);
  return (
    <CharacterRig
      {...props}
      assets={assets}
      uWorldPos={uWorldPos}
      uFlightLift={uFlightLift}
    />
  );
}

/**
 * The Void (ORBY) — LOCAL ONLY until owner approval (meadowCharacter.ts /
 * meadowCharacterStore). Shares the physics rig; wings/glow/flight-secondary
 * motion run in useVoidMotion on top of it.
 */
function VoidCharacter(props: CharacterProps) {
  const uWorldPos = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);
  const uFlightLift = useMemo(() => uniform(0), []);
  const assets = useVoidCharacterAssets(uWorldPos, uFlightLift);
  useVoidMotion(assets);

  useEffect(() => {
    const w = window as unknown as {
      __setVoidGlow?: (on: boolean) => void;
      __voidAssets?: unknown;
    };
    w.__setVoidGlow = setVoidGlow;
    // local-only debug handle for verification scripts (never shipped — the
    // whole component is behind ?character=void)
    w.__voidAssets = assets;
    return () => {
      delete w.__setVoidGlow;
      delete w.__voidAssets;
    };
  }, [assets]);

  return (
    <CharacterRig
      {...props}
      // Callers pass the JQ-tuned scale; the ORBY export is ~6cm tall and
      // needs its own (voidConfig).
      scale={VOID_CHARACTER_SCALE}
      assets={assets}
      uWorldPos={uWorldPos}
      uFlightLift={uFlightLift}
      // Held pose2 float is a large shape change — ease over ~0.6s in and out
      // (owner: natural, settling transitions; never a pop).
      physicsOptions={{ flightBlendLerpFactor: 0.06 }}
      // Owner: Void's loop plays only while MOVING in flight — silent hover.
      flightLoop={{
        path: MEADOW_VOID_FLIGHT_LOOP_PATH,
        moveSpeedThreshold: MEADOW_VOID_FLIGHT_MOVE_SPEED_THRESHOLD,
      }}
    />
  );
}

export function Character(props: CharacterProps) {
  // Reactive: the character switcher swaps this live (remount under the
  // WorldController Suspense; the name overlay covers the swap).
  const activeCharacter = useMeadowCharacterStore((state) => state.activeCharacter);

  if (activeCharacter === 'void') {
    return <VoidCharacter {...props} />;
  }
  if (STORYTAILOR.useJqCharacter) {
    return <JqCharacter {...props} />;
  }
  return <LicensedCharacter {...props} />;
}
