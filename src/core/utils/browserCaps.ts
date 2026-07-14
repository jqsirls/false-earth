import { DEFAULT_BLADES_PER_AXIS } from '../../components/grass/core/config';
import { resolveMeadowAsset } from '../../config/meadow';
import {
  VR_GRASS_BLADES_PER_AXIS,
  VR_MAX_DPR,
  VR_ORB_GROUND_COUNT,
  VR_ORB_SKY_COUNT,
  VR_ROSE_INSTANCE_COUNT,
  VR_SHADOW_MAP_HIGH,
  VR_SHADOW_MAP_LOW,
  VR_WEBGL_GRASS_BLADES_PER_AXIS,
  isQuestBrowser,
  isVisionOsBrowser,
  isWebXrSpikeEnabled,
  shouldForceWebGlRendererBackend,
} from '../../config/vrProfile';

export { isQuestBrowser, isVisionOsBrowser };
import { useVrStore } from '../store/vrStore';

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

/**
 * Meadow GPU budget — mobile/iOS plus Quest browser (full 1024² grass OOMs on headset).
 * Used for grass/rose/orb caps and post — not for touch UI layout.
 */
export function isMeadowGpuConstrained(): boolean {
  return isMemoryConstrainedGpu() || isQuestBrowser();
}

export function getInitialDpr(): number {
  if (typeof window === 'undefined') return 1.5;
  if (isWebXrCapProfile()) return VR_MAX_DPR;
  if (isMemoryConstrainedGpu() || isSafari()) return 1;
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

/** Hard ceiling for PerformanceMonitor upscale — mobile and Safari stay at 1. */
export function getMaxDpr(): number {
  if (isWebXrCapProfile()) return VR_MAX_DPR;
  if (isMemoryConstrainedGpu() || isSafari()) return 1;
  return 1.5;
}

export function getSafariCompileTimeoutMs(): number {
  return 20000;
}

export function getDefaultCompileTimeoutMs(): number {
  return isMeadowGpuConstrained() ? 20000 : 3000;
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

/** Active immersive WebXR session — UI / locomotion only (not perf caps). */
export function isVrSceneProfile(): boolean {
  if (typeof window === 'undefined') return false;
  return useVrStore.getState().isActive;
}

/** VR perf caps: in-session or ?webxr=1 preload so grass/roses init at headset budget. */
export function isWebXrCapProfile(): boolean {
  if (typeof window === 'undefined') return false;
  if (useVrStore.getState().isActive) return true;
  return isWebXrSpikeEnabled();
}

/** Roses on by default; opt out with ?no-roses=1. Disabled in minimal/lite scenes. */
export function shouldEnableRoses(): boolean {
  if (shouldUseMinimalScene()) return false;
  // VAT rose compute requires the WebGPU renderer backend (breaks on headset WebGL XR).
  if (shouldForceWebGlRendererBackend()) return false;
  if (readSearchParam('no-roses') === '1') return false;
  return true;
}

export function getRoseInstanceCount(defaultCount: number): number {
  if (!shouldEnableRoses()) return 0;
  if (isWebXrCapProfile()) return Math.min(defaultCount, VR_ROSE_INSTANCE_COUNT);
  if (isMeadowGpuConstrained()) return Math.min(defaultCount, 500);
  if (isSafari()) return Math.min(defaultCount, 500);
  return defaultCount;
}

export function getGrassBladesPerAxis(defaultBlades: number): number {
  if (shouldUseMinimalScene()) return 0;
  if (shouldForceWebGlRendererBackend()) return VR_WEBGL_GRASS_BLADES_PER_AXIS;
  if (isWebXrCapProfile()) return VR_GRASS_BLADES_PER_AXIS;
  if (isQuestBrowser()) return VR_GRASS_BLADES_PER_AXIS;
  if (isPhoneLikeDevice()) return Math.min(defaultBlades, 256);
  if (isMeadowGpuConstrained() || isSafari()) return Math.min(defaultBlades, 512);
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

/** Mobile / iOS / Quest load 2K jq-lite textures instead of 4K PNG atlases. Desktop uses full jq. */
export function getJqTextureRoot(): string {
  return resolveMeadowAsset(isMeadowGpuConstrained() ? '/textures/jq-lite' : '/textures/jq');
}

/**
 * Heavy post (bloom/DoF/SMAA) allocates several full-res render targets —
 * too much for the shared iOS/mobile GPU memory pool on top of grass + roses.
 * Off on memory-constrained GPUs and in explicit lite escape-hatch scenes;
 * desktop keeps the full chain.
 */
export function shouldDisableHeavyPostProcessing(): boolean {
  return shouldUseMinimalScene() || isMeadowGpuConstrained() || isWebXrCapProfile();
}

/** VR / Quest spike — defer ambient orbs until after first seconds in-scene. */
export function shouldDeferAmbientOrbs(): boolean {
  return isWebXrCapProfile();
}

/** Grass compute (WebGPU storage + indirect draw) — unreliable on Quest browsers. */
export function shouldUseGrassComputePath(): boolean {
  if (shouldUseMinimalScene()) return false;
  if (isQuestBrowser()) return false;
  return !shouldForceWebGlRendererBackend();
}

/** Orb population: research-locked floor (8 field + 2 sky) on constrained GPUs. */
export function getOrbGroundCount(defaultCount: number): number {
  if (isWebXrCapProfile()) return Math.min(defaultCount, VR_ORB_GROUND_COUNT);
  if (isMemoryConstrainedGpu()) return Math.min(defaultCount, 8);
  return defaultCount;
}

export function getOrbSkyCount(defaultCount: number): number {
  if (isWebXrCapProfile()) return Math.min(defaultCount, VR_ORB_SKY_COUNT);
  if (isMemoryConstrainedGpu()) return Math.min(defaultCount, 2);
  return defaultCount;
}

/**
 * Constrained GPUs draw orbs FrontSide (half the transparent fragment work of
 * DoubleSide) and load the 5k-tri decimated sculpt instead of the 20k one.
 */
export function shouldUseCheapOrbRendering(): boolean {
  return isMeadowGpuConstrained();
}

/** Directional shadows — off only in lite escape-hatch scenes. */
export function shouldEnableDirectionalShadows(): boolean {
  return !shouldUseMinimalScene();
}

export function getShadowMapSize(quality: 'low' | 'high'): number {
  if (!shouldEnableDirectionalShadows()) return 0;
  if (isWebXrCapProfile()) return quality === 'high' ? VR_SHADOW_MAP_HIGH : VR_SHADOW_MAP_LOW;
  if (isMemoryConstrainedGpu()) return quality === 'high' ? 1024 : 512;
  if (isSafari()) return quality === 'high' ? 1024 : 768;
  return quality === 'high' ? 2048 : 1024;
}

/** Skip VAT rose preload when roses are disabled for this device profile. */
export function shouldPreloadVatRoses(): boolean {
  return shouldEnableRoses();
}
