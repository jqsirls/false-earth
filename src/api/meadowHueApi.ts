import { MEADOW_HUE_URL } from '../config/meadow';
import { meadowAuthHeaders } from './meadowAuthApi';

export type HueIntensityPreset = 'off' | 'gentle' | 'standard' | 'bold';
export type HueBridgeState = 'unlinked' | 'linking' | 'linked' | 'error' | 'offline';
export type HueSelectionType = 'room' | 'zone' | 'light';

export type HueStoryRoom = {
  selectionType: HueSelectionType;
  selectionId: string;
  selectionName: string;
};

export type HueProfile = {
  connected: boolean;
  disabled?: boolean;
  bridgeState?: HueBridgeState;
  intensityPreset?: HueIntensityPreset;
  storyRoom?: HueStoryRoom | null;
};

export type HueInventoryItem = {
  id: string;
  name: string;
  lightCount?: number;
};

export type HueInventory = {
  rooms: HueInventoryItem[];
  zones: HueInventoryItem[];
  lights: HueInventoryItem[];
};

export type MeadowHueConnectStart = {
  authUrl: string;
  state: string;
};

export type MeadowHueResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; status?: number };

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeInventoryItem(raw: unknown): HueInventoryItem | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id) ?? asString(record.selectionId);
  const name = asString(record.name) ?? asString(record.selectionName);
  if (!id || !name) return null;
  return {
    id,
    name,
    lightCount: asNumber(record.lightCount) ?? asNumber(record.numLights),
  };
}

function normalizeInventory(data: unknown): HueInventory {
  const record = asRecord(data);
  if (!record) return { rooms: [], zones: [], lights: [] };
  const list = (raw: unknown) =>
    Array.isArray(raw)
      ? raw.map(normalizeInventoryItem).filter((item): item is HueInventoryItem => item !== null)
      : [];
  return {
    rooms: list(record.rooms),
    zones: list(record.zones),
    lights: list(record.lights),
  };
}

export function normalizeHueProfile(data: unknown): HueProfile {
  const record = asRecord(data);
  if (!record) return { connected: false };

  const storyRoomRecord = asRecord(record.storyRoom);
  const storyRoom = storyRoomRecord
    ? {
        selectionType: (asString(storyRoomRecord.selectionType) ?? 'room') as HueSelectionType,
        selectionId: asString(storyRoomRecord.selectionId) ?? '',
        selectionName: asString(storyRoomRecord.selectionName) ?? '',
      }
    : null;

  const intensity = asString(record.intensityPreset) ?? asString(record.intensity);

  return {
    connected: Boolean(record.connected),
    disabled: typeof record.disabled === 'boolean' ? record.disabled : undefined,
    bridgeState: asString(record.bridgeState) as HueBridgeState | undefined,
    intensityPreset: intensity as HueIntensityPreset | undefined,
    storyRoom: storyRoom && storyRoom.selectionId ? storyRoom : null,
  };
}

