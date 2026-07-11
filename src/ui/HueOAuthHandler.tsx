import { useEffect, useRef } from 'react';
import {
  clearHueOAuthQueryParams,
  clearPendingHueOAuth,
  readHueOAuthFromUrl,
  readPendingHueOAuth,
  storeHueConnectState,
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
    if (!isAuthenticated || handlingRef.current) return;

    const fromUrl = readHueOAuthFromUrl();
    const pending = readPendingHueOAuth();
    const payload = fromUrl ?? pending;
    if (!payload) return;

    handlingRef.current = true;

    const run = async () => {
      if (fromUrl) {
        clearHueOAuthQueryParams();
      }

      const result = await completeMeadowHueConnect(payload.code);
      clearPendingHueOAuth();

      if (result.ok && result.data.inventory.rooms.length > 0) {
        setPendingHueRooms(result.data.inventory.rooms);
      }

      openHueSheet();
      handlingRef.current = false;
    };

    void run();
  }, [isAuthenticated, openHueSheet, setPendingHueRooms]);

  return null;
}

export function rememberHueConnectState(state: string): void {
  storeHueConnectState(state);
}
