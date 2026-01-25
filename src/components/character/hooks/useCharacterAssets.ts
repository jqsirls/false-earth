import { useMemo, useRef, useEffect } from 'react';
import { useTexture, useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, float, positionLocal, modelWorldMatrix, cameraViewMatrix, cameraProjectionMatrix, oneMinus, texture, uv } from 'three/tsl';
import { getTerrainHeight } from '../../../core/shaders/terrainHelpers';
import { TerrainUniforms } from '../../../core/types';
import { BODY_MESH_NAMES, BODY_TEXTURE_PATHS, DETAIL_TEXTURE_PATHS } from '../config';

const configureTextures = (textures: any) => {
  textures.map.colorSpace = THREE.SRGBColorSpace;
  ['map', 'metalnessMap', 'aoMap', 'normalMap'].forEach(key => {
    if (textures[key]) textures[key].flipY = false;
  });
  return textures;
};

const extractClip = (gltf: any, name: string): THREE.AnimationClip | null => {
  if (!gltf?.animations?.[0]) return null;
  
  const clip = gltf.animations[0].clone();
  clip.name = name;
  return clip;
};

export function useCharacterAssets(terrainUniforms?: TerrainUniforms, uWorldPos?: any) {
  const { scene: mesh } = useGLTF('/models/Astronaut.glb');
  const idleAnim = useGLTF('/models/Idle.glb');
  // const idleAnim = useLoader(FBXLoader, '/models/Idle.fbx');
  const walkAnim = useGLTF('/models/Walking.glb');
  const runAnim = useGLTF('/models/Running.glb');

  const helmetRefs = useRef<THREE.Mesh[]>([]);

  const bodyTex = configureTextures(useTexture(BODY_TEXTURE_PATHS))
  const detailTex = configureTextures(useTexture(DETAIL_TEXTURE_PATHS));

  const { scene, animations } = useMemo(() => {
    if (!mesh || !bodyTex.map || !detailTex.map || !terrainUniforms || !uWorldPos) return { scene: null, animations: [] };

    const clonedScene = SkeletonUtils.clone(mesh as any);

    const vertexNode = Fn(() => {
      const terrainHeightFn = getTerrainHeight(
        terrainUniforms.uTerrainAmp,
        terrainUniforms.uTerrainFreq,
        terrainUniforms.uTerrainSeed
      );

      const worldPos = modelWorldMatrix.mul(vec4(positionLocal, float(1.0))).xyz;
      const th = terrainHeightFn(uWorldPos.xz);
      const displacedPos = vec3(worldPos.x, worldPos.y.add(th), worldPos.z);
      const viewPos = cameraViewMatrix.mul(vec4(displacedPos, float(1.0)));
      return cameraProjectionMatrix.mul(viewPos);
    })();

    // --- Material Setup ---
    const bodyMat = new THREE.MeshStandardNodeMaterial({
      map: bodyTex.map,
      aoMap: bodyTex.aoMap,
      normalMap: bodyTex.normalMap,
      metalnessMap: bodyTex.metalnessMap,
      metalness: 1,
    });
    bodyMat.roughnessNode = Fn(() => oneMinus(texture(bodyTex.metalnessMap, uv())))();
    bodyMat.vertexNode = vertexNode;

    const detailMat = new THREE.MeshStandardNodeMaterial({
      map: detailTex.map,
      aoMap: detailTex.aoMap,
      normalMap: detailTex.normalMap,
      metalnessMap: detailTex.metalnessMap,
      metalness: 1,
    })

    detailMat.roughnessNode = Fn(() => oneMinus(texture(detailTex.metalnessMap, uv())))();
    detailMat.vertexNode = vertexNode;

    // Assign materials based on mesh names and store all helmet references
    helmetRefs.current = [];
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.frustumCulled = false;

        if (BODY_MESH_NAMES.includes(child.name)) {
          child.material = bodyMat;
        } else if (child.name.includes('Helmet')) {
          child.material = detailMat;
          child.visible = true;
          helmetRefs.current.push(child);
        } else if (!child.name.includes('Person')) {
          child.material = detailMat;
        } else {
          child.visible = false;
        }
      }
    });

    // --- Animations Setup ---
    const animConfig = [
      { src: idleAnim, name: 'Idle' },
      { src: walkAnim, name: 'Walk' },
      { src: runAnim,  name: 'Run'  },
  ];

  const anims = animConfig.map(({ src, name }) => extractClip(src, name));

    return { scene: clonedScene, animations: anims, helmetRefs };
  }, [
    mesh,
    idleAnim,
    walkAnim,
    runAnim,
    bodyTex,
    detailTex,
    terrainUniforms,
    uWorldPos,
  ]);

  return { scene, animations, helmetRefs };
}
