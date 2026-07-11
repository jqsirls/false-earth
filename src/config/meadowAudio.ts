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

/**
 * Upstream false-earth ambient wind bed — bundled same-origin, layered under
 * Cosmic Lullaby BGM. Owner mix (2026-07-11): air is audible but secondary —
 * base wind runs at 60% of its original level (grass_field 1.5→0.9,
 * noise 0.1→0.06) so footsteps and the orb chime read clearly over it.
 */
export const MEADOW_AMBIENT_TRACKS = [
  { id: 'grass_field', url: '/audio/grass_field.mp3', volume: 0.9 },
  { id: 'noise', url: '/audio/noise.mp3', volume: 0.06 },
] as const

/**
 * Extra wind duck while Cosmic Lullaby is audibly playing. Base is already at
 * 60%, so this lands the under-BGM wind at ~45% of the original full level.
 */
export const MEADOW_WIND_DUCK_MULTIPLIER = 0.75

/**
 * Footstep one-shot gain multiplier (owner: walking must be clearly heard).
 * Samples peak at −25.4…−18.0 dB, so 1.75× (+4.9 dB) worst-cases at −13.1 dB —
 * no clipping headroom risk.
 */
export const MEADOW_FOOTSTEP_GAIN = 1.75

/** Orb collect chime (orb-sfx.mp3 peaks −7.3 dB): clearly present under BGM, soft attack kept. */
export const MEADOW_ORB_CHIME_DUCKED = 0.58
export const MEADOW_ORB_CHIME_SOLO = 0.75

/** Cosmic beam hit one-shot (wave01.mp3 peaks −11.6 dB). */
export const MEADOW_BEAM_HIT_VOLUME = 0.65

/** Read-only mix table for programmatic production verification (Playwright). */
declare global {
  interface Window {
    __MEADOW_MIX__?: Readonly<Record<string, number>>
  }
}
if (typeof window !== 'undefined') {
  window.__MEADOW_MIX__ = Object.freeze({
    windGrassField: MEADOW_AMBIENT_TRACKS[0].volume,
    windNoise: MEADOW_AMBIENT_TRACKS[1].volume,
    windDuck: MEADOW_WIND_DUCK_MULTIPLIER,
    footstepGain: MEADOW_FOOTSTEP_GAIN,
    orbChimeDucked: MEADOW_ORB_CHIME_DUCKED,
    orbChimeSolo: MEADOW_ORB_CHIME_SOLO,
    beamHit: MEADOW_BEAM_HIT_VOLUME,
  })
}

/** Resume Web Audio on a user gesture — required before footsteps can play. */
export async function resumeMeadowAudioContext(
  listener?: { context: AudioContext } | null,
): Promise<void> {
  const ctx = listener?.context ?? ThreeAudioContext.getContext()
  if (!ctx || ctx.state !== 'suspended') return
  await ctx.resume().catch(() => {})
}
