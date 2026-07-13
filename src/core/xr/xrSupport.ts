import { isWebXrSpikeEnabled } from '../../config/vrProfile';

export async function probeImmersiveVrSupport(): Promise<boolean> {
  if (!isWebXrSpikeEnabled()) return false;
  if (typeof navigator === 'undefined' || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-vr');
  } catch {
    return false;
  }
}
