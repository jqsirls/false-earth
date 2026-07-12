import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useSessionTimerStore } from '../core/store/sessionTimerStore';
import { useIsMeadowOverlayOpen } from '../core/hooks/useIsMeadowOverlayOpen';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { meadowClickableCss, meadowHudFontFamily, meadowModalTokens } from './meadowUiStyles';
import { SessionTimerPresetRow } from './SessionTimerPresetRow';

const FADE_IN_MS = 12_000;
const FADE_IN_REDUCED_MS = 1_600;
const FADE_OUT_MS = 1_800;
const TEXT_DELAY_MS = 5_000;
const TEXT_FADE_MS = 4_000;

type Phase = 'idle' | 'fading' | 'returning';

/**
 * Soft session ending: when the optional timer expires, the meadow fades
 * slowly toward black while the music keeps playing. The same preset row
 * from the START gate lets the user choose a new limit (or NONE to stay
 * untimed); any choice returns them to the meadow. There is deliberately
 * no explicit "leave" button: closing the tab is leaving, and this quiet
 * fade screen should not grow chrome.
 * Never interrupts an open sheet or modal; waits for it to close.
 */
export function SessionEnd() {
  const isGameStarted = useGameStore((state) => state.isGameStarted);
  const endsAt = useSessionTimerStore((state) => state.endsAt);
  const selectedMinutes = useSessionTimerStore((state) => state.selectedMinutes);
  const restart = useSessionTimerStore((state) => state.restart);
  const isOverlayOpen = useIsMeadowOverlayOpen();
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [faded, setFaded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Watch the clock; only begin the fade when no sheet or modal is open.
  useEffect(() => {
    if (phase !== 'idle' || !isGameStarted || !endsAt) return;

    // isOverlayOpen is a dependency, so an open sheet simply defers the fade
    // until the effect re-runs with the sheet closed.
    const tick = () => {
      if (Date.now() >= endsAt && !isOverlayOpen) {
        setPhase('fading');
      }
    };

    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [phase, isGameStarted, endsAt, isOverlayOpen]);

  // Drive the CSS fade one frame after mount so the transition runs.
  useEffect(() => {
    if (phase === 'fading') {
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setFaded(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    if (phase === 'returning') {
      setFaded(false);
      const id = window.setTimeout(() => setPhase('idle'), FADE_OUT_MS + 100);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  if (phase === 'idle') return null;

  const fadeInMs = reducedMotion ? FADE_IN_REDUCED_MS : FADE_IN_MS;
  const textVisible = faded && phase === 'fading';

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label="Your time in the meadow is up."
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '28px',
        background: '#000',
        opacity: faded ? 1 : 0,
        transition: `opacity ${faded ? fadeInMs : FADE_OUT_MS}ms ease-in-out`,
        pointerEvents: 'auto',
        textAlign: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <style>{meadowClickableCss}</style>
      <p
        style={{
          margin: 0,
          fontFamily: meadowHudFontFamily,
          fontSize: '0.9rem',
          letterSpacing: '0.12em',
          lineHeight: 1.8,
          color: meadowModalTokens.text,
          opacity: textVisible ? 1 : 0,
          transition: reducedMotion
            ? `opacity 400ms ease ${phase === 'fading' ? 600 : 0}ms`
            : `opacity ${TEXT_FADE_MS}ms ease ${phase === 'fading' ? TEXT_DELAY_MS : 0}ms`,
        }}
      >
        Your time in the meadow is up.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          opacity: textVisible ? 1 : 0,
          transition: reducedMotion
            ? `opacity 400ms ease ${phase === 'fading' ? 800 : 0}ms`
            : `opacity ${TEXT_FADE_MS}ms ease ${phase === 'fading' ? TEXT_DELAY_MS + 1_200 : 0}ms`,
          pointerEvents: textVisible ? 'auto' : 'none',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: meadowHudFontFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            color: meadowModalTokens.mutedBright,
          }}
        >
          Stay a little longer?
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            fontFamily: meadowHudFontFamily,
            fontSize: '0.8rem',
            letterSpacing: '0.12em',
          }}
        >
          <SessionTimerPresetRow
            selectedMinutes={selectedMinutes}
            onSelect={(minutes) => {
              restart(minutes);
              setPhase('returning');
            }}
          />
        </div>
      </div>
    </div>
  );
}
