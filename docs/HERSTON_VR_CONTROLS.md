# Booster's Meadow VR — Herston test sheet

**URL:** https://booster.storytailor.com?webxr=1  
**Gate:** `?webxr=1` stays required until Quest headset sign-off.  
**Platforms this build targets:** Meta Quest browser + desktop PCVR (Link / Air Link / native PCVR browser).  
**Vision Pro:** Gaze or transient-pointer ray on a chip for **0.8 s dwell** (chip brightens, then selects). **Pinch** selects instantly. With **Reduce Motion** on, dwell is off — pinch or Bluetooth keyboard only.

## Before you start

1. Put on the headset and open the URL above in the **Quest browser** (or PCVR browser).
2. Tap **`[ START ]`** on the flat gate.
3. Tap top-center **`[ ENTER VR ]`** when it appears.
4. Seated play is the default (`local-floor`). You should see a small **locomotion ring** in front of you (WALK · RUN · FLY · STOP FLYING · EXIT). It is world-anchored, not head-locked.

## Quest / PCVR controllers

| Action | Control |
|--------|---------|
| **Walk** | Left thumbstick — move relative to where you look (forward/back + strafe). Deadzone 0.15. |
| **Run** | Hold **left grip squeeze** or **left stick click** while moving. Either-hand grip also counts. |
| **Snap turn 30°** | Right thumbstick **left/right flick** (one turn per flick; return stick to center to turn again). Brief edge vignette on turn. |
| **Fly** | **Y** (left controller) or **X** (right controller) — short press toggles flight on. |
| **Stop flying** | Press **Y** or **X** again while flying, or press **B** (right) to land. |
| **Locomotion menu** | Aim controller ray at ring chips; **trigger** for instant select, or **dwell 0.8 s** on target chip. |
| **Exit VR** | **EXIT** chip on the ring (dwell or trigger), or headset system Home / exit. Session/orbs/timer should persist on flat. |

## Vision Pro (gaze + pinch)

| Action | Control |
|--------|---------|
| **Aim** | Look at a chip, or pinch-drag transient pointer over the ring |
| **Select** | **Pinch** for instant select (primary). Or hold gaze/pointer on chip **0.8 s** — chip brightens, then confirms |
| **Reduce Motion** | Dwell disabled; pinch or keyboard only |
| **Idle** | Ring fades to 25% opacity after 8 s with no gaze or interaction; full opacity returns on aim |

## Bluetooth keyboard (all devices)

| Action | Key |
|--------|-----|
| Walk | `W` `S` forward/back relative to view |
| Snap turn | `A` / `D` — 30° per press (not strafe in VR) |
| Run | Hold `Shift` while moving |
| Fly toggle | `F` |
| Land | `G` |
| Music | `M` (flat only; hidden in VR HUD) |

Double-tap flight is **flat touch/mouse only** — not in VR.

## What to verify (~10 min seated)

- [ ] Enters `immersive-vr` without WebGPU error under ENTER VR
- [ ] Walk + run + snap turn feel comfortable (no nausea abort)
- [ ] Fly and land via buttons and via menu chips
- [ ] Collect at least one orb by walking into it
- [ ] EXIT returns to flat with same orb count and timer
- [ ] No flat HUD clutter in stereo (CTA, footer, lamp hidden)

## Known blockers (honest)

- **WebGPU + WebXR** is bleeding-edge on Quest. If `[ ENTER VR ]` shows *WebGPU XR renderer not ready* or the session dies immediately, that is a **browser/GPU stack limit**, not missing controller code. There is **no WebGL fallback** in this meadow build — fixing that would be a separate render-path project.
- Desktop Chrome **Immersive Web Emulator** is smoke-only; it is not a substitute for this headset test.

## Code map

| Piece | Path |
|-------|------|
| Controller poll | `src/core/input/useVrControllerInput.ts` |
| Session bridge | `src/components/xr/VrSessionBridge.tsx` |
| Locomotion ring | `src/components/xr/VrLocomotionMenu.tsx` |
| Menu raycast/dwell | `src/core/xr/vrMenuRaycast.ts` |
| Snap turn helper | `src/core/xr/vrLocomotion.ts` |
