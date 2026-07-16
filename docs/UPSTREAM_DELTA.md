# Meadow vs momentchan/false-earth (upstream)

**Compared:** Storytailor `main` vs `origin/main` (`momentchan/false-earth`, commit `468a0cf`).  
**Purpose:** Internal audit reference — what we forked, what we added, what still diverges.

---

## Upstream baseline

Upstream is a WebGPU-only R3F demo: one licensed character, rose field, compute grass, TSL post, leva debug panel always mounted, no mobile caps, no CDN split, no product layer.

Load order (upstream `WorldController`): environment → rose → grass → character (sequential `AsyncCompile`).

---

## Storytailor additions (intentional — keep)

| Area | Delta |
|------|-------|
| **Characters** | JQ Booster + Void rigs, character switch, About easter egg, idle variety chain |
| **Product UI** | START gate, timer, orbs, Hue, auth, legal modals, CTA, zen mode, cursor |
| **Assets** | CDN via `meadowAssets.ts` (prod hard-pins `assets.storytailor.dev/meadow`) |
| **Device caps** | `browserCaps.ts` — DPR, rose/grass counts, post off on mobile/VR |
| **Grass fallbacks** | `GrassStaticField` (Quest WebGL XR), `SafariGround` (`?mobile-lite=1`) |
| **Terrain** | `TerrainWebGL` when `shouldForceWebGlRendererBackend()` |
| **VR spike** | `?webxr=1` opt-in, four XR patches (see `applyMeadowXrPatches.ts`), locomotion ring |
| **Load priority** | Character `AsyncCompile` first with `priority` + `readyOnCompile` (Booster visible ASAP) |
| **Visual grade** | `meadowVisualGrade.ts` — splash-match exposure, film grain, meadow post chain |
| **Audio** | Cosmic Lullaby playlist, flight SFX, orb collect, footstep paths |

---

## Grass rendering gates (single source: `browserCaps.ts` + `vrProfile.ts`)

```
Flat desktop / mobile Safari (no ?webxr=1)
  → shouldUseGrassComputePath() === true
  → GrassWebGPU (WebGPU compute) — SACRED

?mobile-lite=1 or ?safari-lite=1
  → shouldUseMinimalScene() === true
  → SafariGround static plane (no grass)

Quest browser OR ?webxr=1 on Quest
  → shouldForceWebGlRendererBackend() === true
  → shouldUseGrassComputePath() === false
  → GrassStaticField (CPU instanced)

Vision Pro ?webxr=1 (default)
  → WebGPU compute grass (desktop parity)
  → shouldForceWebGlRendererBackend() === false

Vision Pro ?webxr=1&webgl-xr=1 (escape hatch only)
  → WebGL2 XR + GrassStaticField + TerrainWebGL, roses off
```

Compile failure on constrained GPU: `WorldController` falls back to `GrassStaticField` or `SafariGround`.

---

## Asset loading

| Environment | `MEADOW_ASSET_BASE` |
|-------------|---------------------|
| Local dev | Empty → `public/` on localhost |
| Production | Hard-coded `https://assets.storytailor.dev/meadow` (ignores `VITE_MEADOW_ASSET_BASE` — Vercel `/meadow-assets` rewrite breaks large crossOrigin textures) |

Import rule: low-level modules use `./meadowAssets` only; app code uses `./meadow` re-export to avoid circular init with `storytailor.ts`.

---

## Parity gaps (honest — not blocking flat prod)

| Gap | Notes |
|-----|-------|
| **Load order** | Upstream rose→grass→character; we prioritize character. Trade-off for Booster-first UX. |
| **Leva** | Upstream always mounts panel; we gate on `?debug=1` + hidden `<Leva />` for React 19. |
| **Effects** | +VR comfort vignette, +meadow grade, +WebGL XR direct-render bypass (~120 lines vs upstream 161). |
| **VAT package** | Upstream commit `468a0cf` moved VAT to package; we vendor under `public/vat/` + CDN. |
| **Vision Pro immersive** | WebGPU XR black-frame / scissor issues partially patched; full VP parity not proven. |
| **Quest WebGL XR** | Stick-grass fallback by design; not upstream-quality grass. |
| **Upstream sync** | No automated merge; fork is ~284 files / +16k LOC product layer. |

---

## Maintenance

- Re-fetch upstream: `git fetch origin main`
- Core rendering files to diff before taking upstream fixes: `WorldController.tsx`, `Effects.tsx`, `grass/`, `packages/three-core/`
- Never regress flat `booster.storytailor.com` WebGPU compute grass without owner sign-off.
