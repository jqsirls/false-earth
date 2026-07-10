import { TextureLoader } from 'three';

/** Cross-origin anonymous — required for WebGPU textures from assets.storytailor.dev. */
export function configureCdnTextureLoader(loader: TextureLoader): TextureLoader {
  loader.setCrossOrigin('anonymous');
  return loader;
}

export function createCdnTextureLoader(): TextureLoader {
  return configureCdnTextureLoader(new TextureLoader());
}
