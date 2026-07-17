import type { WebGPURenderer } from 'three/webgpu';
import { logVrSession } from './vrSessionDebug';

type XrFrameCallback = ((time: number, frame?: XRFrame) => void) | null;

type XrManagerWithLegacyLoop = WebGPURenderer['xr'] & {
  setAnimationLoop?: (callback: XrFrameCallback) => void;
  _currentAnimationLoop?: XrFrameCallback;
  __meadowR3fPatched?: boolean;
};

/** Latest callback from R3F xr.setAnimationLoop(handleXRFrame). */
let meadowR3fXrLoop: XrFrameCallback = null;

/**
 * Flat animation loop XRManager saved at setSession time. R3F overwrites
 * `_currentAnimationLoop` on sessionstart with handleXRFrame — we must not lose
 * the flat restore target or exit-VR leaves a broken / double-driven loop.
 */
let meadowFlatRestoreLoop: XrFrameCallback = null;

/**
 * three.js r185 common XRManager has no public setAnimationLoop (unlike WebGL
 * WebXRManager). @react-three/fiber wires advance() via xr.setAnimationLoop on
 * sessionstart. Without a shim, `_currentAnimationLoop` stays the flat rAF loop
 * (no XRFrame arg) and priority-1 Effects skips correct XR advance → black immersion.
 *
 * Dual-purpose field hazard: XRManager uses `_currentAnimationLoop` both as the
 * per-frame callback AND as the post-session restore target. We snapshot the flat
 * loop on sessionstart before R3F overwrites it, then restore via the public
 * `renderer.setAnimationLoop` when R3F clears the XR callback on sessionend.
 */
export function patchWebGpuXrForR3f(renderer: WebGPURenderer): void {
  const xr = renderer.xr as XrManagerWithLegacyLoop;
  if (!xr || xr.__meadowR3fPatched) return;

  xr.setAnimationLoop = (callback: XrFrameCallback) => {
    meadowR3fXrLoop = callback;

    if (xr.isPresenting) {
      // Keep XRManager.onAnimationFrame → _currentAnimationLoop(time, frame) live.
      // Do NOT call renderer.setAnimationLoop here — that would replace XRManager's
      // own _onAnimationFrame driver.
      if (
        meadowFlatRestoreLoop === null &&
        xr._currentAnimationLoop &&
        xr._currentAnimationLoop !== callback
      ) {
        meadowFlatRestoreLoop = xr._currentAnimationLoop;
      }
      xr._currentAnimationLoop = callback;
      logVrSession('xr_set_animation_loop', {
        hasCallback: Boolean(callback),
        isPresenting: true,
        flatRestoreSaved: meadowFlatRestoreLoop !== null,
      });
      return;
    }

    // Flat or session-ending: R3F passes null on sessionend. Prefer restoring the
    // pre-XR flat loop so three.js animation + R3F rAF do not fight.
    const toRestore = callback ?? meadowFlatRestoreLoop;
    meadowFlatRestoreLoop = null;
    xr._currentAnimationLoop = toRestore;
    void renderer.setAnimationLoop(toRestore);
    logVrSession('xr_set_animation_loop', {
      hasCallback: Boolean(toRestore),
      isPresenting: false,
      restoredFlat: Boolean(!callback && toRestore),
    });
  };

  const onSessionStart = () => {
    // Fires before R3F's handleSessionChange (we patch at renderer init, R3F connects later).
    if (xr._currentAnimationLoop && xr._currentAnimationLoop !== meadowR3fXrLoop) {
      meadowFlatRestoreLoop = xr._currentAnimationLoop;
    }
    if (meadowR3fXrLoop) {
      xr._currentAnimationLoop = meadowR3fXrLoop;
    }
    logVrSession('xr_sessionstart_loop', {
      hasR3fLoop: Boolean(meadowR3fXrLoop),
      flatRestoreSaved: meadowFlatRestoreLoop !== null,
    });
  };

  xr.addEventListener('sessionstart', onSessionStart);

  xr.__meadowR3fPatched = true;
}

/** Call after xr.setSession() so VP/Quest always run the R3F XR frame callback. */
export function ensureR3fXrAnimationLoop(renderer: WebGPURenderer): void {
  const xr = renderer.xr as XrManagerWithLegacyLoop;
  if (!xr?.isPresenting || !meadowR3fXrLoop) {
    logVrSession('xr_ensure_animation_loop_skip', {
      isPresenting: Boolean(xr?.isPresenting),
      hasR3fLoop: Boolean(meadowR3fXrLoop),
    });
    return;
  }
  if (
    meadowFlatRestoreLoop === null &&
    xr._currentAnimationLoop &&
    xr._currentAnimationLoop !== meadowR3fXrLoop
  ) {
    meadowFlatRestoreLoop = xr._currentAnimationLoop;
  }
  xr._currentAnimationLoop = meadowR3fXrLoop;
  logVrSession('xr_ensure_animation_loop', {
    isPresenting: true,
    flatRestoreSaved: meadowFlatRestoreLoop !== null,
  });
}
