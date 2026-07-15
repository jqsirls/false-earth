import { isVrHeadsetBrowser, isWebXrSpikeEnabled } from '../../config/vrProfile';

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
 * Show [ ENTER VR ] only when immersive-vr is actually available — no blocked copy.
 */
export async function probeVrPreview(): Promise<VrPreviewProbe> {
  if (!isWebXrSpikeEnabled()) {
    return { supported: false, reason: 'webxr_flag_off' };
  }
  if (!isVrHeadsetBrowser()) {
    return { supported: false, reason: 'not_vr_headset' };
  }
  if (typeof navigator === 'undefined' || !navigator.xr) {
    return { supported: false, reason: 'navigator_xr_missing' };
  }

  try {
    const immersiveVr = await navigator.xr.isSessionSupported('immersive-vr');
    if (!immersiveVr) {
      return { supported: false, reason: 'immersive_vr_unsupported' };
    }

    return { supported: true };
  } catch {
    return { supported: false, reason: 'probe_failed' };
  }
}
