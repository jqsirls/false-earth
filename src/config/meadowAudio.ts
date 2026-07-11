import { AudioLoader } from 'three'
import { AudioContext as ThreeAudioContext } from 'three/webgpu'

/** Cross-origin anonymous — required when audio loads from CDN or `/meadow-assets` rewrite. */
export function configureCdnAudioLoader(loader: AudioLoader): AudioLoader {
  loader.setCrossOrigin('anonymous')
  return loader
}

/** Footstep one-shots ship with the Vercel bundle (not CDN) — same-origin paths only. */
export const MEADOW_FOOTSTEP_PATHS = [
  '/audio/fs_grass1.mp3',
  '/audio/fs_grass2.mp3',
  '/audio/fs_grass3.mp3',
  '/audio/fs_grass4.mp3',
  '/audio/fs_grass5.mp3',
] as const

/** Upstream false-earth ambient wind bed — bundled same-origin, layered under Cosmic Lullaby BGM. */
export const MEADOW_AMBIENT_TRACKS = [
  { id: 'grass_field', url: '/audio/grass_field.mp3', volume: 1.5 },
  { id: 'noise', url: '/audio/noise.mp3', volume: 0.1 },
] as const

/** Wind/ambient duck when Cosmic Lullaby BGM is playing (40% reduction). */
export const MEADOW_WIND_DUCK_MULTIPLIER = 0.6

/** Resume Web Audio on a user gesture — required before footsteps can play. */
export async function resumeMeadowAudioContext(
  listener?: { context: AudioContext } | null,
): Promise<void> {
  const ctx = listener?.context ?? ThreeAudioContext.getContext()
  if (!ctx || ctx.state !== 'suspended') return
  await ctx.resume().catch(() => {})
}
