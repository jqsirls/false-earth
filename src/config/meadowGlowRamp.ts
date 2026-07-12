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
const AURORA_STOPS = MEADOW_GLOW_RAMP.slice(6);

/** Rest-state layer: night sky rising toward the pale horizon. */
export const MEADOW_GLOW_NIGHT_GRADIENT = `linear-gradient(160deg, ${NIGHT_STOPS.join(', ')})`;

/** Breath-peak layer: the aurora tail, cross-faded over the night base. */
export const MEADOW_GLOW_AURORA_GRADIENT = `linear-gradient(140deg, ${AURORA_STOPS.join(', ')})`;
