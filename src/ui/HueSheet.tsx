import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { useFocusTrap } from '../core/hooks/useFocusTrap';
import {
  fetchMeadowHueProfile,
  formatHueStatusLabel,
  patchMeadowHueProfile,
  startMeadowHueConnect,
  startMeadowHuePreview,
  stopMeadowHuePreview,
  type HueInventoryItem,
  type HueProfile,
} from '../api/meadowHueApi';
import { rememberHueConnectState } from './HueOAuthHandler';
import {
  meadowCrtCss,
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudLabelStyle,
  meadowHudQuietButtonStyle,
  meadowOverlayRootStyle,
  meadowSheetBackdropStyle,
  meadowSheetPanelBase,
} from './meadowUiStyles';

type HueSheetPhase =
  | 'loading'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'profile_incomplete'
  | 'not_ready'
  | 'error';

export function HueSheet() {
  const isMobile = useGameStore((state) => state.isMobile);
  const reducedMotion = usePrefersReducedMotion();
  const isOpen = useMeadowAuthStore((state) => state.isHueSheetOpen);
  const closeHueSheet = useMeadowAuthStore((state) => state.closeHueSheet);
  const openAuthSheet = useMeadowAuthStore((state) => state.openAuthSheet);
  const pendingHueRooms = useMeadowAuthStore((state) => state.pendingHueRooms);
  const clearPendingHueRooms = useMeadowAuthStore((state) => state.clearPendingHueRooms);
  const panelRef = useRef<HTMLElement>(null);

  const [phase, setPhase] = useState<HueSheetPhase>('loading');
  const [profile, setProfile] = useState<HueProfile | null>(null);
  const [rooms, setRooms] = useState<HueInventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useFocusTrap(isOpen, panelRef);

  const loadProfile = useCallback(async () => {
    setPhase('loading');
    setError(null);

    const result = await fetchMeadowHueProfile();
    if (!result.ok) {
      if (result.code === 'NOT_READY') {
        setPhase('not_ready');
        return;
      }
      if (result.code === 'PROFILE_INCOMPLETE') {
        setPhase('profile_incomplete');
        return;
      }
      setPhase('error');
      setError(result.message);
      return;
    }

    setProfile(result.data);
    setPhase(result.data.connected ? 'connected' : 'disconnected');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPhase('loading');
      setProfile(null);
      setRooms([]);
      setError(null);
      setIsBusy(false);
      setPreviewId(null);
      return;
    }

    void loadProfile();
  }, [isOpen, loadProfile]);

  useEffect(() => {
    if (!isOpen || pendingHueRooms.length === 0) return;
    setRooms(pendingHueRooms);
    clearPendingHueRooms();
  }, [isOpen, pendingHueRooms, clearPendingHueRooms]);

  useEffect(() => {
    if (!previewId) return undefined;
    const timer = window.setTimeout(() => {
      void stopMeadowHuePreview(previewId).finally(() => setPreviewId(null));
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [previewId]);

  const handleConnect = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setPhase('connecting');

    const result = await startMeadowHueConnect();
    if (!result.ok) {
      setIsBusy(false);
      if (result.code === 'PROFILE_INCOMPLETE') {
        setPhase('profile_incomplete');
        return;
      }
      if (result.code === 'NOT_READY') {
        setPhase('not_ready');
      } else {
        setPhase('error');
      }
      setError(result.message);
      return;
    }

    rememberHueConnectState(result.data.state);
    window.location.assign(result.data.authUrl);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!profile?.connected || profile.disabled) return;
    setIsBusy(true);
    setError(null);

    const result = await startMeadowHuePreview();
    setIsBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setPreviewId(result.data.previewId);
  }, [profile]);

  const handleSaveRoom = useCallback(
    async (room: HueInventoryItem) => {
      setIsBusy(true);
      setError(null);

      const result = await patchMeadowHueProfile({
        selectionType: 'room',
        selectionId: room.id,
        selectionName: room.name,
      });

      setIsBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setProfile(result.data);
      setRooms([]);
    },
    [],
  );

  const handleDisconnect = useCallback(async () => {
    setIsBusy(true);
    setError(null);

    const result = await patchMeadowHueProfile({ disconnect: true });
    setIsBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setProfile(result.data);
    setPhase('disconnected');
  }, []);

  if (!isOpen) return null;

  const panelStyle: CSSProperties = isMobile
    ? {
        ...meadowSheetPanelBase,
        width: '100%',
        borderRadius: '10px 10px 0 0',
        maxHeight: '82vh',
        padding: '24px 20px max(24px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideUp 220ms ease-out',
      }
    : {
        ...meadowSheetPanelBase,
        width: 'min(360px, calc(100vw - 32px))',
        maxHeight: '72vh',
        padding: '24px',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideIn 220ms ease-out',
      };

  const statusLabel = formatHueStatusLabel(profile);
  const showRoomPicker =
    phase === 'connected' && profile?.connected && !profile.storyRoom && rooms.length > 0;

  return (
    <div style={meadowOverlayRootStyle(isMobile)}>
      <style>{`
        ${meadowFocusCss}
        ${meadowCrtCss}
        @keyframes meadowHueSlideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes meadowHueSlideIn {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes meadowHueFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .meadow-hue-panel { animation: meadowHueFadeIn 1ms linear !important; }
        }
      `}</style>

      <button
        type="button"
        aria-label="Close lights settings"
        style={meadowSheetBackdropStyle}
        onClick={closeHueSheet}
      />

      <section
        ref={panelRef}
        className="meadow-hue-panel meadow-crt-panel meadow-crt-warmup meadow-focusable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meadow-hue-title"
        tabIndex={-1}
        style={panelStyle}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          {!isMobile ? (
            <button
              type="button"
              className="meadow-focusable meadow-crt-keycap"
              onClick={closeHueSheet}
              style={{
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
                fontFamily: 'Cousine, monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              [ ESC ]
            </button>
          ) : (
            <button
              type="button"
              className="meadow-focusable"
              aria-label="Close"
              onClick={closeHueSheet}
              style={{
                minWidth: '44px',
                minHeight: '44px',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.35)',
                color: '#fff',
                fontFamily: 'Cousine, monospace',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>

        <h2
          id="meadow-hue-title"
          className="meadow-crt-title"
          style={{
            margin: '0 0 6px',
            fontSize: '0.85rem',
            fontWeight: 400,
            lineHeight: 1.45,
            letterSpacing: '0.04em',
          }}
        >
          Booster can glow your room along with the sky.
        </h2>

        <p style={{ margin: '0 0 18px', fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em' }}>
          Philips Hue is optional and stays gentle by default.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
            padding: '10px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <span style={meadowHudLabelStyle}>Room lights</span>
          <span style={{ ...meadowHudLabelStyle, color: 'rgba(255,255,255,0.72)' }}>{statusLabel}</span>
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              margin: '0 0 14px',
              fontSize: '0.68rem',
              lineHeight: 1.5,
              color: 'rgba(255, 210, 170, 0.9)',
              letterSpacing: '0.03em',
            }}
          >
            {error}
          </p>
        ) : null}

        {phase === 'loading' || phase === 'connecting' ? (
          <p style={{ margin: '0 0 16px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }}>
            {phase === 'connecting' ? 'Opening Philips Hue sign-in…' : 'Checking your lights…'}
          </p>
        ) : null}

        {phase === 'not_ready' ? (
          <p style={{ margin: '0 0 16px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }}>
            Room lighting is not enabled on this meadow yet.
          </p>
        ) : null}

        {phase === 'profile_incomplete' ? (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '0.68rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.62)' }}>
              Almost there — a few details for the lights.
            </p>
            <button
              type="button"
              className="meadow-focusable"
              onClick={() => {
                closeHueSheet();
                openAuthSheet('hue_connect');
              }}
              style={{
                ...meadowHudActionStyle,
                marginBottom: '10px',
              }}
            >
              [ CONTINUE ]
            </button>
          </>
        ) : null}

        {showRoomPicker ? (
          <div style={{ marginBottom: '14px' }}>
            <p style={{ ...meadowHudLabelStyle, marginBottom: '8px' }}>Choose a room</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="meadow-focusable"
                  disabled={isBusy}
                  onClick={() => void handleSaveRoom(room)}
                  style={{
                    ...meadowHudQuietButtonStyle,
                    textAlign: 'left',
                  }}
                >
                  {room.name}
                  {room.lightCount ? ` (${room.lightCount})` : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(phase === 'disconnected' || phase === 'error') && (
          <button
            type="button"
            className="meadow-focusable"
            disabled={isBusy}
            onClick={() => void handleConnect()}
            style={{
              ...meadowHudActionStyle,
              marginBottom: '10px',
              opacity: isBusy ? 0.65 : 1,
              cursor: isBusy ? 'wait' : 'pointer',
            }}
          >
            [ CONNECT HUE ]
          </button>
        )}

        {phase === 'connected' && profile?.connected ? (
          <>
            <button
              type="button"
              className="meadow-focusable"
              disabled={isBusy || Boolean(previewId) || profile.disabled}
              onClick={() => void handlePreview()}
              style={{
                ...meadowHudActionStyle,
                marginBottom: '10px',
                opacity: isBusy || profile.disabled ? 0.65 : 1,
              }}
            >
              {previewId ? '[ PREVIEWING ]' : '[ GENTLE PREVIEW ]'}
            </button>
            <button
              type="button"
              className="meadow-focusable"
              disabled={isBusy}
              onClick={() => void handleDisconnect()}
              style={{
                ...meadowHudQuietButtonStyle,
                marginBottom: '10px',
              }}
            >
              Disconnect Hue
            </button>
          </>
        ) : null}

        <button
          type="button"
          className="meadow-focusable"
          onClick={closeHueSheet}
          style={meadowHudQuietButtonStyle}
        >
          Close
        </button>
      </section>
    </div>
  );
}
