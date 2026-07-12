import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { useFocusTrap } from '../core/hooks/useFocusTrap';
import {
  completeMeadowHueConnect,
  fetchMeadowHueProfile,
  formatHueStatusLabel,
  patchMeadowHueProfile,
  startMeadowHueConnect,
  type HueInventoryItem,
  type HueProfile,
} from '../api/meadowHueApi';
import {
  useAmbientHueStore,
  type AmbientStageSetting,
} from '../core/store/ambientHueStore';
import { rememberHueConnectState } from './HueOAuthHandler';
import {
  clearPendingHueOAuth,
  isHueOAuthMessage,
  takeHueCallbackHandoff,
} from '../lib/hueOAuth';
import {
  meadowCrtCss,
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudFontFamily,
  meadowHudLabelStyle,
  meadowModalTokens,
  meadowHudQuietButtonStyle,
  meadowOverlayRootStyle,
  meadowSheetBackdropStyle,
  meadowSheetBodyStyle,
  meadowSheetPanelBase,
  meadowSheetTitleStyle,
} from './meadowUiStyles';
import { useHueStatusStore } from '../core/store/hueStatusStore';
import { BuyLightsLink, BUY_LIGHTS_URL } from './BuyLightsLink';
import {
  MEADOW_GLOW_COOL_CYCLE,
  MEADOW_GLOW_COOL_STATIC,
  MEADOW_GLOW_MID_CYCLE,
  MEADOW_GLOW_MID_STATIC,
  MEADOW_GLOW_NIGHT_GRADIENT,
  MEADOW_GLOW_WARM_CYCLE,
  MEADOW_GLOW_WARM_STATIC,
  meadowGlowColorKeyframes,
} from '../config/meadowGlowRamp';

/**
 * Ambient glow intensity per stage — mirrors the room lights behind the sheet.
 * GENTLE barely-there, VIVID clearly present, FULL deepest. Icing only: it must
 * never compete with the sheet content.
 */
const GLOW_OPACITY: Record<AmbientStageSetting, number> = {
  off: 0,
  gentle: 0.32,
  vivid: 0.58,
  full: 0.82,
};

/**
 * How far each breath reaches into the aurora tail of the ramp. GENTLE mostly
 * lives in the night blues with faint aurora hints; FULL breathes deep into
 * the pinks and cream.
 */
