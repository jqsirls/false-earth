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
import { STORYTAILOR } from '../../../config/storytailor';
import { isSafari, shouldUseSafariMinimalScene } from '../../../core/utils/browserCaps';
import { configureCdnTextureLoader } from '../../../core/utils/cdnTextureLoader';
import {
  JQ_HELMET_MESH,
  JQ_LOCOMOTION_ANIM_PATHS,
  JQ_LOCOMOTION_CLIP_NAMES,
  getJqPartTexturePaths,
  type JqMeshPart,
} from '../jqConfig';

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

function buildPartMaterial(
  maps: PartTextureMaps,
  vertexNode?: ReturnType<typeof Fn>,
): THREE.MeshStandardNodeMaterial {
  const mat = new THREE.MeshStandardNodeMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap,
    emissiveMap: maps.emissiveMap,
    alphaMap: maps.alphaMap,
    metalness: maps.metalnessMap ? 1 : 0.35,
    roughness: maps.roughnessMap ? 1 : 0.55,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: maps.emissiveMap ? 1 : 0,
    transparent: Boolean(maps.alphaMap),
    alphaTest: maps.alphaMap ? 0.4 : 0,
    side: THREE.FrontSide,
  });
  if (vertexNode) mat.vertexNode = vertexNode;
  return mat;
}

function materialFromGltf(
  source: THREE.Material,
  vertexNode?: ReturnType<typeof Fn>,
): THREE.MeshStandardNodeMaterial | null {
  if (!(source instanceof THREE.MeshStandardMaterial)) return null;

  if (source.map) configureTexture(source.map, THREE.SRGBColorSpace);
  if (source.normalMap) configureTexture(source.normalMap, THREE.NoColorSpace);
  if (source.roughnessMap) configureTexture(source.roughnessMap, THREE.NoColorSpace);
  if (source.metalnessMap) configureTexture(source.metalnessMap, THREE.NoColorSpace);
  if (source.emissiveMap) configureTexture(source.emissiveMap, THREE.SRGBColorSpace);
  if (source.alphaMap) configureTexture(source.alphaMap, THREE.NoColorSpace);

  return buildPartMaterial(
    {
      map: source.map ?? undefined,
      normalMap: source.normalMap ?? undefined,
      roughnessMap: source.roughnessMap ?? undefined,
      metalnessMap: source.metalnessMap ?? undefined,
      emissiveMap: source.emissiveMap ?? undefined,
      alphaMap: source.alphaMap ?? undefined,
    },
    vertexNode,
  );
}

function useJqPartTextures(part: JqMeshPart): PartTextureMaps {
  const paths = getJqPartTexturePaths(part);
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

  const loaded = useMemo(() => {
    const result: Record<string, THREE.Texture> = {};
    textureEntries.forEach((entry, index) => {
      result[entry.key] = loadedTextures[index];
    });
    return result;
  }, [textureEntries, loadedTextures]);

  return useMemo(
    () => ({
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
    }),
    [
      loaded.map,
      loaded.normalMap,
      loaded.roughnessMap,
      loaded.metalnessMap,
      loaded.emissiveMap,
      loaded.alphaMap,
    ],
  );
}

function useJqTextureSets(): Record<JqMeshPart, PartTextureMaps> {
  const astroboy_f = useJqPartTextures('astroboy_f');
  const jumper = useJqPartTextures('jumper');
  const strap = useJqPartTextures('strap');
  const glove = useJqPartTextures('glove');
  const pack = useJqPartTextures('pack');
  const boots = useJqPartTextures('boots');

  return useMemo(
    () => ({ astroboy_f, jumper, strap, glove, pack, boots }),
    [astroboy_f, jumper, strap, glove, pack, boots],
  );
}

