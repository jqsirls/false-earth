import { STORYTAILOR } from './storytailor';
import { resolveMeadowAsset } from './meadowAssets';

export { MEADOW_ASSET_BASE, resolveMeadowAsset } from './meadowAssets';

export const MEADOW_TITLE = "Booster's Meadow";

export const MEADOW_LOGO_PATH = resolveMeadowAsset('/booster-meadow-logo.png');

export const MEADOW_LOGO_ALT = "Booster's Meadow from Storytailor";

/** Empty string = dev console + CustomEvent only (no network ingest). */
export const MEADOW_ANALYTICS_URL =
  (import.meta.env.VITE_MEADOW_ANALYTICS_URL as string | undefined) ?? '';

/** Edge Function URL for meadow-auth (Memberstack + Supabase shadow). Empty until P2 backend ships. */
export const MEADOW_AUTH_URL =
  (import.meta.env.VITE_MEADOW_AUTH_URL as string | undefined) ?? '';

export const MEADOW_PLAYLIST_TRACKS = [
  { id: 'cosmic_lullaby_1', url: resolveMeadowAsset('/audio/cosmic-lullaby-1.mp3'), volume: 1 },
  { id: 'cosmic_lullaby_2', url: resolveMeadowAsset('/audio/cosmic-lullaby-2.mp3'), volume: 1 },
  { id: 'cosmic_lullaby_3', url: resolveMeadowAsset('/audio/cosmic-lullaby-3.mp3'), volume: 1 },
  { id: 'cosmic_lullaby_4', url: resolveMeadowAsset('/audio/cosmic-lullaby-4.mp3'), volume: 1 },
  { id: 'cosmic_lullaby_5', url: resolveMeadowAsset('/audio/cosmic-lullaby-5.mp3'), volume: 1 },
] as const;

export type MeadowCtaVariant = 'back' | 'make_story';

export type MeadowEntrySource =
  | 'storytailor_referrer'
  | 'from_param'
  | 'direct'
  | 'external_referrer';

const STORYTAILOR_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*storytailor\.com$/i;

export function isStorytailorHost(hostname: string): boolean {
  return STORYTAILOR_HOST_PATTERN.test(hostname);
}

export function detectMeadowEntrySource(): MeadowEntrySource {
  if (typeof window === 'undefined') return 'direct';

  const params = new URLSearchParams(window.location.search);
  if (params.get('from') === 'storytailor') return 'from_param';

  const referrer = document.referrer;
  if (!referrer) return 'direct';

  try {
    const refHost = new URL(referrer).hostname;
    if (isStorytailorHost(refHost)) return 'storytailor_referrer';
  } catch {
    // Ignore malformed referrer values.
  }

  return 'external_referrer';
}

/** Referrer-aware CTA variant. Defaults to make_story when ambiguous (PRD §4.1). */
export function detectMeadowCtaVariant(): MeadowCtaVariant {
  const entrySource = detectMeadowEntrySource();
  return entrySource === 'storytailor_referrer' || entrySource === 'from_param'
    ? 'back'
    : 'make_story';
}

export function getMeadowCtaLabel(variant: MeadowCtaVariant): string {
  return variant === 'back'
    ? `Back to ${STORYTAILOR.brandName}`
    : 'Make a story with Booster';
}

function appendInboundUtms(target: URL): void {
  if (typeof window === 'undefined') return;

  const inbound = new URLSearchParams(window.location.search);
  for (const [key, value] of inbound.entries()) {
    if (key.startsWith('utm_') && value && !target.searchParams.has(key)) {
      target.searchParams.set(key, value);
    }
  }
}

export function buildMeadowCtaUrl(variant: MeadowCtaVariant): string {
  const basePath =
    variant === 'back'
      ? STORYTAILOR.homeUrl
      : STORYTAILOR.storyCreateUrl;

  const url = new URL(basePath);
  url.searchParams.set('utm_source', 'meadow');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'booster_cta');
  url.searchParams.set('utm_content', variant === 'back' ? 'back' : 'make_story');
  appendInboundUtms(url);
  return url.toString();
}
