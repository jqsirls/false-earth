/**
 * Meadow CDN asset resolution — standalone module (no imports from storytailor/meadow)
 * to avoid circular-init crashes in production bundles.
 */

const rawBase = (import.meta.env.VITE_MEADOW_ASSET_BASE as string | undefined)?.trim() ?? '';
const configuredBase = rawBase.replace(/\/$/, '');

/** Direct CDN — `/meadow-assets` Vercel rewrite breaks large crossOrigin texture loads (e.g. 21MB helmet Normal). */
const PRODUCTION_CDN_BASE = 'https://assets.storytailor.dev/meadow';

/**
 * Production always uses direct CDN (CORS-enabled for booster.storytailor.com).
 * The Vercel `/meadow-assets` rewrite is kept for legacy same-origin URLs but must not
 * be the runtime base — it fails on large PNG/MP3 bodies with crossOrigin anonymous.
 * Local dev leaves the base empty so `public/` is used on localhost.
 */
export const MEADOW_ASSET_BASE = import.meta.env.PROD
  ? PRODUCTION_CDN_BASE
  : configuredBase;

/** Resolve a `/public/…` path against MEADOW_ASSET_BASE when set. */
export function resolveMeadowAsset(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!MEADOW_ASSET_BASE) return normalized;
  return `${MEADOW_ASSET_BASE}${normalized}`;
}
