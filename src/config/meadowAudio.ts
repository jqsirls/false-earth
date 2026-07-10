/** Footstep one-shots ship with the Vercel bundle (not CDN) — same-origin paths only. */
export const MEADOW_FOOTSTEP_PATHS = [
  '/audio/fs_grass1.mp3',
  '/audio/fs_grass2.mp3',
  '/audio/fs_grass3.mp3',
  '/audio/fs_grass4.mp3',
  '/audio/fs_grass5.mp3',
] as const

/** Resume Web Audio on a user gesture — required before BGM can play in production. */
export function resumeMeadowAudioContext(listener: { context: AudioContext } | null | undefined): void {
  const ctx = listener?.context
  if (!ctx || ctx.state !== 'suspended') return
  void ctx.resume().catch(() => {})
}
