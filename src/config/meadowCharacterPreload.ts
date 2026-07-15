import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { getJqPartTexturePaths, JQ_LOCOMOTION_ANIM_PATHS } from '../components/character/jqConfig';
import { VOID_MESH_PARTS, VOID_MODEL_PATHS, getVoidPartTexturePaths } from '../components/character/voidConfig';
import { configureCdnTextureLoader } from '../core/utils/cdnTextureLoader';
import { STORYTAILOR } from './storytailor';
import {
  type MeadowCharacterId,
  otherMeadowCharacter,
} from './meadowCharacter';

function collectJqTexturePaths(): string[] {
  const paths = new Set<string>();

  for (const part of ['astroboy_f', 'jumper', 'strap', 'glove', 'pack', 'boots'] as const) {
    const tex = getJqPartTexturePaths(part);
    paths.add(tex.map);
    paths.add(tex.normalMap);
    paths.add(tex.roughnessMap);
    paths.add(tex.metalnessMap);
    if (tex.emissiveMap) paths.add(tex.emissiveMap);
    if (tex.alphaMap) paths.add(tex.alphaMap);
  }

  return [...paths];
}

function collectVoidTexturePaths(): string[] {
  const paths = new Set<string>();

  for (const part of VOID_MESH_PARTS) {
    const tex = getVoidPartTexturePaths(part);
    paths.add(tex.map);
    paths.add(tex.normalMap);
    paths.add(tex.roughnessMap);
    if (tex.metalnessMap) paths.add(tex.metalnessMap);
    if (tex.emissiveMap) paths.add(tex.emissiveMap);
    if (tex.alphaMap) paths.add(tex.alphaMap);
  }

  return [...paths];
}

const preloadStarted: Record<MeadowCharacterId, boolean> = {
  jq: false,
  void: false,
};

/** Module-scope GLB + texture preload for a playable character rig. */
export function preloadMeadowCharacter(id: MeadowCharacterId): void {
  if (preloadStarted[id]) return;
  preloadStarted[id] = true;

  if (id === 'void') {
    useGLTF.preload([...VOID_MODEL_PATHS]);
    useLoader.preload(TextureLoader, collectVoidTexturePaths(), configureCdnTextureLoader);
    return;
  }

  if (STORYTAILOR.useJqCharacter) {
    useGLTF.preload([STORYTAILOR.characterModel, ...JQ_LOCOMOTION_ANIM_PATHS]);
    useLoader.preload(TextureLoader, collectJqTexturePaths(), configureCdnTextureLoader);
  }
}

/** Warm the inactive character during idle time (About modal easter egg path). */
export function preloadInactiveMeadowCharacter(active: MeadowCharacterId): void {
  preloadMeadowCharacter(otherMeadowCharacter(active));
}

/** Schedule inactive-character preload without blocking the UI thread. */
export function scheduleInactiveMeadowCharacterPreload(active: MeadowCharacterId): void {
  const run = () => preloadInactiveMeadowCharacter(active);

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 4000 });
    return;
  }

  window.setTimeout(run, 120);
}
