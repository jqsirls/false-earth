import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three/webgpu';
import {
  Fn,
  vec3,
  vec4,
  float,
  positionLocal,
  modelWorldMatrix,
  cameraViewMatrix,
  cameraProjectionMatrix,
} from 'three/tsl';
import { getTerrainHeight } from '../../../core/shaders/terrainHelpers';
import { uTerrainAmp, uTerrainFreq, uTerrainSeed } from '../../../core/shaders/uniforms';
import { shouldUseMinimalScene } from '../../../core/utils/browserCaps';
import { configureCdnTextureLoader } from '../../../core/utils/cdnTextureLoader';
import {
  VOID_MESH_PARTS,
  VOID_MODEL_PATHS,
  VOID_LOCOMOTION_CLIP_NAMES,
  VOID_WING_NODES,
  getVoidPartTexturePaths,
  type VoidMeshPart,
} from '../voidConfig';

/**
 * The Void (ORBY) asset loading — LOCAL ONLY, mounted exclusively behind
 * ?character=void (see meadowCharacter.ts). Mirrors the Booster/JQ hook:
 * one skinned model GLB + animation-only clip GLBs + runtime PNG textures
 * bound by material name. Each wing is rigid-skinned 100% to a dedicated
 * VOID_wing* bone under Spine2 — anchored to the back through every clip,
 * warp-proof, and fluttered procedurally by rotating those bones
 * (useVoidMotion).
 */

type PartTextureMaps = {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  alphaMap?: THREE.Texture;
};

function configureTexture(tex: THREE.Texture, colorSpace: THREE.ColorSpace) {
  tex.colorSpace = colorSpace;
  tex.flipY = false;
  return tex;
}

function buildVoidPartMaterial(
  part: VoidMeshPart,
  maps: PartTextureMaps,
  vertexNode?: ReturnType<typeof Fn>,
): THREE.MeshStandardNodeMaterial {
  const isWings = part === 'bwings';
  const mat = new THREE.MeshStandardNodeMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    emissiveMap: maps.emissiveMap,
    alphaMap: maps.alphaMap,
    metalness: maps.metalnessMap ? 1 : 0.3,
    roughness: maps.roughnessMap ? 1 : 0.55,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: maps.emissiveMap ? 1 : 0,
    transparent: Boolean(maps.alphaMap),
    alphaTest: maps.alphaMap ? 0.35 : 0,
    // wing membranes must read from both sides
    side: isWings ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (vertexNode) mat.vertexNode = vertexNode;
  return mat;
}

function useVoidPartTextures(part: VoidMeshPart): PartTextureMaps {
  const paths = getVoidPartTexturePaths(part);
  const textureEntries = useMemo(() => {
    const entries: { key: keyof PartTextureMaps; url: string }[] = [];
    const add = (key: keyof PartTextureMaps, url?: string) => {
      if (url) entries.push({ key, url });
    };
    add('map', paths.map);
    add('normalMap', paths.normalMap);
    add('roughnessMap', paths.roughnessMap);
    add('metalnessMap', paths.metalnessMap);
    add('emissiveMap', paths.emissiveMap);
    add('alphaMap', paths.alphaMap);
    return entries;
  }, [paths]);

  const urls = useMemo(() => textureEntries.map((entry) => entry.url), [textureEntries]);
  const loadedTextures = useLoader(TextureLoader, urls, configureCdnTextureLoader) as THREE.Texture[];

  return useMemo(() => {
    const loaded: Record<string, THREE.Texture> = {};
    textureEntries.forEach((entry, index) => {
      loaded[entry.key] = loadedTextures[index];
    });
    return {
      map: loaded.map ? configureTexture(loaded.map, THREE.SRGBColorSpace) : undefined,
      normalMap: loaded.normalMap
        ? configureTexture(loaded.normalMap, THREE.NoColorSpace)
        : undefined,
      roughnessMap: loaded.roughnessMap
        ? configureTexture(loaded.roughnessMap, THREE.NoColorSpace)
        : undefined,
      metalnessMap: loaded.metalnessMap
        ? configureTexture(loaded.metalnessMap, THREE.NoColorSpace)
        : undefined,
      emissiveMap: loaded.emissiveMap
        ? configureTexture(loaded.emissiveMap, THREE.SRGBColorSpace)
        : undefined,
      alphaMap: loaded.alphaMap ? configureTexture(loaded.alphaMap, THREE.NoColorSpace) : undefined,
    };
  }, [textureEntries, loadedTextures]);
}

