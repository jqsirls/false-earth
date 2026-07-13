# WebXR spike test matrix

**Status:** Spike (PRD build step 2)  
**Gate:** `?webxr=1` on `https://booster.storytailor.com` or local `https://localhost:5173?webxr=1`  
**Ship target:** Quest browser + desktop PCVR at native refresh before removing the gate (v1). Vision Pro is v1.1.

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
| Apple Vision Pro | v1.1 | Deferred after Quest+PCVR green |
| Flat Chrome/Firefox desktop | control | No `[ ENTER VR ]` without spike flag; flat unchanged |

## Comfort checks (PRD §2.4)

| ID | Test | Expected |
|----|------|----------|
| C1 | Seated default | `local-floor` reference space; no forced standing |
| C2 | Walk only | WASD move works; double-tap flight does nothing |
| C3 | Snap turn | A/D rotate 30° per press; smooth turn off |
| C4 | Stereo safety | No helmet/CRT post overlay in VR |
| C5 | HUD | Flat HUD hidden in VR; `[ EXIT ]` only (not head-locked in spike) |
| C6 | Modals | Auth/Hue/legal sheets not ported; exit VR to use flat UI |
| C7 | Exit preserve | Exit VR keeps position, orbs, timer, session state |

## Performance checks

| ID | Test | Expected |
|----|------|----------|
| P1 | Refresh | Sustained 72Hz+ on Quest (Performance overlay or Meta metrics) |
| P2 | VR profile | Reduced grass/roses/orbs via `browserCaps` + `vrProfile.ts` |
| P3 | Post stack | Heavy bloom/DoF/flare off in VR |

## Known spike limitations

- Grass grid size is chosen at scene boot; full VR cap reload may require session restart (v1 follow-up).
- Snap turn rotates view directly; player rig refactor planned for v1.
- WebGPU + WebXR combo is bleeding-edge; failures surface inline under `[ ENTER VR ]`.

## Code map

| Area | Path |
|------|------|
| Spike flag + caps | `src/config/vrProfile.ts` |
| Feature detect | `src/core/xr/xrSupport.ts` |
| Session bind | `src/core/xr/webXrSession.ts` |
| In-session rules | `src/components/xr/VrSessionBridge.tsx` |
| HUD entry | `src/ui/EnterVrButton.tsx` |
| Device caps | `src/core/utils/browserCaps.ts` (`isVrSceneProfile`) |
