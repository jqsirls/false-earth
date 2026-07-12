/**
 * Canonical 12-stop night-sky ramp for the ambient modal glow (owner-supplied,
 * 2026-07-11). Deep night blues are the base/rest tones; the aurora tail
 * (#8A80FF → #FFF2E6) is the peak of each breath. Single source of truth —
 * never scatter these hex values through JSX.
 */
export const MEADOW_GLOW_RAMP = [
  '#020207',
  '#08111F',
  '#0F1B2B',
  '#192D44',
  '#314D6C',
  '#48759C',
  '#DDE8F2',
  '#8A80FF',
  '#CA80FF',
  '#FF99E6',
  '#FF8CA9',
  '#FFF2E6',
] as const;

const NIGHT_STOPS = MEADOW_GLOW_RAMP.slice(0, 6);

/** Rest-state layer: night sky rising toward the pale horizon. */
export const MEADOW_GLOW_NIGHT_GRADIENT = `linear-gradient(160deg, ${NIGHT_STOPS.join(', ')})`;

/**
 * Cascade blobs (owner grammar, 2026-07-11): the physical bulbs spread
 * ADJACENT arc colors across the room at once, so the glow anchors 2-3
 * neighboring hues at different sheet edges and lets each drift along the
 * arc. Each cycle walks neighboring ramp stops only (out and back) — never
 * color-wheel complements — so the wash stays cohesive and calm.
 */
export const MEADOW_GLOW_COOL_CYCLE = [
  MEADOW_GLOW_RAMP[3], // #192D44
  MEADOW_GLOW_RAMP[4], // #314D6C steel blue
  MEADOW_GLOW_RAMP[5], // #48759C
  MEADOW_GLOW_RAMP[6], // #DDE8F2 ice
  MEADOW_GLOW_RAMP[5],
  MEADOW_GLOW_RAMP[4],
] as const;

export const MEADOW_GLOW_MID_CYCLE = [
  MEADOW_GLOW_RAMP[6], // #DDE8F2 ice
  MEADOW_GLOW_RAMP[7], // #8A80FF periwinkle
  MEADOW_GLOW_RAMP[8], // #CA80FF violet
  MEADOW_GLOW_RAMP[7],
] as const;

export const MEADOW_GLOW_WARM_CYCLE = [
  MEADOW_GLOW_RAMP[8], // #CA80FF violet
  MEADOW_GLOW_RAMP[9], // #FF99E6 pink
  MEADOW_GLOW_RAMP[10], // #FF8CA9 rose
  MEADOW_GLOW_RAMP[11], // #FFF2E6 cream
  MEADOW_GLOW_RAMP[10],
  MEADOW_GLOW_RAMP[9],
] as const;

/** Reduced-motion statics: a calm 2-3 hue gradient with zero animation. */
export const MEADOW_GLOW_COOL_STATIC = MEADOW_GLOW_RAMP[5];
export const MEADOW_GLOW_MID_STATIC = MEADOW_GLOW_RAMP[7];
export const MEADOW_GLOW_WARM_STATIC = MEADOW_GLOW_RAMP[10];

/** Even background-color keyframes through a cycle, returning to the start. */
export function meadowGlowColorKeyframes(name: string, cycle: readonly string[]): string {
  const steps = cycle
    .map((color, i) => `${Math.round((i / cycle.length) * 100)}% { background-color: ${color}; }`)
    .join('\n          ');
  return `@keyframes ${name} {\n          ${steps}\n          100% { background-color: ${cycle[0]}; }\n        }`;
}