function useVoidTextureSets(): Record<VoidMeshPart, PartTextureMaps> {
  const orby = useVoidPartTextures('orby');
  const stom = useVoidPartTextures('stom');
  const Eyes = useVoidPartTextures('Eyes');
  const lens = useVoidPartTextures('lens');
  const bwings = useVoidPartTextures('bwings');

  return useMemo(() => ({ orby, stom, Eyes, lens, bwings }), [orby, stom, Eyes, lens, bwings]);
}

/** Feet on local Y=0. Upright orientation is baked in Blender export — never rotate skinned roots. */
function alignVoidSceneToGround(scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  scene.position.y -= box.min.y;
  scene.userData.voidGroundY = scene.position.y;
}

/** Mixamo translation tracks fight physics — strip root on all clips; all position on locomotion. */
const ROOT_POSITION_BONE_KEYS = ['mixamorigHips', 'mixamorig:Hips', 'Hips', 'hips', 'root', 'pelvis'];

function isRootPositionTrack(trackName: string): boolean {
  if (!trackName.endsWith('.position')) return false;
  const boneName = trackName.slice(0, -'.position'.length);
  return ROOT_POSITION_BONE_KEYS.some(
    (key) => boneName === key || boneName.endsWith(`:${key}`) || boneName.endsWith(key),
  );
}

function sanitizeClipTracks(clip: THREE.AnimationClip): void {
  const locomotion = !clip.name.startsWith('Idle');
  clip.tracks = clip.tracks.filter((track) => {
    if (!track.name.endsWith('.position')) return true;
    if (locomotion) return false;
    return !isRootPositionTrack(track.name);
  });
}

function extractClip(
  gltf: { animations?: THREE.AnimationClip[] },
  name: string,
): THREE.AnimationClip | null {
  const clip = gltf.animations?.[0];
  if (!clip) return null;
  const cloned = clip.clone();
  cloned.name = name;
  sanitizeClipTracks(cloned);
  return cloned;
}

function resolveVoidPart(material: THREE.Material): VoidMeshPart | null {
  const name = material.name.replace(/\.\d+$/, '');
  return (VOID_MESH_PARTS as readonly string[]).includes(name) ? (name as VoidMeshPart) : null;
}

export interface VoidCharacterAssets {
  scene: THREE.Object3D | null;
  animations: THREE.AnimationClip[];
  helmets: THREE.Mesh[];
  helmetMaterials: THREE.Material[];
  /** Rigid wing objects for procedural flutter (children of Spine2). */
  wingNodes: THREE.Object3D[];
  /** Emissive-bearing materials for the glow breath pulse. */
  glowMaterials: THREE.MeshStandardNodeMaterial[];
}

