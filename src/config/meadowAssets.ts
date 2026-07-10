/**
 * Meadow CDN asset resolution — standalone module (no imports from storytailor/meadow)
 * to avoid circular-init crashes in production bundles.
 */

export const MEADOW_ASSET_BASE =
  (import.meta.env.VITE_MEADOW_ASSET_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

/** Resolve a `/public/…` path against MEADOW_ASSET_BASE when set. */
export function resolveMeadowAsset(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!MEADOW_ASSET_BASE) return normalized;
  return `${MEADOW_ASSET_BASE}${normalized}`;
}
