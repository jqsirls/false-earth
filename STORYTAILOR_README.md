# Storytailor Earth (False Earth fork)

Interactive WebGPU wander experience forked from [False Earth](https://github.com/momentchan/false-earth) by Ming-Jyun Hung (MIT). Intended for Storytailor marketing/experiential surfaces — especially a **Webflow full-page 404 iframe** on `assets.storytailor.dev`, not the in-app Lottie loader.

## Attribution

- **False Earth** — Ming-Jyun Hung, [mingjyunhung.com](https://mingjyunhung.com/), MIT License. See `LICENSE` and upstream [readme.md](./readme.md).
- **Storytailor JQ astronaut** — owned rigged GLB from `3D/export/JQ/rigged/` (replaces upstream CGTrader astronaut; do not ship licensed `Astronaut.glb` to CDN).

## Prerequisites

- Node.js 20.17+ (Vite 7)
- WebGPU-capable browser (Chrome/Edge 113+, Safari 26+ Technology Preview). Non-WebGPU browsers see a graceful “SYSTEM INCOMPATIBLE” overlay.
- HTTPS for local dev (Vite basic-ssl plugin)
- Blender 5+ (for re-exporting JQ) — see `tools/3d/README.md`

## First-time setup

```bash
cd experiences/false-earth

# Required: three-core is a git submodule
git submodule update --init --recursive

# Link Storytailor character (web GLB ~9MB; textures load from public/)
ln -sf "$(pwd)/../../3D/export/JQ/rigged/JQ_rigged.glb" public/models/JQ_rigged.glb

npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | HTTPS dev server (default port 5173) |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve `dist/` locally |

### Preview locally

```bash
cd experiences/false-earth
npm run dev
# Open https://localhost:5173/?mode=404
```

404 embed mode (`?mode=404`):

- **[ START ]** after compile (same as default)
- Gentle auto-forward wander after start
- “Back to Storytailor” CTA overlay

Default mode: tap **[ START ]** after assets compile (loading bar → calibrating → start).

Quality defaults to **high** (`quality: 'high'`) — bloom, depth-of-field, and SMAA on by default, matching upstream False Earth. Toggle via Leva debug panel if you need a performance pass.

## JQ astronaut pipeline (2026-07-09)

### Asset outputs

| File | Size | Purpose |
|------|------|---------|
| `3D/export/JQ/rigged/JQ_rigged.glb` | ~9 MB | **Web default** — 6 skinned mesh parts, no embedded images |
| `3D/export/JQ/rigged/JQ_rigged_web.glb` | ~9 MB | Same as above |
| `3D/export/JQ/rigged/JQ_rigged_textured.glb` | ~280 MB | Full embedded newtees PNGs (archive/reference only) |

### Textures

Runtime PBR maps live in `public/textures/jq/{helmet,jumper,boots,glove,pack,strap}/` (copied from `3D/newtees/`). Mapped per mesh in `src/components/character/jqConfig.ts`.

Regenerate from repo root:

```bash
bash tools/3d/link-jq-textures.sh          # Marmoset symlink names
blender --background --python tools/3d/blender_rig_jq.py -- 3D/export/JQ/mesh.fbx
```

### Mesh parts

| Mesh name | Texture prefix | Notes |
|-----------|----------------|-------|
| `astroboy_f` | `helmet` | Helmet/face — hidden in FPV camera mode |
| `jumper` | `jumper` | Suit body |
| `strap` | `strap` | Harness |
| `glove` | `glove` | Gloves |
| `pack` | `pack` | Backpack (emissive) |
| `boots` | `boots` | Boots |

### Animation

| Clip | File | Notes |
|------|------|-------|
| Idle | `JQ_Idle.glb` | Mixamo animation-only |
| Walk | `JQ_Walking.glb` | Camera-relative locomotion |
| Run | `JQ_Running.glb` | Shift / joystick far pull |
| Back | `JQ_WalkingBack.glb` | Backward intent |
| **Flight** | `JQ_Flying.glb` | **Double-tap** toggles; smooth crossfade from locomotion |

Re-export all clips:

```bash
blender --background --python tools/3d/blender_mixamo_jq_glb.py
```

### Pack OBJ (reuse)

Standalone backpack mesh for external tools:

```bash
blender --background --python tools/3d/blender_export_jq_pack_obj.py
# -> 3D/export/JQ/JQ_pack.obj (+ JQ_pack.mtl)
# Textures: 3D/newtees/pack_*.png (BaseColor, Normal, Roughness, Metallic, Emissive)
```

## Controls

| Input | Action |
|-------|--------|
| **WASD** / arrow keys | Move (camera-relative, third person) |
| **Shift** | Run |
| **Mouse drag** | Orbit camera (third person) |
| **L-stick** (mobile) | Move |
| **Touch** (right side, mobile) | Look / orbit |
| **Double-tap** (desktop or mobile, outside joystick) | Toggle flight on/off |

Flight uses the Mixamo Flying clip with smooth blend in/out; character hovers ~2.5m above terrain while flying. No camera mode picker — third person only. Tap **[ START ]** after the loading bar finishes.

## Storytailor customizations

| Area | Status |
|------|--------|
| Build (`three-core` submodule) | ✅ Green |
| JQ textured character | ✅ `useStorytailorCharacterAssets.ts` + `jqConfig.ts` |
| Mixamo locomotion + flight | ✅ Five clip GLBs + smooth blend in `useCharacterPhysics.ts` |
| `?mode=404` wander + home CTA | ✅ |
| Branded loading copy + START gate | ✅ |
| Exploration UX (no camera picker, performance default) | ✅ |
| Colorful grass patches (procedural teal/purple/amber) | ✅ |
| Wander marks / discovery orbs (gamification) | ⏸ Deferred — not shipped |

Toggle JQ vs licensed astronaut: `STORYTAILOR.useJqCharacter` in `src/config/storytailor.ts`.

## Grass color patches

Grass color patches use the same world-space noise as clump placement — soft teal, purple, and amber accents blended in the base fragment shader (visible in performance/low quality; no bloom required).

## Deploy to CDN (`assets.storytailor.dev`)

1. Copy `3D/export/JQ/rigged/JQ_rigged.glb` → `public/models/JQ_rigged.glb` (real file, not symlink).
2. Include `public/textures/jq/**` in the build.
3. **Delete** licensed upstream assets you will not ship:
   - `public/models/Astronaut.glb`
   - `public/models/Idle.glb`, `Walking.glb`, `Running.glb`, `WalkingBack.glb`
   - `public/textures/Body/*`, `public/textures/Details/*` (astronaut KTX2)
4. `npm run build`
5. Upload `dist/` to e.g. `s3://…/webflow/experiences/storytailor-earth/` behind CloudFront `assets.storytailor.dev`.

## Webflow iframe snippet

```html
<iframe
  src="https://assets.storytailor.dev/webflow/experiences/storytailor-earth/index.html?mode=404"
  title="Storytailor — off the path"
  loading="lazy"
  allow="fullscreen"
  style="position:fixed;inset:0;width:100%;height:100%;border:0;"
></iframe>
```

Use on a dedicated 404 template page (full viewport). Parent page should not scroll behind the iframe.

## Project layout

```
experiences/false-earth/
├── packages/three-core/          # git submodule (momentchan/three-core)
├── public/
│   ├── models/JQ_rigged.glb      # ~9MB web export
│   └── textures/jq/              # newtees PBR per suit part
├── src/
│   ├── config/storytailor.ts
│   └── components/character/
│       ├── jqConfig.ts           # mesh → texture paths
│       └── hooks/
│           ├── useStorytailorCharacterAssets.ts
│           └── useCharacterPhysics.ts  # procedural JQ locomotion
└── STORYTAILOR_README.md
```

## Known limits

1. **FPV / tripod camera** — removed from UI; third-person follow only.
2. **GLB size** — use `JQ_mixamo.glb` web export, not `JQ_rigged_textured.glb` (280 MB embedded PNGs).
3. **Symlinks** — local dev symlink to `3D/` works; CDN build needs real file copies.

## Debug

- `?debug=true` — enables eruda mobile console + async compile timings.
- Console log `[JQ] Runtime PNG textures from /textures/jq/` confirms texture path is active.

## Local URL (verified 2026-07-09)

Vite serves **HTTPS on port 5173**. Bare `localhost` or `http://localhost` will not load the app.

```text
https://localhost:5173/?mode=404
```

Accept the self-signed certificate warning once in Safari/Chrome. Wait for **[ START ]**, tap it, then wander.

Production preview after build:

```bash
npm run build && npm run preview
# → https://localhost:4173/?mode=404
```

## Safari requirements (macOS Safari 26+)

Safari WebGPU is supported but more memory- and shader-sensitive than Chrome.

### URL

Use **HTTPS** on port **5173** — bare `localhost` will not load the dev app:

```text
https://localhost:5173/?mode=404
```

Accept the self-signed certificate once. `npm run preview` serves on **4173** after `npm run build`.

### Runtime device caps (2026-07-10)

Full Meadow (grass compute, roses, post-processing) is the **default on mobile and desktop**. Transparent memory caps apply without replacing visuals:

| Behavior | Mobile / iOS | Desktop Safari | Desktop Chrome |
|----------|--------------|----------------|----------------|
| Grass | 512² blades, full compute | 512² blades | Full grid |
| Roses | 500 instances (default on) | 500 instances | 2000 instances |
| JQ textures | `jq-lite` 2K | Full `jq` 4K | Full `jq` 4K |
| DPR | Capped to 1 | Capped to 1 | Up to 1.5 |
| Post-processing | Full TSL stack | Full TSL stack | Full TSL stack |

**Emergency fallback only** (never auto-enabled): `?mobile-lite=1` or `?safari-lite=1` swaps grass for a static ground plane. Opt out of roses: `?no-roses=1`.

### Safari runtime path (2026-07-09 — aligned with upstream)

Upstream [false-earth.mingjyunhung.com](https://false-earth.mingjyunhung.com) works on Safari with **normal** `gl.compileAsync` + TSL post-processing. Prior fork mitigations (`skipPrecompile`, direct `gl.render()`, 8s render watchdog) caused **RENDER STALLED** false positives — those are **removed**.

| Behavior | Safari default |
|----------|----------------|
| Shader compile | `gl.compileAsync` during loading (20s timeout per target) |
| Post-processing | Same TSL stack as Chrome |
| Roses | On (500 cap); opt out with `?no-roses=1` |
| Grass | 512² blades; full compute shader path |
| JQ Booster | Full `jq` 4K PNGs on desktop Safari |
| DPR | Capped to 1 on Safari |
| Minimal scene | Opt-in `?safari-lite=1` or `?mobile-lite=1` — simple ground, no grass compute |

### Safari test URLs

```text
# Full scene (default)
https://localhost:5173/?mode=404

# Emergency static ground (OOM escape hatch)
https://localhost:5173/?mode=404&mobile-lite=1
https://localhost:5173/?mode=404&safari-lite=1

# Opt out of rose field
https://localhost:5173/?mode=404&no-roses=1
```

Reference upstream (known-good on Safari): https://false-earth.mingjyunhung.com

### Texture deploy for Safari

`public/textures/jq/` ships **4096² PNGs** (~258 MB on disk). Before CDN deploy, resize to **2048 or 1024**:

```bash
# macOS — example per map (repeat per part folder or script your pipeline)
cd experiences/false-earth
mkdir -p public/textures/jq-2k/helmet
sips -Z 2048 public/textures/jq/helmet/BaseColor.png --out public/textures/jq-2k/helmet/BaseColor.png
```

Prefer **KTX2** (like upstream `starmap_2020_4k.ktx2`) for production.

### GPU errors

If WebGPU context or device is lost after load, the loading overlay returns with a plain message (`GPU LOST` / `GPU MEMORY EXCEEDED`) instead of a silent black canvas.

## Safari memory notes (legacy checklist)

Safari reloads tabs that exceed GPU RAM. Common causes in this fork:

1. **Duplicate character loading (fixed 2026-07-09):** `useCharacterAssetsBridge` called both licensed astronaut hooks and JQ hooks — ~11 GLBs + licensed KTX2 **and** JQ PNGs. Use split `Character.tsx` paths instead.
2. **4K PNG textures:** `public/textures/jq/` is ~258 MB on disk (4096² maps). For Safari, resize to **2048 or 1024** before deploy, or convert to KTX2 like upstream astronaut textures (~20 MB total).
3. **DPR:** Safari defaults to `dpr=1` via `getInitialDpr()` to reduce pressure.
4. **Compile:** Safari uses the same `gl.compileAsync` path as upstream with a **20s** per-target timeout (Chrome **3s**). Loading screen waits for real compile completion — no forced early **[ START ]**.
5. **Suspense split:** Character texture/GLTF suspension is nested inside its own `AsyncCompile` so rose/grass compile is not blocked while JQ PNGs load.

If WebGPU context is lost after load, the loading overlay reappears with `GPU MEMORY EXCEEDED` instead of a silent black screen.