export function useVoidCharacterAssets(
  uWorldPos?: { value: THREE.Vector3 },
  uFlightLift?: { value: number },
): VoidCharacterAssets {
  const [
    meshData,
    idleAnim,
    walkAnim,
    runAnim,
    backAnim,
    flightAnim,
    observeIdleAnim,
    curiousIdleAnim,
  ] = useGLTF(VOID_MODEL_PATHS as unknown as string[]);
  const voidTextures = useVoidTextureSets();

  return useMemo((): VoidCharacterAssets => {
    if (!meshData?.scene || !uWorldPos) {
      return {
        scene: null,
        animations: [],
        helmets: [],
        helmetMaterials: [],
        wingNodes: [],
        glowMaterials: [],
      };
    }

    const clonedScene = SkeletonUtils.clone(meshData.scene as THREE.Object3D);
    const minimalScene = shouldUseMinimalScene();

    const vertexNode = minimalScene
      ? undefined
      : Fn(() => {
          const terrainHeightFn = getTerrainHeight(uTerrainAmp, uTerrainFreq, uTerrainSeed);
          const worldPos = modelWorldMatrix.mul(vec4(positionLocal, float(1.0))).xyz;
          const th = terrainHeightFn(uWorldPos.xz);
          const lift = uFlightLift ?? float(0.0);
          const displacedPos = vec3(worldPos.x, worldPos.y.add(th).add(lift), worldPos.z);
          const viewPos = cameraViewMatrix.mul(vec4(displacedPos, float(1.0)));
          return cameraProjectionMatrix.mul(viewPos);
        })();

    const glowMaterials: THREE.MeshStandardNodeMaterial[] = [];

    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.frustumCulled = false;

      const applyOne = (source: THREE.Material): THREE.Material => {
        const part = resolveVoidPart(source);
        if (!part) return source;
        const maps = voidTextures[part];
        if (!maps?.map) return source;
        const nodeMat = buildVoidPartMaterial(part, maps, vertexNode);
        if (maps.emissiveMap) glowMaterials.push(nodeMat);
        return nodeMat;
      };

      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => applyOne(mat));
      } else {
        child.material = applyOne(child.material);
      }
    });

            // The wing BONES share names with the skinned wing mesh nodes — the
            // flutter targets are the bones (children of Spine2), never the meshes.
            const wingNodes: THREE.Object3D[] = [];
            clonedScene.traverse((child) => {
              if (
                (child as THREE.Bone).isBone &&
                (VOID_WING_NODES as readonly string[]).includes(child.name)
              ) {
                wingNodes.push(child);
              }
            });

    alignVoidSceneToGround(clonedScene);

    {
      const box = new THREE.Box3().setFromObject(clonedScene);
      const size = box.getSize(new THREE.Vector3());
      console.info(
        `[VOID] The Void loaded — ${wingNodes.length}/4 wings, ${glowMaterials.length} glow materials, ` +
          `bbox=${size.x.toFixed(4)}x${size.y.toFixed(4)}x${size.z.toFixed(4)} minY=${box.min.y.toFixed(4)}`,
      );
    }

    const animSources = [
      { src: idleAnim, name: VOID_LOCOMOTION_CLIP_NAMES[0] },
      { src: walkAnim, name: VOID_LOCOMOTION_CLIP_NAMES[1] },
      { src: runAnim, name: VOID_LOCOMOTION_CLIP_NAMES[2] },
      { src: backAnim, name: VOID_LOCOMOTION_CLIP_NAMES[3] },
      { src: flightAnim, name: VOID_LOCOMOTION_CLIP_NAMES[4] },
      { src: observeIdleAnim, name: VOID_LOCOMOTION_CLIP_NAMES[5] },
      { src: curiousIdleAnim, name: VOID_LOCOMOTION_CLIP_NAMES[6] },
    ];

    const animations = animSources
      .map(({ src, name }) => extractClip(src, name))
      .filter((clip): clip is THREE.AnimationClip => clip !== null);

    if (animations.length < VOID_LOCOMOTION_CLIP_NAMES.length) {
      console.warn(
        `[VOID] Missing locomotion clips (${animations.length}/${VOID_LOCOMOTION_CLIP_NAMES.length})`,
      );
    }

    return {
      scene: clonedScene,
      animations,
      helmets: [],
      helmetMaterials: [],
      wingNodes,
      glowMaterials,
    };
  }, [
    meshData,
    idleAnim,
    walkAnim,
    runAnim,
    backAnim,
    flightAnim,
    observeIdleAnim,
    curiousIdleAnim,
    uWorldPos,
    uFlightLift,
    voidTextures,
  ]);
}
