/**
 * Meadow CDN asset resolution — standalone module (no imports from storytailor/meadow)
 * to avoid circular-init crashes in production bundles.
 */

const rawBase = (import.meta.env.VITE_MEADOW_ASSET_BASE as string | undefined)?.trim() ?? '';
const configuredBase = rawBase.replace(/\/$/, '');

/** Direct CDN — `/meadow-assets` Vercel rewrite can serve corrupt edge-cached bodies for large MP3s. */
const PRODUCTION_CDN_BASE = 'https://assets.storytailor.dev/meadow';

/**
 * Production loads heavy assets from CDN (CORS-enabled for booster.storytailor.com).
 * Local dev leaves the base empty so `public/` is used on localhost.
 */
export const MEADOW_ASSET_BASE =
  configuredBase || (import.meta.env.PROD ? PRODUCTION_CDN_BASE : '');

/** Resolve a `/public/…` path against MEADOW_ASSET_BASE when set. */
export function resolveMeadowAsset(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!MEADOW_ASSET_BASE) return normalized;
  return `${MEADOW_ASSET_BASE}${normalized}`;
}
