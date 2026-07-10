import { resolveMeadowAsset } from './meadowAssets';

export type ExperienceMode = 'default' | '404';

export const STORYTAILOR = {
  /** Use Storytailor-owned JQ astronaut instead of licensed CGTrader mesh. */
  useJqCharacter: true,
  /** Mixamo-rigged JQ astronaut; runtime PNGs in public/textures/jq/. */
  characterModel: resolveMeadowAsset('/models/JQ_mixamo.glb'),
  /** Mixamo export ~1.7m upright; 1.0 = true scale in-scene. */
  characterScale: 1.1,
  homeUrl: 'https://storytailor.com',
  /** Story-creation handoff when meadow CTA variant is make_story (PRD §4.1). */
  storyCreateUrl: 'https://storytailor.com/dashboard/s/select',
  brandName: 'Storytailor',
} as const;

export function getExperienceMode(): ExperienceMode {
  if (typeof window === 'undefined') return 'default';
  const mode = new URLSearchParams(window.location.search).get('mode');
  return mode === '404' ? '404' : 'default';
}

export function is404Mode(): boolean {
  return getExperienceMode() === '404';
}
