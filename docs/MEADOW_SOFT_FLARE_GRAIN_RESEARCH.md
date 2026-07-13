# Meadow Soft Lens Flare + Film Grain Research

**Date:** 2026-07-13  
**Stack:** `three@0.182` WebGPU + TSL `PostProcessing` (`Effects.tsx`)  
**Goal:** Soft, subtle atmosphere — noticeable only if you look for it. No cyan crush, no cinematic filter stack.

---

## Approach 1 — TSL native nodes (recommended)

**Lens flare:** `lensflare()` from `three/addons/tsl/display/LensflareNode.js`  
Feed it a **separate bloom pass** on scene emissives (cosmic beam, helmet, sky orbs), not the full beauty pass.

```ts
import { lensflare } from 'three/addons/tsl/display/LensflareNode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';

const flareBloom = bloom(finalNode); // or emissive-only pass
flareBloom.threshold = uniform(0.72);
flareBloom.strength = uniform(0.18);
flareBloom.radius = uniform(0.55);

const flare = lensflare(flareBloom, {
  threshold: uniform(0.78),
  ghostAttenuationFactor: uniform(38),
  ghostSpacing: uniform(0.18),
  ghostSamples: uniform(2),
});
const softFlare = gaussianBlur(flare, 6); // optional, ~1 extra pass
finalNode = finalNode.add(softFlare.mul(0.35));
```

**Film grain:** `film()` from `three/addons/tsl/display/FilmNode.js`  
Single-pass, animated `rand()` noise mixed at low intensity.

```ts
import { film } from 'three/addons/tsl/display/FilmNode.js';

finalNode = film(finalNode, float(0.04)); // intensity 0.02–0.06
```

**Pros:** Matches existing `bloom` / `smaa` / `hashBlur` graph; no new deps; WebGPU-first.  
**Cons:** Flare needs tuned bloom input — too low threshold reads as smear.

---

## Approach 2 — `@react-three/postprocessing` + drei (WebGL path)

`@react-three/postprocessing` ships `LensFlare`, `Noise`, `Bloom` as EffectComposer passes. Works with `WebGLRenderer`, not the meadow's `WebGPURenderer`.

**Pros:** Mature presets, quick iteration in Leva.  
**Cons:** **Incompatible** with current WebGPU-only meadow unless we fork a second renderer path. Not recommended.

---

## Approach 3 — Custom TSL `Fn` grain + radial streak flare

Hand-roll grain with `mx_noise_float` / `rand(fract(uv + time))` and a cheap anamorphic streak:

```ts
const grain = mx_noise_float(uv().mul(800).add(time.mul(12)), 0).mul(0.04);
gradedRgb = gradedRgb.add(grain);

const streak = smoothstep(0.92, 1.0, dot(normalize(uv() - 0.5), lightDir2D));
finalNode = finalNode.add(vec4(streak.mul(0.06), 0));
```

**Pros:** Zero extra passes; full control; can gate on `prefersReducedMotion`.  
**Cons:** Flare won't match Chapman ghost quality; more owner tuning by eye.

---

## Meadow recommendation

**Ship Approach 1** in two guarded steps after the owner grading pass:

| Effect | Node | Meadow starting range | Notes |
|--------|------|----------------------|-------|
| Film grain | `film(input, intensity)` | **0.03–0.04** (cap 0.06) | After grade + soften, before SMAA. Off when `prefersReducedMotion`. |
| Soft flare | `lensflare(bloomPass)` + optional `gaussianBlur(..., 4–6)` | threshold **0.78–0.85**, ghosts **2**, spacing **0.15–0.22**, attenuation **35–42**, add strength **0.25–0.40** | Only on high quality. Tie bloom threshold to existing `MEADOW_BLOOM_THRESHOLD + 0.35`. |
| Bloom feed for flare | dedicated `bloom()` | threshold **0.72**, strength **0.15–0.22**, radius **0.5** | Separate from gameplay bloom — keeps grass from flaring. |

**Insert order in `Effects.tsx`:** beauty → DoF → beam composite → gameplay bloom → **grade** → soften → **film grain** → SMAA (if on) → **flare add** (last additive).

**Do not:** stack `FilmNode` + heavy bloom + `LensflareNode` at doc defaults — reads medium-loud. Start at half the table values and tune on the cosmic beam at night.

---

## References

- [Three.js WebGPU post-processing manual](https://threejs.org/manual/en/webgpu-postprocessing.html)
- [Three.js lensflare WebGPU example](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_postprocessing_lensflare.html)
- `node_modules/three/examples/jsm/tsl/display/FilmNode.js`
- `node_modules/three/examples/jsm/tsl/display/LensflareNode.js`
- Codrops TSL grain pattern (`mx_noise_float` subtract) — subtle, single-pass
