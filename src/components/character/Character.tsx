import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CharacterProps, CHARACTER_CONFIG } from './config';
import { useCharacterAssets as useLicensedCharacterAssets } from './hooks/useCharacterAssets';
import { useStorytailorCharacterAssets } from './hooks/useStorytailorCharacterAssets';
import { STORYTAILOR } from '../../config/storytailor';
import { useCharacterPhysics } from './hooks/useCharacterPhysics';
import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CharacterAudio, CharacterAudioHandle } from './CharacterAudio';

type CharacterAssetResult = ReturnType<typeof useLicensedCharacterAssets> & {
  helmetMaterials?: THREE.Material[];
};

type CharacterRigProps = CharacterProps & {
  assets: CharacterAssetResult;
  uWorldPos: { value: THREE.Vector3 };
  uFlightLift?: { value: number };
};

function CharacterRig({
  position = [0, 0, 0],
  scale = STORYTAILOR.useJqCharacter ? STORYTAILOR.characterScale : 1,
  visible = true,
  assets,
  uWorldPos,
  uFlightLift,
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

  useCharacterPhysics(groupRef, scene, animations, (event) => {
    audioRef.current?.playStep(event.type, event.volume);
  });

  useEffect(() => {
    setCharacterRef(groupRef);
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
      <CharacterAudio ref={audioRef} />
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

export function Character(props: CharacterProps) {
  if (STORYTAILOR.useJqCharacter) {
    return <JqCharacter {...props} />;
  }
  return <LicensedCharacter {...props} />;
}
