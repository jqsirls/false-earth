import { DEFAULT_BLADES_PER_AXIS } from '../../components/grass/core/config';
import { resolveMeadowAsset } from '../../config/meadow';

/** Native Safari (not Chrome/Firefox on iOS). */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
}

/** iOS / iPadOS — all browsers use WebKit and share the same GPU RAM pool. */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ desktop UA
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Touch / narrow-viewport devices. Sync-safe at runtime (not during SSR).
 * Matches DeviceDetector coarse-pointer + narrow width heuristics, plus mobile UA.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isNarrow = window.innerWidth < 768;
  return isTouch || isNarrow;
}

/** Safari + all mobile WebGPU targets (incl. Chrome on iPhone). */
export function isMemoryConstrainedGpu(): boolean {
  return isSafari() || isMobileDevice() || isIosDevice();
}

export function getInitialDpr(): number {
  if (typeof window === 'undefined') return 1.5;
  if (isMemoryConstrainedGpu()) return 1;
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

/** Hard ceiling for PerformanceMonitor upscale — mobile must stay at 1. */
export function getMaxDpr(): number {
  if (isMemoryConstrainedGpu()) return 1;
  return 1.5;
}

export function getSafariCompileTimeoutMs(): number {
  return 20000;
}

export function getDefaultCompileTimeoutMs(): number {
  return isMemoryConstrainedGpu() ? 20000 : 3000;
}

/** Rose VAT + TSL materials are heavy — CDN cold loads often exceed the 3s grass/character budget. */
export function getRoseCompileTimeoutMs(): number {
  return 20000;
}

function readSearchParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Auto on touch devices unless ?mobile-lite=0.
 * Opt-in on desktop via ?mobile-lite=1.
 */
export function shouldUseMobileLiteScene(): boolean {
  const flag = readSearchParam('mobile-lite');
  if (flag === '1') return true;
  if (flag === '0') return false;
  return isMobileDevice();
}

/**
 * Opt-in via ?safari-lite=1 — disables grass compute and uses a simple ground plane.
 */
export function shouldUseSafariMinimalScene(): boolean {
  if (!isSafari()) return false;
  return readSearchParam('safari-lite') === '1';
}

/** Grass compute off — static ground plane (mobile-lite default on touch, or safari-lite). */
export function shouldUseMinimalScene(): boolean {
  return shouldUseMobileLiteScene() || shouldUseSafariMinimalScene();
}

/** VAT rose field is heavy on mobile GPU RAM — off unless ?roses=1. */
export function shouldEnableRoses(): boolean {
  if (shouldUseMinimalScene()) return false;
  if (!isMemoryConstrainedGpu()) return true;
  return readSearchParam('roses') === '1';
}

export function getRoseInstanceCount(defaultCount: number): number {
  if (!shouldEnableRoses()) return 0;
  if (isMobileDevice()) return Math.min(defaultCount, 200);
  if (isSafari()) return Math.min(defaultCount, 500);
  return defaultCount;
}

export function getGrassBladesPerAxis(defaultBlades: number): number {
  if (shouldUseMinimalScene()) return 0;
  if (isMobileDevice()) return Math.min(defaultBlades, 256);
  if (isSafari()) return Math.min(defaultBlades, 512);
  return defaultBlades;
}

/** Single source of truth for grass grid size — must match compute, material, and mesh.count. */
export function getEffectiveGrassBladesPerAxis(): number {
  return getGrassBladesPerAxis(DEFAULT_BLADES_PER_AXIS);
}

export function getEffectiveGrassBladeCount(): number {
  const axis = getEffectiveGrassBladesPerAxis();
  if (axis <= 0) return 0;
  return axis * axis;
}

/** Mobile / Safari load 2K jq-lite textures instead of 4K PNG atlases. */
export function getJqTextureRoot(): string {
  return resolveMeadowAsset(isMemoryConstrainedGpu() ? '/textures/jq-lite' : '/textures/jq');
}

/** Bloom + DoF + SMAA are too heavy for mobile WebGPU memory budgets. */
export function shouldDisableHeavyPostProcessing(): boolean {
  return isMemoryConstrainedGpu();
}

/** Directional shadows — off on memory-constrained / lite scenes. */
export function shouldEnableDirectionalShadows(): boolean {
  if (shouldUseMinimalScene()) return false;
  return !isMemoryConstrainedGpu();
}

export function getShadowMapSize(quality: 'low' | 'high'): number {
  if (!shouldEnableDirectionalShadows()) return 0;
  if (isMobileDevice()) return quality === 'high' ? 1024 : 512;
  if (isSafari()) return quality === 'high' ? 1024 : 768;
  return quality === 'high' ? 2048 : 1024;
}

/** Skip VAT rose preload when roses are disabled for this device profile. */
export function shouldPreloadVatRoses(): boolean {
  return shouldEnableRoses();
}
