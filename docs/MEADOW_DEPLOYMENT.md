# Booster's Meadow — Deployment (booster.storytailor.com)

**Last updated:** 2026-07-09  
**Scope:** `experiences/false-earth/` only — Vercel hosts the app shell; S3/CloudFront hosts heavy assets.

---

## Architecture

| Layer | Host | Contents |
|-------|------|----------|
| **Experience app** | `https://booster.storytailor.com` | Vite-built JS/CSS/HTML (`dist/`), small static files only |
| **Assets CDN** | `https://assets.storytailor.dev/meadow/` | GLBs, jq textures, audio, splash, logo, HDR, VAT roses |
| **Redirect** | `meadow.storytailor.com` | 301 → `booster.storytailor.com` (configure at DNS or edge) |

Large binaries should **not** ship inside the Vercel deployment if avoidable — set `VITE_MEADOW_ASSET_BASE` so the runtime fetches from CDN.

---

## 1. Vercel project setup

1. **Import** the repo (or monorepo subfolder) with root directory `experiences/false-earth`.
2. **Framework preset:** Vite.
3. **Build command:** `npm run build`
4. **Output directory:** `dist`
5. **Install command:** `npm install` (run from `experiences/false-earth`; ensure `packages/three-core` submodule is initialized in CI).

### Production environment variables

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_BASE_PATH` | `/` | Absolute asset URLs for root-domain deploy |
| `VITE_MEADOW_ASSET_BASE` | `https://assets.storytailor.dev/meadow` | No trailing slash |
| `VITE_MEADOW_AUTH_URL` | `https://lendybmmnlqelrhkhdyc.supabase.co/functions/v1/meadow-auth` | Edge OTP proxy (live; `MEADOW_AUTH_ENABLED` must be `true` on Supabase) |
| `VITE_SUPABASE_URL` | `https://lendybmmnlqelrhkhdyc.supabase.co` | Optional direct client OTP path (future) |
| `VITE_SUPABASE_ANON_KEY` | Storytailor anon key | Optional direct client OTP — **never** service role |
| `VITE_MEADOW_ANALYTICS_URL` | *(optional)* | Empty = console-only analytics |

**Local dev** leaves `VITE_MEADOW_ASSET_BASE` unset so assets load from `public/` on `https://localhost:5173`.

### Custom domain

1. Vercel project → **Settings → Domains** → add `booster.storytailor.com` to project `booster-meadow`.
2. **Note:** `storytailor.com` must be on the same Vercel team as the project. If domain add returns `domain_not_owned`, attach `storytailor.com` to the team first (GoDaddy DNS verification).
3. GoDaddy: **CNAME** `booster` → `cname.vercel-dns.com` (or the target Vercel shows).
4. Wait for TLS provisioning; verify `https://booster.storytailor.com` serves the built app.

**Interim URL (live):** https://booster-meadow.vercel.app

### Optional redirect

At Vercel edge or Cloudflare: `meadow.storytailor.com` → 301 → `https://booster.storytailor.com`.

---

## 2. CDN asset upload (S3 → CloudFront)

Upload paths **mirror** `public/` under the `meadow/` prefix on `assets.storytailor.dev`.

### Required for production (JQ character + meadow branding)

```
s3://storytailor-assets-production-326181217496/meadow/
├── models/
│   ├── JQ_mixamo.glb
│   ├── JQ_Idle.glb
│   ├── JQ_Walking.glb
│   ├── JQ_Running.glb
│   ├── JQ_WalkingBack.glb
│   └── JQ_Flying.glb
├── textures/
│   ├── jq/              # full PNG PBR sets (helmet, jumper, strap, glove, pack, boots)
│   ├── jq-lite/         # Safari 2K variants
│   └── potsdamer_platz_1k_nb.hdr
├── audio/
│   ├── cosmic-lullaby-1.mp3
│   ├── cosmic-lullaby-2.mp3
│   ├── cosmic-lullaby-3.mp3
│   ├── cosmic-lullaby-4.mp3
│   └── cosmic-lullaby-5.mp3
├── booster-meadow-logo.png
├── storytailor-splash.webp          # preferred; .jpg fallback
├── vat/                             # Rose VAT (required on Chrome — roses on by default)
│   └── Rose_meta.json, Rose.glb, …
└── textures/Rose/*.ktx2             # Rose_Petal_Normal, Rose_Petal_Diff, Rose_Outline (required)
```

### Optional extras

```
meadow/textures/starmap_2020_4k.ktx2   # only if starmap path enabled in code

### Example sync (adjust bucket/profile)

```bash
cd experiences/false-earth

