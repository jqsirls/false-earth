# Cinematic Visual Spec — Booster's Meadow

**Status:** Phases 1–4 implemented (foundation). Phases 5–14 pending.  
**Scope:** Real-time interactive WebGPU scene (`experiences/false-earth/`).  
**Owner:** JQ Sirls | **Date:** July 2026

This document is the authoritative reference for the large-format cinematic sci-fi visual overhaul. The experience is **real-time and interactive** — not a still frame. All lighting, grading, atmosphere, and camera effects must remain stable while the player moves and looks around.

---

## Goals

- Create a restrained, large-format cinematic look
- Preserve gameplay readability and responsiveness
- Make the astronaut feel physically embedded in the grass and environment
- Reduce the current synthetic blue/cyan cast
- Create stronger depth, contrast, scale, and atmosphere
- Avoid heavy effects that look like a filter placed over the scene

---

## Implementation priority

### 1. Color management and tone mapping (Phase 1 — shipped)

Verify the full rendering pipeline uses correct color management:

- Color textures use sRGB encoding
- Lighting calculations occur in linear color space
- Render into an HDR buffer
- Apply bloom **before** tone mapping
- Output correctly to sRGB

Filmic tone mapper: **AgX** (Three.js r182 TSL), fallback **ACES**. No Reinhard.

Pipeline: linear lighting → HDR → bloom → AgX tone map → (future grade) → sRGB display.

**Code:** `Effects.tsx` — `renderOutput(..., AgXToneMapping, SRGBColorSpace)`; `outputColorTransform = false`.

---

### 2. Primary environment light (Phase 2 — shipped)

One dominant directional (moon/sun) behind-left of spawn for rim readability.

Target ratios vs key = 1.0:

| Role | Ratio |
|------|-------|
| Environment fill | 0.08–0.18 |
| Character fill | 0.05–0.12 |
| Character rim | 0.15–0.30 |

**Code:** `cinematicLighting.ts`, `DirectionalLight.tsx`, `App.tsx` env intensity.

---

### 3. Environment and ambient light (Phase 3 — shipped)

Reduce blue/cyan ambient. Cool-neutral shadows, cyan only on motivated highlights.

**Code:** grass controls, patch accents, `envMapIntensity`, emissive wave color.

---

### 4. Astronaut lighting (Phase 4 — partial)

World directional primary; weak hemisphere + world-locked rim. No studio rig.

**Code:** `Character.tsx` shadow flags; directional CSM.

---

### 5. Real-time shadows (Phase 5)

CSM ✅ (single map, tiered resolution). Still needed: contact shadows, SSAO, grass-body occlusion, terrain foot contact.

---

### 6. Height fog and volumetrics (Phase 6)

Exponential height fog, low-density volumetrics, horizon haze, depth planes.

---

### 7. Global color grade (Phase 8)

Restrained grade: slight underexposure, moderate contrast, −8–15% saturation, −15–25% cyan, lifted blacks. No aggressive LUT stacks.

---

### 8. Star field (Phase 9)

Photographic distribution: more dim stars, variation, clustering, horizon fade.

---

### 9. Bloom (Phase 1 — shipped defaults)

High threshold, low strength — suit lights, stars, specular only.

---

### 10. Camera effects (Phase 10)

Grain, mild vignette, restrained DoF, low motion blur. UI unaffected.

---

### 11. Camera FOV and movement (Phase 11)

45–60° FOV, smooth damping, stable horizon.

---

### 12. Grass material (Phase 3 — partial)

Less gloss/cyan; more roughness; patch desaturation. LOD + fog for distance.

---

### 13. Performance presets (Phase 12)

LOW / MEDIUM / HIGH tiers for fog, shadows, AO, bloom, grass, stars, post res.

---

### 14. Acceptance criteria (Phase 14)

See parent spec — astronaut embedded, reduced cyan, dominant light, grounded shadows, atmospheric depth, stable motion, UI sharp, perf stable.

---

## Remaining implementation order

1. ✅ Linear + HDR + AgX  
2. ✅ Directional rebuild  
3. ✅ Reduce ambient cyan  
4. 🔶 Contact shadows + AO  
5. ⏳ Height fog / volumetrics  
6. ⏳ Global grade  
7. ⏳ Star rebuild  
8. ⏳ Camera FX polish  
9. ⏳ FOV / movement  
10. ⏳ Quality presets  
11. ⏳ Movement stress test  

Final quality must come from lighting, tone mapping, materials, shadows, and atmosphere — not LUTs alone.
