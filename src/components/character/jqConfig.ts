import { resolveMeadowAsset } from '../../config/meadow';
import { getJqTextureRoot } from '../../core/utils/browserCaps';

/** JQ astronaut mesh part names (Marmoset / Blender export). */
export const JQ_HELMET_MESH = 'astroboy_f';

export const JQ_MESH_PARTS = [
  'astroboy_f',
  'jumper',
  'strap',
  'glove',
  'pack',
  'boots',
] as const;

export type JqMeshPart = (typeof JQ_MESH_PARTS)[number];

function jqTex(part: string, file: string): string {
  return `${getJqTextureRoot()}/${part}/${file}`;
}

/** Maps mesh name -> runtime texture paths (jq or jq-lite on Safari). */
export function getJqPartTexturePaths(part: JqMeshPart): {
  map: string;
  normalMap: string;
  roughnessMap: string;
  metalnessMap: string;
  emissiveMap?: string;
  alphaMap?: string;
} {
  const paths: Record<JqMeshPart, ReturnType<typeof getJqPartTexturePaths>> = {
    astroboy_f: {
      map: jqTex('helmet', 'BaseColor.png'),
      normalMap: jqTex('helmet', 'Normal.png'),
      roughnessMap: jqTex('helmet', 'Roughness.png'),
      metalnessMap: jqTex('helmet', 'Metallic.png'),
      emissiveMap: jqTex('helmet', 'Emissive.png'),
      alphaMap: jqTex('helmet', 'Opacity.png'),
    },
    jumper: {
      map: jqTex('jumper', 'BaseColor.png'),
      normalMap: jqTex('jumper', 'Normal.png'),
      roughnessMap: jqTex('jumper', 'Roughness.png'),
      metalnessMap: jqTex('jumper', 'Metallic.png'),
      emissiveMap: jqTex('jumper', 'Emissive.png'),
      alphaMap: jqTex('jumper', 'Opacity.png'),
    },
    strap: {
      map: jqTex('strap', 'BaseColor.png'),
      normalMap: jqTex('strap', 'Normal.png'),
      roughnessMap: jqTex('strap', 'Roughness.png'),
      metalnessMap: jqTex('strap', 'Metallic.png'),
    },
    glove: {
      map: jqTex('glove', 'BaseColor.png'),
      normalMap: jqTex('glove', 'Normal.png'),
      roughnessMap: jqTex('glove', 'Roughness.png'),
      metalnessMap: jqTex('glove', 'Metallic.png'),
    },
    pack: {
      map: jqTex('pack', 'BaseColor.png'),
      normalMap: jqTex('pack', 'Normal.png'),
      roughnessMap: jqTex('pack', 'Roughness.png'),
      metalnessMap: jqTex('pack', 'Metallic.png'),
      emissiveMap: jqTex('pack', 'Emissive.png'),
    },
    boots: {
      map: jqTex('boots', 'BaseColor.png'),
      normalMap: jqTex('boots', 'Normal.png'),
      roughnessMap: jqTex('boots', 'Roughness.png'),
      metalnessMap: jqTex('boots', 'Metallic.png'),
    },
  };
  return paths[part];
}

/** @deprecated Use getJqPartTexturePaths(part) — static snapshot for non-Safari preload only */
export const JQ_PART_TEXTURE_PATHS = Object.fromEntries(
  (['astroboy_f', 'jumper', 'strap', 'glove', 'pack', 'boots'] as JqMeshPart[]).map((part) => [
    part,
    getJqPartTexturePaths(part),
  ]),
) as Record<JqMeshPart, ReturnType<typeof getJqPartTexturePaths>>;

/** JQ Mixamo locomotion + flight clip GLBs (animation-only, same skeleton as JQ_mixamo.glb). */
export const JQ_LOCOMOTION_ANIM_PATHS = [
  resolveMeadowAsset('/models/JQ_Idle.glb'),
  resolveMeadowAsset('/models/JQ_Walking.glb'),
  resolveMeadowAsset('/models/JQ_Running.glb'),
  resolveMeadowAsset('/models/JQ_WalkingBack.glb'),
  resolveMeadowAsset('/models/JQ_Flying.glb'),
] as const;

export const JQ_LOCOMOTION_CLIP_NAMES = ['Idle', 'Walk', 'Run', 'Back', 'Flight'] as const;