/** Feet on local Y=0. Upright orientation is baked in Blender export — never rotate skinned roots. */
function alignJqSceneToGround(scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  scene.position.y -= box.min.y;
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
  const locomotion = clip.name !== 'Idle';
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

function resolvePartName(material: THREE.Material): JqMeshPart | null {
  const name = material.name.toLowerCase().replace(/\.\d+$/, '');
  if (name === 'astroboy_f' || name === 'jumper' || name === 'strap' || name === 'glove' || name === 'pack' || name === 'boots') {
    return name;
  }
  return null;
}

function applyMeshMaterials(
  mesh: THREE.Mesh,
  jqTextures: Record<JqMeshPart, PartTextureMaps>,
  vertexNode: ReturnType<typeof Fn> | undefined,
  helmetMaterials: THREE.Material[],
): void {
  mesh.frustumCulled = false;

  const applyOne = (source: THREE.Material): THREE.Material => {
    const partName = resolvePartName(source);
    if (!partName) {
      return source instanceof THREE.MeshStandardMaterial
        ? materialFromGltf(source, vertexNode) ?? source
        : source;
    }

    const runtimeMaps = jqTextures[partName];
    if (runtimeMaps?.map) {
      const nodeMat = buildPartMaterial(runtimeMaps, vertexNode);
      if (partName === JQ_HELMET_MESH) {
        helmetMaterials.push(nodeMat);
      }
      return nodeMat;
    }

    const fallback = materialFromGltf(source, vertexNode);
    if (fallback && partName === JQ_HELMET_MESH) {
      helmetMaterials.push(fallback);
    }
    return fallback ?? source;
  };

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => applyOne(mat));
  } else {
    mesh.material = applyOne(mesh.material);
  }
}

const JQ_MODEL_PATHS = [STORYTAILOR.characterModel, ...JQ_LOCOMOTION_ANIM_PATHS] as const;

export function useStorytailorCharacterAssets(
  uWorldPos?: { value: THREE.Vector3 },
  uFlightLift?: { value: number },
) {
  const [meshData, idleAnim, walkAnim, runAnim, backAnim, flightAnim] = useGLTF(JQ_MODEL_PATHS);
  const jqTextures = useJqTextureSets();

  const { scene, animations, helmets, helmetMaterials } = useMemo((): {
    scene: THREE.Object3D | null;
    animations: THREE.AnimationClip[];
    helmets: THREE.Mesh[];
    helmetMaterials: THREE.Material[];
  } => {
    if (!meshData?.scene || !uWorldPos) {
      return { scene: null, animations: [], helmets: [], helmetMaterials: [] };
    }

    const helmetMaterialsAcc: THREE.Material[] = [];
    const clonedScene = SkeletonUtils.clone(meshData.scene as THREE.Object3D);

    const safariMinimal = shouldUseSafariMinimalScene();

    const vertexNode = safariMinimal
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

    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      applyMeshMaterials(child, jqTextures, vertexNode, helmetMaterialsAcc);
    });

    console.info(`[JQ] Mixamo rig + runtime PNG textures from ${isSafari() ? '/textures/jq-lite/' : '/textures/jq/'}`);

    alignJqSceneToGround(clonedScene);

    const animSources = [
      { src: idleAnim, name: JQ_LOCOMOTION_CLIP_NAMES[0] },
      { src: walkAnim, name: JQ_LOCOMOTION_CLIP_NAMES[1] },
      { src: runAnim, name: JQ_LOCOMOTION_CLIP_NAMES[2] },
      { src: backAnim, name: JQ_LOCOMOTION_CLIP_NAMES[3] },
      { src: flightAnim, name: JQ_LOCOMOTION_CLIP_NAMES[4] },
    ];

    const animations = animSources
      .map(({ src, name }) => extractClip(src, name))
      .filter((clip): clip is THREE.AnimationClip => clip !== null);

    if (animations.length < JQ_LOCOMOTION_CLIP_NAMES.length) {
      console.warn(
        `[JQ] Missing locomotion clips (${animations.length}/${JQ_LOCOMOTION_CLIP_NAMES.length})`,
      );
    }

    return {
      scene: clonedScene,
      animations,
      helmets: [] as THREE.Mesh[],
      helmetMaterials: helmetMaterialsAcc,
    };
  }, [meshData, idleAnim, walkAnim, runAnim, backAnim, flightAnim, uWorldPos, uFlightLift, jqTextures]);

  return { scene, animations, helmets, helmetMaterials };
}
