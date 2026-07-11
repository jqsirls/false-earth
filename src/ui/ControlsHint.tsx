import type { ReactNode } from 'react';
import { useGameStore } from '../core/store/gameStore';

const Key = ({ children }: { children: ReactNode }) => (
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

const InstructionRow = ({ input, label }: { input: ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
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

export function ControlsHint() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isMobile = useGameStore((state) => state.isMobile);
  const gpuError = useGameStore((state) => state.gpuError);

  if (!isControlEnabled || gpuError) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        // Mobile: sit tight above the footer links so hint + divider + links
        // read as one quiet centered cluster.
        bottom: isMobile
          ? 'calc(max(8px, env(safe-area-inset-bottom)) + 44px)'
          : 'max(52px, calc(20px + env(safe-area-inset-bottom)))',
        transform: 'translateX(-50%)',
        zIndex: 15,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        maxWidth: 'min(96vw, 720px)',
        padding: '0 16px',
        color: '#ccc',
        fontFamily: 'Cousine, monospace',
        fontSize: '0.8rem',
      }}
    >
      {isMobile ? (
        <>
          {/* Flight is the one non-obvious mechanic; joystick/drag are self-evident. */}
          <p
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            Double tap to fly
          </p>
          <span
            aria-hidden
            style={{
              display: 'block',
              width: '24px',
              height: '1px',
              background: 'rgba(255,255,255,0.25)',
            }}
          />
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '24px',
              flexWrap: 'wrap',
              opacity: 0.85,
            }}
          >
            <InstructionRow
              input={
                <>
                  <Key>W</Key>
                  <Key>A</Key>
                  <Key>S</Key>
                  <Key>D</Key>
                </>
              }
              label="MOVE"
            />
            <InstructionRow input={<Key>SHIFT</Key>} label="RUN" />
            <InstructionRow input={<MouseIcon />} label="LOOK" />
            <InstructionRow
              input={
                <>
                  <Key>DBL</Key>
                  <Key>TAP</Key>
                </>
              }
              label="FLY"
            />
            <InstructionRow input={<Key>M</Key>} label="MUSIC" />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '0.65rem',
              letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
            }}
          >
            To show your cursor, press the esc button.
          </p>
        </>
      )}
    </div>
  );
}
