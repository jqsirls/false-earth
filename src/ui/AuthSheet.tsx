import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { signIn, signUp } from '../api/meadowAuthApi';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import {
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudInputStyle,
  meadowHudLabelStyle,
  meadowHudLinkStyle,
  meadowHudQuietButtonStyle,
  meadowSheetBackdropStyle,
  meadowSheetPanelBase,
} from './meadowUiStyles';

type AuthMode = 'sign_in' | 'create_account';

export function AuthSheet() {
  const isMobile = useGameStore((state) => state.isMobile);
  const reducedMotion = usePrefersReducedMotion();
  const isOpen = useMeadowAuthStore((state) => state.isAuthSheetOpen);
  const closeAuthSheet = useMeadowAuthStore((state) => state.closeAuthSheet);
  const setSession = useMeadowAuthStore((state) => state.setSession);
  const resumePendingIntent = useMeadowAuthStore((state) => state.resumePendingIntent);

  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const panelStyle: CSSProperties = isMobile
    ? {
        ...meadowSheetPanelBase,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: '16px 16px 0 0',
        padding: '24px 20px max(24px, env(safe-area-inset-bottom))',
        transform: reducedMotion ? undefined : 'translateY(0)',
        animation: reducedMotion ? 'meadowFadeIn 160ms ease' : 'meadowSlideUp 220ms ease-out',
      }
    : {
        ...meadowSheetPanelBase,
        top: 'max(20px, env(safe-area-inset-top))',
        right: 'max(20px, env(safe-area-inset-right))',
        width: 'min(360px, calc(100vw - 40px))',
        borderRadius: '12px',
        padding: '22px',
        animation: reducedMotion ? 'meadowFadeIn 160ms ease' : 'meadowSlideIn 220ms ease-out',
      };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result =
      mode === 'sign_in'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSession(result.session);
    resumePendingIntent();
  };

  return (
    <>
      <style>{`
        ${meadowFocusCss}
        @keyframes meadowSlideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes meadowSlideIn {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes meadowFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .meadow-sheet-panel { animation: meadowFadeIn 1ms linear !important; }
        }
      `}</style>

      <button
        type="button"
        aria-label="Close sign in"
        style={{
          ...meadowSheetBackdropStyle,
          border: 'none',
          padding: 0,
          cursor: 'default',
        }}
        onClick={closeAuthSheet}
      />

      <section
        className="meadow-sheet-panel meadow-focusable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meadow-auth-title"
        style={panelStyle}
      >
        <h2
          id="meadow-auth-title"
          style={{
            margin: '0 0 6px',
            fontSize: '0.85rem',
            fontWeight: 400,
            lineHeight: 1.45,
            letterSpacing: '0.04em',
          }}
        >
          One account for Booster&apos;s lights and Storytailor stories.
        </h2>

        <p style={{ margin: '0 0 18px', fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em' }}>
          Sign in or create a free account.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
          <button
            type="button"
            className="meadow-focusable"
            style={meadowHudLinkStyle(mode === 'sign_in')}
            onClick={() => setMode('sign_in')}
            aria-pressed={mode === 'sign_in'}
          >
            Sign in
          </button>
          <button
            type="button"
            className="meadow-focusable"
            style={meadowHudLinkStyle(mode === 'create_account')}
            onClick={() => setMode('create_account')}
            aria-pressed={mode === 'create_account'}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={meadowHudLabelStyle}>Email</span>
            <input
              className="meadow-focusable"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={meadowHudInputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={meadowHudLabelStyle}>Password</span>
            <input
              className="meadow-focusable"
              type="password"
              autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={meadowHudInputStyle}
            />
          </label>

          {error ? (
            <p role="alert" style={{ margin: 0, fontSize: '0.75rem', color: '#f9a8a8', letterSpacing: '0.03em' }}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="meadow-focusable"
            disabled={isSubmitting}
            style={{
              ...meadowHudActionStyle,
              opacity: isSubmitting ? 0.65 : 1,
              cursor: isSubmitting ? 'wait' : 'pointer',
            }}
          >
            {isSubmitting
              ? 'ONE MOMENT…'
              : mode === 'sign_in'
                ? '[ SIGN IN ]'
                : '[ CREATE ACCOUNT ]'}
          </button>

          <button
            type="button"
            className="meadow-focusable"
            onClick={closeAuthSheet}
            style={meadowHudQuietButtonStyle}
          >
            Not now
          </button>
        </form>
      </section>
    </>
  );
}
