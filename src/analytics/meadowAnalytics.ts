import {
  detectMeadowEntrySource,
  MEADOW_ANALYTICS_URL,
  type MeadowCtaVariant,
  type MeadowEntrySource,
} from '../config/meadow';
import { getExperienceMode } from '../config/storytailor';

export type MeadowAnalyticsEvent =
  | 'meadow_visit'
  | 'meadow_session_5min'
  | 'meadow_cta_click';

export type MeadowDeviceType = 'mobile' | 'desktop';

export interface MeadowEventPayload {
  event: MeadowAnalyticsEvent;
  anonId: string;
  sessionId: string;
  timestamp: string;
  entrySource: MeadowEntrySource;
  experienceMode: ReturnType<typeof getExperienceMode>;
  deviceType: MeadowDeviceType;
  properties?: Record<string, string | number | boolean | null>;
}

const ANON_ID_KEY = 'meadow_anon_id';
const SESSION_ID_KEY = 'meadow_session_id';
const SESSION_STARTED_KEY = 'meadow_session_started_at';
const FIVE_MIN_FIRED_KEY = 'meadow_session_5min_fired';

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `meadow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readOrCreateStorageId(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = createId();
  storage.setItem(key, next);
  return next;
}

export function getMeadowAnonId(): string {
  if (typeof window === 'undefined') return 'server';
  return readOrCreateStorageId(localStorage, ANON_ID_KEY);
}

export function getMeadowSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  return readOrCreateStorageId(sessionStorage, SESSION_ID_KEY);
}

export function getMeadowSessionStartedAt(): number {
  if (typeof window === 'undefined') return Date.now();

  const raw = sessionStorage.getItem(SESSION_STARTED_KEY);
  if (raw) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const startedAt = Date.now();
  sessionStorage.setItem(SESSION_STARTED_KEY, String(startedAt));
  return startedAt;
}

export function getMeadowSessionDurationMs(): number {
  return Math.max(0, Date.now() - getMeadowSessionStartedAt());
}

export function getMeadowDeviceType(): MeadowDeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  return coarse || narrow ? 'mobile' : 'desktop';
}

function sendMeadowBeacon(payload: MeadowEventPayload): void {
  if (!MEADOW_ANALYTICS_URL || typeof navigator === 'undefined' || !navigator.sendBeacon) {
    return;
  }

  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(MEADOW_ANALYTICS_URL, blob);
  } catch {
    // Best-effort ingest — never block the meadow experience.
  }
}

function dispatchMeadowEvent(payload: MeadowEventPayload): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('meadow:analytics', { detail: payload }));
  }

  sendMeadowBeacon(payload);

  if (import.meta.env.DEV || !MEADOW_ANALYTICS_URL) {
    console.info('[meadow analytics]', payload);
  }
}

export function trackMeadowEvent(
  event: MeadowAnalyticsEvent,
  properties?: MeadowEventPayload['properties'],
): void {
  const payload: MeadowEventPayload = {
    event,
    anonId: getMeadowAnonId(),
    sessionId: getMeadowSessionId(),
    timestamp: new Date().toISOString(),
    entrySource: detectMeadowEntrySource(),
    experienceMode: getExperienceMode(),
    deviceType: getMeadowDeviceType(),
    properties,
  };

  dispatchMeadowEvent(payload);
}

export function trackMeadowVisit(): void {
  getMeadowSessionStartedAt();
  trackMeadowEvent('meadow_visit');
}

export function trackMeadowCtaClick(variant: MeadowCtaVariant): void {
  trackMeadowEvent('meadow_cta_click', {
    ctaVariant: variant,
    sessionDurationMs: getMeadowSessionDurationMs(),
    sessionDurationSec: Math.round(getMeadowSessionDurationMs() / 1000),
  });
}

let fiveMinuteTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleMeadowFiveMinuteEvent(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(FIVE_MIN_FIRED_KEY) === '1') return;

  if (fiveMinuteTimer) clearTimeout(fiveMinuteTimer);

  const elapsed = getMeadowSessionDurationMs();
  const remaining = Math.max(0, 5 * 60 * 1000 - elapsed);

  fiveMinuteTimer = setTimeout(() => {
    if (sessionStorage.getItem(FIVE_MIN_FIRED_KEY) === '1') return;
    sessionStorage.setItem(FIVE_MIN_FIRED_KEY, '1');
    trackMeadowEvent('meadow_session_5min', {
      sessionDurationMs: getMeadowSessionDurationMs(),
    });
  }, remaining);
}

export function clearMeadowAnalyticsTimers(): void {
  if (fiveMinuteTimer) {
    clearTimeout(fiveMinuteTimer);
    fiveMinuteTimer = null;
  }
}
