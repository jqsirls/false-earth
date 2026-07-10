import { AudioLoader } from 'three'
import { AudioContext as ThreeAudioContext } from 'three'

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

/** Resume Web Audio on a user gesture — required before footsteps can play. */
export function resumeMeadowAudioContext(listener?: { context: AudioContext } | null): void {
  const ctx = listener?.context ?? ThreeAudioContext.getContext()
  if (!ctx || ctx.state !== 'suspended') return
  void ctx.resume().catch(() => {})
}
