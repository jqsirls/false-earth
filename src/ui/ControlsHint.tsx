import type { ReactNode } from 'react';
import { useGameStore } from '../core/store/gameStore';

export const HintKey = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '18px',
      height: '22px',
      padding: '0 5px',
      margin: '0 4px',
      border: '1px solid #555',
      borderRadius: '4px',
      background: 'rgba(255,255,255,0.05)',
      fontFamily: 'monospace',
      fontSize: '0.7rem',
      fontWeight: 'bold',
      color: '#ccc',
      lineHeight: 1,
      verticalAlign: 'middle',
      boxSizing: 'border-box',
    }}
  >
    {children}
  </span>
);

const MouseIcon = () => (
  <span
    style={{
      display: 'inline-block',
      position: 'relative',
      width: '12px',
      height: '18px',
      margin: '0 4px',
      border: '1.5px solid #ccc',
      borderRadius: '6px',
      verticalAlign: 'middle',
      opacity: 0.8,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '3px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '1.5px',
        height: '4px',
        background: '#ccc',
        borderRadius: '1px',
      }}
    />
  </span>
);

export const HintRow = ({ input, label }: { input: ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
    {input}
    <span
      style={{
        marginLeft: '6px',
        fontSize: '0.7rem',
        letterSpacing: '1px',
        fontWeight: 500,
        transform: 'translateY(1px)',
      }}
    >
      {label}
    </span>
  </div>
);

/**
 * Desktop-only persistent control row. Mobile carries no persistent hint:
 * the joystick/drag are self-evident and flight gets the one-time centered
 * intro (IntroFlightHint) instead.
 */
export function ControlsHint() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isMobile = useGameStore((state) => state.isMobile);
  const gpuError = useGameStore((state) => state.gpuError);

  if (!isControlEnabled || gpuError || isMobile) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(56px, calc(24px + env(safe-area-inset-bottom)))',
        transform: 'translateX(-50%)',
        zIndex: 15,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '96vw',
        padding: '0 16px',
        color: '#ccc',
        fontFamily: 'Cousine, monospace',
        fontSize: '0.8rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          // One line, always: chips condensed (DRAG, not DRAG TO LOOK) so the
          // full row fits without wrapping.
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
          opacity: 0.85,
        }}
      >
        <HintRow
          input={
            <>
              <HintKey>W</HintKey>
              <HintKey>A</HintKey>
              <HintKey>S</HintKey>
              <HintKey>D</HintKey>
            </>
          }
          label="MOVE"
        />
        <HintRow input={<HintKey>SHIFT</HintKey>} label="RUN" />
        <HintRow input={<HintKey>F</HintKey>} label="FLY" />
        <HintRow input={<MouseIcon />} label="DRAG" />
        <HintRow
          input={
            <>
              <HintKey>DBL</HintKey>
              <HintKey>TAP</HintKey>
            </>
          }
          label="FLY"
        />
        <HintRow input={<HintKey>M</HintKey>} label="MUSIC" />
        <HintRow input={<HintKey>H</HintKey>} label="HIDE" />
      </div>
    </div>
  );
}
