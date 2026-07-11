import { useEffect, useRef } from 'react';
import {
  clearHueOAuthQueryParams,
  clearPendingHueOAuth,
  readHueOAuthFromUrl,
  readPendingHueOAuth,
  storeHueConnectState,
  takeHueCallbackHandoff,
} from '../lib/hueOAuth';
import {
  completeMeadowHueConnect,
} from '../api/meadowHueApi';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';

/**
 * Handles Philips Hue OAuth return params on any meadow page load.
 * OAuth lands via API Gateway callback → booster.storytailor.com?hue_status=oauth_complete&code=...
 */
export function HueOAuthHandler() {
  const isAuthenticated = useMeadowAuthStore((state) => state.isAuthenticated);
  const openHueSheet = useMeadowAuthStore((state) => state.openHueSheet);
  const setPendingHueRooms = useMeadowAuthStore((state) => state.setPendingHueRooms);
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const complete = async (code: string, fromUrl: boolean) => {
      if (handlingRef.current) return;
      handlingRef.current = true;

      if (fromUrl) {
        clearHueOAuthQueryParams();
      }

      const result = await completeMeadowHueConnect(code);
      clearPendingHueOAuth();

      if (result.ok && result.data.inventory.rooms.length > 0) {
        setPendingHueRooms(result.data.inventory.rooms);
      }

      openHueSheet();
      handlingRef.current = false;
    };

    const urlPayload = readHueOAuthFromUrl();
    const payload = urlPayload ?? readPendingHueOAuth() ?? takeHueCallbackHandoff();
    if (payload) {
      void complete(payload.code, Boolean(urlPayload));
    }

    // Safety net: the popup's localStorage handoff arrives while the Hue
    // sheet is closed (HueSheet only listens in its connecting phase).
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== 'meadow.hueCallbackHandoff') return;
      if (useMeadowAuthStore.getState().isHueSheetOpen) return;
      const handoff = takeHueCallbackHandoff();
      if (handoff) void complete(handoff.code, false);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isAuthenticated, openHueSheet, setPendingHueRooms]);

  return null;
}

export function rememberHueConnectState(state: string): void {
  storeHueConnectState(state);
}