const AURORA_PEAK: Record<AmbientStageSetting, number> = {
  off: 0,
  gentle: 0.35,
  vivid: 0.65,
  full: 1,
};

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
  const setHueConnected = useHueStatusStore((state) => state.setConnected);

  const [phase, setPhase] = useState<HueSheetPhase>('loading');
  const [profile, setProfile] = useState<HueProfile | null>(null);
  const [rooms, setRooms] = useState<HueInventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const ambientStage = useAmbientHueStore((state) => state.stage);
  const ambientBusy = useAmbientHueStore((state) => state.isBusy);
  const ambientNotice = useAmbientHueStore((state) => state.notice);
  const setAmbientStage = useAmbientHueStore((state) => state.setStage);
  const popupRef = useRef<Window | null>(null);
  const oauthHandledRef = useRef(false);

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
    setHueConnected(result.data.connected);
  }, [setHueConnected]);

  useEffect(() => {
    if (!isOpen) {
      setPhase('loading');
      setProfile(null);
      setRooms([]);
      setError(null);
      setIsBusy(false);
      return;
    }

    void loadProfile();
  }, [isOpen, loadProfile]);

  useEffect(() => {
    if (!isOpen || pendingHueRooms.length === 0) return;
    setRooms(pendingHueRooms);
    clearPendingHueRooms();
  }, [isOpen, pendingHueRooms, clearPendingHueRooms]);

  const finishOAuthConnect = useCallback(
    async (code: string) => {
      if (oauthHandledRef.current) return;
      oauthHandledRef.current = true;

      try {
        popupRef.current?.close();
      } catch {
        // Popup already closed itself.
      }
      popupRef.current = null;

      setIsBusy(true);
      const result = await completeMeadowHueConnect(code);
      clearPendingHueOAuth();
      setIsBusy(false);

      if (!result.ok) {
        oauthHandledRef.current = false;
        setPhase('error');
        setError(result.message);
        return;
      }

      if (result.data.inventory.rooms.length > 0) {
        setRooms(result.data.inventory.rooms);
      }
      await loadProfile();
    },
    [loadProfile],
  );

  // While the Hue sign-in popup is open: postMessage is the fast path, the
  // same-origin localStorage handoff catches lost messages, and getStatus
  // polling is the backend source of truth (flips the sheet even if both
  // client channels fail). The meadow scene keeps running untouched.
  useEffect(() => {
    if (phase !== 'connecting') return undefined;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isHueOAuthMessage(event.data)) return;
      void finishOAuthConnect(event.data.code);
    };

    const consumeHandoff = () => {
      const handoff = takeHueCallbackHandoff();
      if (handoff) void finishOAuthConnect(handoff.code);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== 'meadow.hueCallbackHandoff') return;
      consumeHandoff();
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);

    const poll = window.setInterval(() => {
      consumeHandoff();
      if (oauthHandledRef.current) return;
      void fetchMeadowHueProfile().then((result) => {
        if (oauthHandledRef.current) return;
        if (result.ok && result.data.connected) {
          oauthHandledRef.current = true;
          try {
            popupRef.current?.close();
          } catch {
            // Popup already closed itself.
          }
          popupRef.current = null;
          setProfile(result.data);
          setPhase('connected');
          setHueConnected(true);
          setIsBusy(false);
        }
      });
    }, 3500);

    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(poll);
    };
  }, [phase, finishOAuthConnect, setHueConnected]);

  const handleConnect = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setPhase('connecting');
    oauthHandledRef.current = false;

    // Open the popup synchronously on tap (popup blockers require a user
    // gesture); point it at the auth URL once the backend replies. On iOS
    // Safari this becomes a new tab — acceptable, same relay flow.
    let popup: Window | null = null;
    try {
      popup = window.open('', 'meadow-hue-oauth', 'popup,width=480,height=720');
    } catch {
      popup = null;
    }
    popupRef.current = popup;

    const result = await startMeadowHueConnect();
    if (!result.ok) {
      try {
        popup?.close();
      } catch {
        // Ignore close failures on the empty popup.
      }
      popupRef.current = null;
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

    if (popup && !popup.closed) {
      try {
        popup.location.href = result.data.authUrl;
        setIsBusy(false);
        return;
      } catch {
        // Fall through to full redirect.
      }
    }

    // Popup blocked entirely — full-redirect fallback (HueOAuthHandler
    // completes the connect from URL params when the meadow reloads).
    window.location.assign(result.data.authUrl);
  }, []);

  const handleStage = useCallback(
    (stage: AmbientStageSetting) => {
      if (!profile?.connected || profile.disabled) return;
      setError(null);
      void setAmbientStage(stage);
    },
    [profile, setAmbientStage],
  );

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

    // Lights first: restore the room before the profile forgets the bridge.
    await setAmbientStage('off');
    const result = await patchMeadowHueProfile({ disconnect: true });
    setIsBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setProfile(result.data);
    setPhase('disconnected');
    setHueConnected(false);
  }, [setHueConnected, setAmbientStage]);

  if (!isOpen) return null;

  // Wrapper owns the sheet's footprint so the glow layer can bleed past the
  // panel edges without being clipped by the panel's own overflow scroll.
  const glowWrapperStyle: CSSProperties = isMobile
    ? { position: 'relative', width: '100%', pointerEvents: 'none' }
    : {
        position: 'relative',
        width: 'min(360px, calc(100vw - 32px))',
        maxWidth: '100%',
        pointerEvents: 'none',
      };

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
        width: '100%',
        maxHeight: '72vh',
        padding: '24px',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowHueFadeIn 160ms ease' : 'meadowHueSlideIn 220ms ease-out',
      };

  // Glow mirrors the room: active only while a connected session stage is on.
  // Store resets (OFF, tab hide, sign-out, disconnect) fade it out via CSS.
  const glowStage: AmbientStageSetting =
    phase === 'connected' && profile?.connected && !profile.disabled ? ambientStage : 'off';
  const glowOpacity = GLOW_OPACITY[glowStage];

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
        ${meadowGlowColorKeyframes('meadowHueGlowCool', MEADOW_GLOW_COOL_CYCLE)}
        ${meadowGlowColorKeyframes('meadowHueGlowMid', MEADOW_GLOW_MID_CYCLE)}
        ${meadowGlowColorKeyframes('meadowHueGlowWarm', MEADOW_GLOW_WARM_CYCLE)}
        @keyframes meadowHueGlowDrift {
          from { transform: translate3d(-4%, 2%, 0) scale(1); }
          to { transform: translate3d(4%, -3%, 0) scale(1.08); }
        }
        .meadow-hue-glow-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(26px);
          mix-blend-mode: screen;
          will-change: background-color, transform;
        }
        .meadow-hue-glow-blob-cool {
          animation: meadowHueGlowCool 63s linear infinite,
            meadowHueGlowDrift 21s ease-in-out -3s infinite alternate;
        }
        .meadow-hue-glow-blob-mid {
          animation: meadowHueGlowMid 47s linear infinite,
            meadowHueGlowDrift 21s ease-in-out -10s infinite alternate-reverse;
        }
        .meadow-hue-glow-blob-warm {
          animation: meadowHueGlowWarm 53s linear infinite,
            meadowHueGlowDrift 21s ease-in-out -16s infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .meadow-hue-panel { animation: meadowHueFadeIn 1ms linear !important; }
          /* Static 2-3 hue gradient — inline per-blob colors + opacity apply. */
          .meadow-hue-glow-blob { animation: none !important; }
        }
      `}</style>

      <button
        type="button"
        aria-label="Close lights settings"
        style={meadowSheetBackdropStyle}
        onClick={closeHueSheet}
      />

      <div style={glowWrapperStyle}>
        {/* Meadow-light glow behind the sheet — cascade grammar: 2-3 adjacent
            ramp hues anchored at different edges, each drifting along the arc.
            Pure CSS; footprint unchanged (hugs the sheet, vignettes to dark). */}
        <div
          aria-hidden="true"
          data-testid="meadow-hue-glow"
          data-glow-stage={glowStage}
          style={{
            position: 'absolute',
            inset: '-22px',
            borderRadius: '28px',
            filter: 'blur(30px)',
            opacity: glowOpacity,
            transition: 'opacity 2000ms ease',
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              background: MEADOW_GLOW_NIGHT_GRADIENT,
            }}
          />
          {/* Cool: steel blue → ice bleeding from the left edge. */}
          <div
            className="meadow-hue-glow-blob meadow-hue-glow-blob-cool"
            data-testid="meadow-hue-glow-blob-cool"
            style={{
              left: '-30%',
              top: '8%',
              width: '75%',
              height: '84%',
              backgroundColor: MEADOW_GLOW_COOL_STATIC,
              opacity: 0.9,
            }}
          />
          {/* Mid: ice → periwinkle → violet along the lower edge. */}
          <div
            className="meadow-hue-glow-blob meadow-hue-glow-blob-mid"
            data-testid="meadow-hue-glow-blob-mid"
            style={{
              left: '18%',
              bottom: '-34%',
              width: '70%',
              height: '72%',
              backgroundColor: MEADOW_GLOW_MID_STATIC,
              opacity: 0.35 + 0.5 * AURORA_PEAK[glowStage],
            }}
          />
          {/* Warm: violet → rose → cream warming the upper right corner;
              deeper stages reach further into the warm tail. */}
          <div
            className="meadow-hue-glow-blob meadow-hue-glow-blob-warm"
            data-testid="meadow-hue-glow-blob-warm"
            style={{
              right: '-26%',
              top: '-22%',
              width: '68%',
              height: '76%',
              backgroundColor: MEADOW_GLOW_WARM_STATIC,
              opacity: AURORA_PEAK[glowStage],
            }}
          />
        </div>
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

        <h2 id="meadow-hue-title" className="meadow-crt-title" style={meadowSheetTitleStyle}>
          Booster can glow your room along with the sky.
        </h2>

        {phase !== 'connected' ? (
          <p style={meadowSheetBodyStyle}>
            Philips Hue is optional and stays gentle by default.
          </p>
        ) : null}

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
              margin: '0 0 16px',
              fontSize: '0.68rem',
              lineHeight: 1.75,
              color: 'rgba(255, 210, 170, 0.9)',
              letterSpacing: '0.03em',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        ) : null}

        {phase === 'loading' || phase === 'connecting' ? (
          <p style={{ margin: '0 0 16px', fontSize: '0.68rem', lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.03em', textAlign: 'center' }}>
            {phase === 'connecting'
              ? 'Finish sign-in in the Philips Hue window. This sheet updates on its own.'
              : 'Checking your lights…'}
          </p>
        ) : null}

        {phase === 'connecting' ? (
          <button
            type="button"
            className="meadow-focusable"
            onClick={() => {
              try {
                popupRef.current?.close();
              } catch {
                // Popup already gone.
              }
              popupRef.current = null;
              oauthHandledRef.current = false;
              setIsBusy(false);
              setPhase('disconnected');
            }}
            style={{ ...meadowHudQuietButtonStyle, marginBottom: '10px' }}
          >
            Cancel
          </button>
        ) : null}

        {phase === 'not_ready' ? (
          <p style={{ margin: '0 0 16px', fontSize: '0.68rem', lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.03em', textAlign: 'center' }}>
            Room lighting is not enabled on this meadow yet.
          </p>
        ) : null}

        {phase === 'profile_incomplete' ? (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '0.68rem', lineHeight: 1.75, color: 'rgba(255,255,255,0.62)', letterSpacing: '0.03em', textAlign: 'center' }}>
              Almost there. A few details for the lights.
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
            <p style={{ ...meadowHudLabelStyle, margin: '0 0 10px', lineHeight: 1.6, textAlign: 'center' }}>Choose a room</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="meadow-focusable"
                  disabled={isBusy}
                  onClick={() => void handleSaveRoom(room)}
                  style={meadowHudQuietButtonStyle}
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

        {phase === 'disconnected' || phase === 'error' ? (
          <BuyLightsLink style={{ marginBottom: '12px' }} />
        ) : null}

        {phase === 'connected' && profile?.connected ? (
          <>
            <div
              role="radiogroup"
              aria-label="Meadow lights intensity"
              style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}
            >
              {(['off', 'gentle', 'vivid', 'full'] as AmbientStageSetting[]).map((stage) => {
                const isActive = ambientStage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className="meadow-focusable"
                    disabled={ambientBusy || profile.disabled}
                    onClick={() => handleStage(stage)}
                    style={{
                      ...meadowHudActionStyle,
                      flex: 1,
                      padding: '10px 0',
                      fontSize: '0.62rem',
                      letterSpacing: '0.1em',
                      opacity: ambientBusy || profile.disabled ? 0.65 : 1,
                      borderColor: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)',
                      background: isActive ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.45)',
                    }}
                  >
                    {stage.toUpperCase()}
                  </button>
                );
              })}
            </div>
            {ambientStage !== 'off' ? (
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: '0.68rem',
                  lineHeight: 1.75,
                  color: 'rgba(255,255,255,0.62)',
                  letterSpacing: '0.03em',
                  textAlign: 'center',
                }}
              >
                Lights are drifting with the meadow.
              </p>
            ) : null}
            {ambientNotice ? (
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: '0.68rem',
                  lineHeight: 1.75,
                  color: 'rgba(255, 210, 170, 0.9)',
                  letterSpacing: '0.03em',
                  textAlign: 'center',
                }}
              >
                {ambientNotice}
              </p>
            ) : null}
            {ambientNotice?.includes('no color lights') ? (
              <BuyLightsLink style={{ marginBottom: '12px' }} />
            ) : null}
            {/* Centered action row, footer-link grammar: A · B. Tighter
                letter-spacing on mobile so 390px holds one row. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '10px',
                whiteSpace: 'nowrap',
              }}
            >
              <button
                type="button"
                className="meadow-focusable"
                disabled={isBusy}
                onClick={() => void handleDisconnect()}
                style={{
                  ...meadowHudQuietButtonStyle,
                  width: 'auto',
                  letterSpacing: isMobile ? '0.05em' : '0.08em',
                }}
              >
                Disconnect Hue
              </button>
              <span aria-hidden="true" style={{ color: meadowModalTokens.muted, fontFamily: meadowHudFontFamily, fontSize: '0.65rem' }}>
                ·
              </span>
              <a
                href={BUY_LIGHTS_URL}
                target="_blank"
                rel="noopener sponsored"
                className="meadow-focusable"
                data-testid="meadow-connected-get-lights"
                style={{
                  ...meadowHudQuietButtonStyle,
                  width: 'auto',
                  letterSpacing: isMobile ? '0.05em' : '0.08em',
                  textDecoration: 'none',
                }}
              >
                Get Hue Lights
              </a>
            </div>
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
    </div>
  );
}
