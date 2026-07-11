import mitt from 'mitt';
import type * as THREE from 'three';

export type GameEvents = {
  'beam:spawn': THREE.Vector3;
  'beam:hit': { position: THREE.Vector3; radius: number };
  'rose:spawn': { position: THREE.Vector3; count?: number; radius?: number };
  /** Session-only gather count — counter UI + chime subscribe. */
  'orb:gathered': { count: number };
  'game:start': void;
  'game:over': void;
};

export const gameEvents = mitt<GameEvents>();

/** Event bus hook for programmatic production verification (Playwright) — same pattern as __MEADOW_MIX__. */
declare global {
  interface Window {
    __MEADOW_EVENTS__?: typeof gameEvents;
  }
}
if (typeof window !== 'undefined') {
  window.__MEADOW_EVENTS__ = gameEvents;
}