async function meadowHueRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<MeadowHueResult<T>> {
  if (!MEADOW_HUE_URL) {
    return { ok: false, message: "Room lighting isn't ready yet", code: 'NOT_READY' };
  }

  try {
    const response = await fetch(`${MEADOW_HUE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...meadowAuthHeaders(),
        ...(init?.headers ?? {}),
      },
    });

    const body = (await response.json()) as ApiEnvelope<T> & {
      ok?: boolean;
      message?: string;
    };

    if (response.status === 503) {
      return {
        ok: false,
        message: body.message ?? "Room lighting isn't ready yet",
        code: 'NOT_READY',
        status: response.status,
      };
    }

    if (response.status === 401) {
      return {
        ok: false,
        message: body.message ?? 'Sign in again to manage room lights.',
        code: body.code ?? 'AUTH_REQUIRED',
        status: response.status,
      };
    }

    if (response.status === 403 && body.code === 'PROFILE_INCOMPLETE') {
      // Machine flag only — UI routes to the in-modal profile step on this code.
      return {
        ok: false,
        message: 'Almost there — a few details for the lights.',
        code: 'PROFILE_INCOMPLETE',
        status: response.status,
      };
    }

    if (!response.ok || body.success === false) {
      return {
        ok: false,
        message: body.error ?? body.message ?? 'Room lighting is unavailable right now.',
        code: body.code,
        status: response.status,
      };
    }

    return { ok: true, data: (body.data ?? body) as T };
  } catch {
    return {
      ok: false,
      message: 'We could not reach room lighting. Check your connection and try again.',
      code: 'NETWORK_ERROR',
    };
  }
}

export async function fetchMeadowHueProfile(): Promise<MeadowHueResult<HueProfile>> {
  const result = await meadowHueRequest<unknown>('?action=getStatus', { method: 'GET' });
  if (!result.ok) return result;
  return { ok: true, data: normalizeHueProfile(result.data) };
}

export async function startMeadowHueConnect(): Promise<MeadowHueResult<MeadowHueConnectStart>> {
  const result = await meadowHueRequest<unknown>('', {
    method: 'POST',
    body: JSON.stringify({ action: 'startConnect' }),
  });
  if (!result.ok) return result;

  const record = asRecord(result.data);
  const authUrl = asString(record?.authUrl);
  const state = asString(record?.state);
  if (!authUrl || !state) {
    return { ok: false, message: 'Connection response was incomplete.', code: 'INCOMPLETE_RESPONSE' };
  }
  return { ok: true, data: { authUrl, state } };
}

export async function completeMeadowHueConnect(code: string): Promise<
  MeadowHueResult<{ connected: boolean; inventory: HueInventory }>
> {
  const result = await meadowHueRequest<unknown>('', {
    method: 'POST',
    body: JSON.stringify({ action: 'completeConnect', code }),
  });
  if (!result.ok) return result;

  const record = asRecord(result.data);
  return {
    ok: true,
    data: {
      connected: Boolean(record?.connected),
      inventory: normalizeInventory(result.data),
    },
  };
}

export async function patchMeadowHueProfile(input: {
  disabled?: boolean;
  intensityPreset?: HueIntensityPreset;
  selectionType?: HueSelectionType;
  selectionId?: string;
  selectionName?: string;
  disconnect?: boolean;
}): Promise<MeadowHueResult<HueProfile>> {
  const result = await meadowHueRequest<unknown>('', {
    method: 'POST',
    body: JSON.stringify({ action: 'patchProfile', ...input }),
  });
  if (!result.ok) return result;
  return { ok: true, data: normalizeHueProfile(result.data) };
}

export async function startMeadowHuePreview(maxMs = 10000): Promise<MeadowHueResult<{ previewId: string }>> {
  const result = await meadowHueRequest<unknown>('', {
    method: 'POST',
    body: JSON.stringify({ action: 'preview', maxMs }),
  });
  if (!result.ok) return result;
  const previewId = asString(asRecord(result.data)?.previewId);
  if (!previewId) {
    return { ok: false, message: 'Preview could not start.', code: 'PREVIEW_FAILED' };
  }
  return { ok: true, data: { previewId } };
}

export async function stopMeadowHuePreview(previewId: string): Promise<MeadowHueResult<{ stopped: boolean }>> {
  const result = await meadowHueRequest<unknown>('', {
    method: 'POST',
    body: JSON.stringify({ action: 'previewStop', previewId }),
  });
  if (!result.ok) return result;
  return { ok: true, data: { stopped: Boolean(asRecord(result.data)?.stopped ?? true) } };
}

export function formatHueStatusLabel(profile: HueProfile | null): string {
  if (!profile?.connected) return 'Off';
  if (profile.disabled) return 'Paused';
  if (profile.storyRoom?.selectionName) return profile.storyRoom.selectionName;
  if (profile.bridgeState === 'linking') return 'Connecting';
  return 'On';
}
