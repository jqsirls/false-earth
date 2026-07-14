# WebXR spike test matrix

**Status:** Spike (PRD build step 2)  
**Gate:** `?webxr=1` on `https://booster.storytailor.com` or local `https://localhost:5173?webxr=1`  
**Ship target:** Quest browser + desktop PCVR at native refresh before removing the gate (v1). Vision Pro gaze dwell ships with this build (pinch remains primary).

## Preconditions

| Check | How |
|-------|-----|
| HTTPS | Required for WebXR (local dev uses Vite basic SSL) |
| Spike flag | URL contains `webxr=1` |
| XR support | `navigator.xr.isSessionSupported('immersive-vr')` true |
| Session started | Tap `[ START ]`, then top-center `[ ENTER VR ]` appears when supported |

## Platform matrix

| Platform | Phase | Pass criteria |
|----------|-------|---------------|
| Meta Quest browser | v1 spike | Enters `immersive-vr` with `local-floor`; seated floor plausible; 10 min no comfort abort |
| Desktop PCVR (Link/Air Link or native PCVR browser) | v1 spike | Same session path as Quest |
| Apple Vision Pro | v1.1 comfort | Gaze/transient-pointer **0.8 s dwell** + pinch instant select on locomotion ring; reduce-motion disables dwell |
| Flat Chrome/Firefox desktop | control | No `[ ENTER VR ]` without spike flag; flat unchanged |

## Comfort checks (PRD §2.4)

| ID | Test | Expected |
|----|------|----------|
| C1 | Seated default | `local-floor` reference space; no forced standing |
| C2 | Locomotion verbs | WASD walk; Shift run; F/G fly/land; controllers: left stick walk, grip run, right stick snap, Y/X fly, B land |
| C2b | VR snap turn | A/D or right-stick flick rotate 30° per action in VR (not strafe); smooth turn off; brief comfort vignette on snap |
| C3 | Stereo safety | No helmet/CRT post overlay in VR |
| C4 | HUD | Flat HUD hidden in VR; locomotion ring + EXIT (world-anchored, not head-locked); controller trigger instant or 0.8 s dwell on chips; 8 s idle fade to 25% |
| C5 | Modals | Auth/Hue/legal sheets not ported; exit VR to use flat UI |
| C6 | Exit preserve | Exit VR keeps position, orbs, timer, session state |

## Performance checks

| ID | Test | Expected |
|----|------|----------|
| P1 | Refresh | Sustained 72Hz+ on Quest (Performance overlay or Meta metrics) |
| P2 | VR profile | Reduced grass/roses/orbs via `browserCaps` + `vrProfile.ts` |
| P3 | Post stack | Heavy bloom/DoF/flare off in VR |

## Known spike limitations

- Grass grid size is chosen at scene boot; full VR cap reload may require session restart (v1 follow-up).
- Snap turn rotates view directly; player rig refactor planned for v1.
- **Quest v1:** Controller thumbstick, grip run, Y/X fly, B land wired in `useVrControllerInput.ts` (xr-standard gamepad).
- WebGPU + WebXR combo is bleeding-edge; failures surface inline under `[ ENTER VR ]`.

## Interim testing without Quest/PCVR

### Vision Pro interim testing (gaze dwell + pinch)

Meadow requests **`immersive-vr`** with **`local-floor`** — not `immersive-ar`. Vision Pro Safari supports `immersive-vr`; do not expect an AR passthrough session.

1. **Safari (visionOS):** Settings → Apps → Safari → Advanced → Feature Flags → enable **WebXR Device API** (and related WebXR flags if listed). Restart Safari.
2. Open `https://booster.storytailor.com?webxr=1` or local `https://localhost:5173?webxr=1`.
3. Tap `[ START ]`, then top-center `[ ENTER VR ]` when the support probe passes.
4. Optional sanity check in Web Inspector console: `await navigator.xr?.isSessionSupported('immersive-vr')` → `true` with flags on.

VP uses gaze + pinch (transient pointer), not Quest controllers. Locomotion chips: **pinch** = instant; **gaze dwell 0.8 s** = auto-select (off when Reduce Motion is on). Comfort sign-off still requires Quest/PCVR per ship matrix above.

### Chrome Immersive Web Emulator caveats

Desktop Chrome can polyfill `immersive-vr` for flow smoke tests; **WebGPU + WebXR is fragile** (failures show inline under `[ ENTER VR ]`).

1. Install [Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik) (Chrome/Edge).
2. `chrome://flags`: enable **WebXR Incubations**; on Windows try **WebXR/WebGPU Binding**; if WebXR Layers errors appear, disable **WebXR Layers** and restart.
3. Same URL with `?webxr=1` → `[ START ]` → `[ ENTER VR ]`; use DevTools **WebXR** tab for emulated headset.

Expect session bind failures (`WebGPU XR renderer not ready`, etc.). Not a substitute for headset performance or comfort checks. No `?webxr=simulate=1` desktop preview exists — only a real XR session toggles VR behavior.

### Flat browser (no XR device)

With **`?webxr=1` alone** and no XR support (`navigator.xr` missing or `isSessionSupported('immersive-vr')` false), Meadow is **visually unchanged** from production flat play. **`[ ENTER VR ]` stays hidden** until spike flag, immersive-vr support, and `[ START ]` all pass (`EnterVrButton.tsx`).

## Code map

| Area | Path |
|------|------|
| Spike flag + caps | `src/config/vrProfile.ts` |
| Feature detect | `src/core/xr/xrSupport.ts` |
| Session bind | `src/core/xr/webXrSession.ts` |
| In-session rules | `src/components/xr/VrSessionBridge.tsx`, `src/core/input/useVrControllerInput.ts` |
| Locomotion menu | `src/components/xr/VrLocomotionMenu.tsx` |
| Menu raycast/dwell | `src/core/xr/vrMenuRaycast.ts` |
| Herston test sheet | `docs/HERSTON_VR_CONTROLS.md` |
| HUD entry | `src/ui/EnterVrButton.tsx` |
| Device caps | `src/core/utils/browserCaps.ts` (`isVrSceneProfile`) |
