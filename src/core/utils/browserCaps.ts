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

/** Phone / tablet UA — excludes touch laptops and narrow desktop windows. */
export function isPhoneLikeDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  return isIosDevice();
}

/**
 * Touch UI target (joystick, mobile chrome). Includes phone-like devices plus coarse-pointer /
 * narrow viewports — but NOT used for mobile-lite scene caps (see shouldUseMobileLiteScene).
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isPhoneLikeDevice()) return true;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isNarrow = window.innerWidth < 768;
  return isTouch || isNarrow;
}

/**
 * Mobile WebGPU targets (incl. Chrome on iPhone). Does NOT include desktop Safari.
 */
export function isMemoryConstrainedGpu(): boolean {
  return isMobileDevice() || isIosDevice();
}

export function getInitialDpr(): number {
  if (typeof window === 'undefined') return 1.5;
  if (isMemoryConstrainedGpu() || isSafari()) return 1;
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

/** Hard ceiling for PerformanceMonitor upscale — mobile and Safari stay at 1. */
export function getMaxDpr(): number {
  if (isMemoryConstrainedGpu() || isSafari()) return 1;
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
 * Emergency OOM escape hatch ONLY — ?mobile-lite=1 disables grass compute and
 * renders SafariGround (static plane). Never auto-enabled on touch devices.
 */
export function shouldUseMobileLiteScene(): boolean {
  return readSearchParam('mobile-lite') === '1';
}

/**
 * Opt-in via ?safari-lite=1 — disables grass compute and uses a simple ground plane.
 */
export function shouldUseSafariMinimalScene(): boolean {
  if (!isSafari() || typeof window === 'undefined') return false;
  return readSearchParam('safari-lite') === '1';
}

/** Grass compute off — static ground plane (mobile-lite or safari-lite opt-in only). */
export function shouldUseMinimalScene(): boolean {
  return shouldUseMobileLiteScene() || shouldUseSafariMinimalScene();
}

/**
 * Dev/verification-only debug mode (?debug=1 or ?debug=true). Gates the leva
 * settings panel mount — without it the panel must never exist in the DOM
 * (zen-mode [H] was unhiding it for regular users).
 */
export function isDebugMode(): boolean {
  const raw = readSearchParam('debug');
  return raw === '1' || raw === 'true';
}

/** Roses on by default; opt out with ?no-roses=1. Disabled in minimal/lite scenes. */
export function shouldEnableRoses(): boolean {
  if (shouldUseMinimalScene()) return false;
  if (readSearchParam('no-roses') === '1') return false;
  return true;
}

export function getRoseInstanceCount(defaultCount: number): number {
  if (!shouldEnableRoses()) return 0;
  if (isMemoryConstrainedGpu()) return Math.min(defaultCount, 500);
  if (isSafari()) return Math.min(defaultCount, 500);
  return defaultCount;
}

export function getGrassBladesPerAxis(defaultBlades: number): number {
  if (shouldUseMinimalScene()) return 0;
  if (isPhoneLikeDevice()) return Math.min(defaultBlades, 256);
  if (isMemoryConstrainedGpu() || isSafari()) return Math.min(defaultBlades, 512);
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

/** Mobile / iOS load 2K jq-lite textures instead of 4K PNG atlases. Desktop uses full jq. */
export function getJqTextureRoot(): string {
  return resolveMeadowAsset(isMemoryConstrainedGpu() ? '/textures/jq-lite' : '/textures/jq');
}

/**
 * Heavy post (bloom/DoF/SMAA) allocates several full-res render targets —
 * too much for the shared iOS/mobile GPU memory pool on top of grass + roses.
 * Off on memory-constrained GPUs and in explicit lite escape-hatch scenes;
 * desktop keeps the full chain.
 */
export function shouldDisableHeavyPostProcessing(): boolean {
  return shouldUseMinimalScene() || isMemoryConstrainedGpu();
}

/** Orb population: research-locked floor (8 field + 2 sky) on constrained GPUs. */
export function getOrbGroundCount(defaultCount: number): number {
  if (isMemoryConstrainedGpu()) return Math.min(defaultCount, 8);
  return defaultCount;
}

export function getOrbSkyCount(defaultCount: number): number {
  if (isMemoryConstrainedGpu()) return Math.min(defaultCount, 2);
  return defaultCount;
}

/**
 * Constrained GPUs draw orbs FrontSide (half the transparent fragment work of
 * DoubleSide) and load the 5k-tri decimated sculpt instead of the 20k one.
 */
export function shouldUseCheapOrbRendering(): boolean {
  return isMemoryConstrainedGpu();
}

/** Directional shadows — off only in lite escape-hatch scenes. */
export function shouldEnableDirectionalShadows(): boolean {
  return !shouldUseMinimalScene();
}

export function getShadowMapSize(quality: 'low' | 'high'): number {
  if (!shouldEnableDirectionalShadows()) return 0;
  if (isMemoryConstrainedGpu()) return quality === 'high' ? 1024 : 512;
  if (isSafari()) return quality === 'high' ? 1024 : 768;
  return quality === 'high' ? 2048 : 1024;
}

/** Skip VAT rose preload when roses are disabled for this device profile. */
export function shouldPreloadVatRoses(): boolean {
  return shouldEnableRoses();
}
