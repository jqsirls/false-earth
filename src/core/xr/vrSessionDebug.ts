import { isDebugMode } from '../utils/browserCaps';

export type VrSessionLogEntry = {
  t: string;
  event: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    __meadowVrLog?: VrSessionLogEntry[];
  }
}

/** Visible in eruda / Safari Web Inspector when ?debug=1 */
export function logVrSession(event: string, detail?: Record<string, unknown>): void {
  if (!isDebugMode()) return;

  const entry: VrSessionLogEntry = {
    t: performance.now().toFixed(1),
    event,
    ...detail,
  };

  console.info('[meadow-vr]', entry);

  if (typeof window !== 'undefined') {
    window.__meadowVrLog = [...(window.__meadowVrLog ?? []), entry].slice(-100);
  }
}
