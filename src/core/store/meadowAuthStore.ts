import { create } from 'zustand';
import type { MeadowSession } from '../../api/meadowAuthApi';
import type { HueInventoryItem } from '../../api/meadowHueApi';
import { getSession } from '../../api/meadowAuthApi';

export type MeadowAuthIntent = 'hue_connect' | null;

interface MeadowAuthState {
  session: MeadowSession | null;
  isAuthenticated: boolean;
  isAuthSheetOpen: boolean;
  isHueSheetOpen: boolean;
  authIntent: MeadowAuthIntent;
  isHydrated: boolean;
  pendingHueRooms: HueInventoryItem[];

  setSession: (session: MeadowSession | null) => void;
  openAuthSheet: (intent?: MeadowAuthIntent) => void;
  closeAuthSheet: () => void;
  openHueSheet: () => void;
  closeHueSheet: () => void;
  clearAuthIntent: () => void;
  resumePendingIntent: () => void;
  hydrateSession: () => Promise<void>;
  setPendingHueRooms: (rooms: HueInventoryItem[]) => void;
  clearPendingHueRooms: () => void;
}

export const useMeadowAuthStore = create<MeadowAuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isAuthSheetOpen: false,
  isHueSheetOpen: false,
  authIntent: null,
  isHydrated: false,
  pendingHueRooms: [],

  setSession: (session) =>
    set({
      session,
      isAuthenticated: Boolean(session),
    }),

  openAuthSheet: (intent = null) =>
    set({
      isAuthSheetOpen: true,
      isHueSheetOpen: false,
      authIntent: intent,
    }),

  closeAuthSheet: () =>
    set({
      isAuthSheetOpen: false,
    }),

  openHueSheet: () =>
    set({
      isHueSheetOpen: true,
      isAuthSheetOpen: false,
    }),

  closeHueSheet: () =>
    set({
      isHueSheetOpen: false,
    }),

  clearAuthIntent: () => set({ authIntent: null }),

  resumePendingIntent: () => {
    const { authIntent } = get();
    set({ authIntent: null, isAuthSheetOpen: false });

    if (authIntent === 'hue_connect') {
      set({ isHueSheetOpen: true });
    }
  },

  hydrateSession: async () => {
    const session = await getSession();
    set({
      session,
      isAuthenticated: Boolean(session),
      isHydrated: true,
    });
  },

  setPendingHueRooms: (rooms) => set({ pendingHueRooms: rooms }),

  clearPendingHueRooms: () => set({ pendingHueRooms: [] }),
}));
