/**
 * Orb gathering — research-locked v1 constants.
 * "Firefly, never fly": slow seeded drift, 6-cycles/min breathing pulse,
 * sparse population, delayed off-screen respawn, session-only counter.
 */
export const ORB_GROUND_COUNT = 11;
export const ORB_SKY_COUNT = 3;
export const ORB_COUNT = ORB_GROUND_COUNT + ORB_SKY_COUNT;

/** World-space annulus around origin the orbs scatter across (walkable field). */
export const ORB_FIELD_MIN_RADIUS = 8;
export const ORB_FIELD_MAX_RADIUS = 34;

/** Hover height above terrain (meters). */
export const ORB_GROUND_HOVER_MIN = 0.55;
export const ORB_GROUND_HOVER_MAX = 1.05;
/** Sky orbs sit on natural flight arcs — flight hover lift is 2.5m. */
export const ORB_SKY_HOVER_MIN = 2.4;
export const ORB_SKY_HOVER_MAX = 3.4;

/** Core sphere radius (meters); sky orbs are slightly larger / more forgiving. */
export const ORB_GROUND_SIZE = 0.16;
export const ORB_SKY_SIZE = 0.22;

/** Collect radii (XZ meters) — generous, calm, no precision demand. */
export const ORB_GROUND_COLLECT_RADIUS = 1.15;
export const ORB_SKY_COLLECT_RADIUS = 1.5;
/** Vertical tolerance between orb hover height and character body center. */
export const ORB_COLLECT_VERTICAL_TOLERANCE = 1.5;
/** Approx character body-center height above ground (before flight lift). */
export const CHARACTER_CENTER_HEIGHT = 0.95;

/** Dissolve duration on collect (seconds, uTime clock). */
export const ORB_DISSOLVE_SECONDS = 1.8;

/** Respawn delay range (seconds) — constant global population, never instant. */
export const ORB_RESPAWN_MIN_SECONDS = 30;
export const ORB_RESPAWN_MAX_SECONDS = 120;
/** Respawn must land outside the camera frustum plus this distance from the character. */
export const ORB_RESPAWN_MIN_CHARACTER_DISTANCE = 12;

/** Breathing pulse: 6 cycles/min (10s period), asymmetric rise 4s : fall 6s. */
export const ORB_PULSE_PERIOD_SECONDS = 10;
export const ORB_PULSE_RISE_FRACTION = 0.4;

/** Drift amplitudes (meters) — velocity stays under walk speed × 0.15. */
export const ORB_DRIFT_AMP_XZ = 0.35;
export const ORB_DRIFT_AMP_Y = 0.12;