# Upload heavy dirs only — do not upload entire public/ if licensed CGTrader assets remain
aws s3 sync public/models/ s3://storytailor-assets-production-326181217496/meadow/models/ \
  --exclude "Astronaut.glb" --exclude "Idle.glb" --exclude "Walking*.glb" --exclude "Running.glb"

aws s3 sync public/textures/jq/ s3://storytailor-assets-production-326181217496/meadow/textures/jq/
aws s3 sync public/textures/jq-lite/ s3://storytailor-assets-production-326181217496/meadow/textures/jq-lite/
aws s3 sync public/audio/ s3://storytailor-assets-production-326181217496/meadow/audio/ \
  --exclude "fs_grass*" --exclude "grass_field.mp3" --exclude "wave01.mp3" --exclude "noise.m4a"

aws s3 cp public/booster-meadow-logo.png s3://storytailor-assets-production-326181217496/meadow/booster-meadow-logo.png
aws s3 cp public/storytailor-splash.jpg s3://storytailor-assets-production-326181217496/meadow/storytailor-splash.jpg
aws s3 cp public/textures/potsdamer_platz_1k_nb.hdr s3://storytailor-assets-production-326181217496/meadow/textures/potsdamer_platz_1k_nb.hdr

aws s3 sync public/vat/ s3://storytailor-assets-production-326181217496/meadow/vat/ --cache-control "$CACHE"
aws s3 sync public/textures/Rose/ s3://storytailor-assets-production-326181217496/meadow/textures/Rose/ \
  --exclude "*" --include "*.ktx2" --cache-control "$CACHE"
```

Public URLs resolve as:

`https://assets.storytailor.dev/meadow/models/JQ_mixamo.glb`

The app uses `resolveMeadowAsset('/models/JQ_mixamo.glb')` which prepends `VITE_MEADOW_ASSET_BASE`.

### Cache headers

- **GLB / MP3 / HDR:** `Cache-Control: public, max-age=31536000, immutable` (version by path if assets change).
- **PNG textures:** long cache; bust on filename change.

Invalidate CloudFront only when replacing files at the same key.

---

## 3. Build & verify

```bash
cd experiences/false-earth
npm install
npm run build
```

### Pre-flight checklist

- [ ] `VITE_MEADOW_ASSET_BASE` set in Vercel production
- [ ] `VITE_BASE_PATH=/` set in Vercel production (absolute `/assets/…` URLs)
- [ ] CDN paths uploaded and curl-able, e.g. `curl -I https://assets.storytailor.dev/meadow/models/JQ_mixamo.glb`
- [ ] Texture paths use part folders: `…/textures/jq-lite/jumper/BaseColor.png` (not flat `jumper_BaseColor.png`)
- [ ] `booster.storytailor.com` CNAME live + HTTPS
- [ ] WebGPU experience loads; START gate → Booster visible
- [ ] Network tab shows models/audio from `assets.storytailor.dev/meadow`, not Vercel origin
- [ ] `meadow.storytailor.com` redirects (if configured)

### Local dev (unchanged)

```bash
npm run dev
# https://localhost:5173/ — assets from public/, no VITE_MEADOW_ASSET_BASE
```

---

## 4. What stays on Vercel vs CDN

| Ship on Vercel | Ship on CDN |
|----------------|-------------|
| `index.html`, bundled JS/CSS | JQ GLBs (~tens of MB total) |
| `_headers` (if used) | jq / jq-lite PNG texture atlases |
| Favicon-sized assets | Cosmic Lullaby MP3s |
| | Splash JPG, meadow logo |
| | HDR environment map |

**Rule of thumb:** if a file is >500 KB and not required for first paint, put it on CDN.

### Troubleshooting black screen

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty `#root`, no UI | Circular import between `meadow.ts` ↔ `storytailor.ts` (TDZ crash in bundle) | Keep `resolveMeadowAsset` in `meadowAssets.ts` only; `storytailor.ts` must not import `meadow.ts` |
| Splash visible, scene never ready | CDN 403 on `textures/jq*` wrong key layout | Upload `public/textures/jq/` preserving part subfolders |
| WebGPU message on splash | Browser/GPU unsupported | Expected — user sees error copy, not a black void |
| Grey static ground on mobile | Stale deploy with auto `mobile-lite` on touch | Redeploy; full scene is default. Emergency only: `?mobile-lite=1` |

---

## 5. Related docs

- `docs/MEADOW_IDENTITY_BACKEND_ASK.md` — Supabase OTP + Memberstack enrichment (**approved**; edge functions deployed 2026-07-10)
- `docs/MEADOW_BACKEND_ASK_P2.md` — **superseded** password bridge
- `docs/MEADOW_MODALS_REVIEW.md` — legal footer/modal PRD review
- `STORYTAILOR_README.md` — JQ pipeline, local dev, upstream attribution
