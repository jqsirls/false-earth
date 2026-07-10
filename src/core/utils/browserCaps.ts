import { DEFAULT_BLADES_PER_AXIS } from '../../components/grass/core/config';
import { resolveMeadowAsset } from '../../config/meadow';

/** Safari WebGPU is supported but more memory-sensitive — cap DPR and texture budget. */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua);
}

export function getInitialDpr(): number {
  if (typeof window === 'undefined') return 1.5;
  if (isSafari()) return 1;
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

export function getSafariCompileTimeoutMs(): number {
  return 20000;
}

export function getDefaultCompileTimeoutMs(): number {
  return 3000;
}

/** Rose VAT + TSL materials are heavy — CDN cold loads often exceed the 3s grass/character budget. */
export function getRoseCompileTimeoutMs(): number {
  return 20000;
}

/** VAT rose field is heavy on Safari GPU RAM — off by default; opt in with ?roses=1. */
export function shouldEnableRoses(): boolean {
  if (!isSafari()) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('roses') === '1';
}

export function getRoseInstanceCount(defaultCount: number): number {
  if (!shouldEnableRoses()) return 0;
  return isSafari() ? Math.min(defaultCount, 500) : defaultCount;
}

export function getGrassBladesPerAxis(defaultBlades: number): number {
  return isSafari() ? Math.min(defaultBlades, 512) : defaultBlades;
}

/** Single source of truth for grass grid size — must match compute, material, and mesh.count. */
export function getEffectiveGrassBladesPerAxis(): number {
  return getGrassBladesPerAxis(DEFAULT_BLADES_PER_AXIS);
}

export function getEffectiveGrassBladeCount(): number {
  const axis = getEffectiveGrassBladesPerAxis();
  return axis * axis;
}

/** Safari loads 2K jq-lite textures instead of 4K PNG atlases. */
export function getJqTextureRoot(): string {
  return resolveMeadowAsset(isSafari() ? '/textures/jq-lite' : '/textures/jq');
}

/**
 * Opt-in via ?safari-lite=1 — disables grass compute and uses a simple ground plane.
 * Full scene is the default Safari path (upstream compile + post-processing).
 */
export function shouldUseSafariMinimalScene(): boolean {
  if (!isSafari() || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('safari-lite') === '1';
}

/** Skip VAT rose preload on Safari unless roses are explicitly enabled. */
export function shouldPreloadVatRoses(): boolean {
  return shouldEnableRoses();
}
