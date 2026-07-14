import {
  isVisionOsBrowser,
  isWebXrSpikeEnabled,
  shouldUseWebGpuXrOnVisionPro,
} from '../../config/vrProfile';

export type VrPreviewProbe = {
  supported: boolean;
  reason?: string;
};

export async function probeImmersiveVrSupport(): Promise<boolean> {
  const probe = await probeVrPreview();
  return probe.supported;
}

/**
 * visionOS supports immersive-vr only (immersive-ar is false on device).
 * Default VP path is WebGL2 XR; &webgpu-xr=1 stays blocked until WebGPU XR is stable.
 */
export async function probeVrPreview(): Promise<VrPreviewProbe> {
  if (!isWebXrSpikeEnabled()) {
    return { supported: false, reason: 'webxr_flag_off' };
  }
  if (typeof navigator === 'undefined' || !navigator.xr) {
    return { supported: false, reason: 'navigator_xr_missing' };
  }

  try {
    const immersiveVr = await navigator.xr.isSessionSupported('immersive-vr');
    if (!immersiveVr) {
      return { supported: false, reason: 'immersive_vr_unsupported' };
    }

    if (isVisionOsBrowser() && shouldUseWebGpuXrOnVisionPro()) {
      return {
        supported: false,
        reason: 'vision_pro_webgpu_xr_unstable',
      };
    }

    return { supported: true };
  } catch {
    return { supported: false, reason: 'probe_failed' };
  }
}

export function formatVrPreviewBlockedMessage(reason?: string): string {
  switch (reason) {
    case 'vision_pro_webgpu_xr_unstable':
      return 'VR preview is not ready with WebGPU XR on Vision Pro yet. Reload without webgpu-xr=1 or wait for a fix.';
    case 'immersive_vr_unsupported':
      return 'VR preview is not ready on this device yet. WebXR immersive VR is not available in this browser.';
    case 'navigator_xr_missing':
      return 'VR preview is not ready on this device yet. This browser does not expose WebXR.';
    default:
      return 'VR preview is not ready on this device yet.';
  }
}
