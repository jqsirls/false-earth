import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import { sendOtp, verifyOtp } from '../api/meadowAuthApi';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { useFocusTrap } from '../core/hooks/useFocusTrap';
import {
  meadowCrtCss,
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudInputStyle,
  meadowHudLabelStyle,
  meadowHudLinkStyle,
  meadowHudQuietButtonStyle,
  meadowOverlayRootStyle,
  meadowSheetBackdropStyle,
  meadowSheetPanelBase,
} from './meadowUiStyles';

type AuthStep = 'email' | 'code';

const RESEND_COOLDOWN_SEC = 30;
const OTP_LENGTH = 6;

export function AuthSheet() {
  const isMobile = useGameStore((state) => state.isMobile);
  const reducedMotion = usePrefersReducedMotion();
  const isOpen = useMeadowAuthStore((state) => state.isAuthSheetOpen);
  const closeAuthSheet = useMeadowAuthStore((state) => state.closeAuthSheet);
  const setSession = useMeadowAuthStore((state) => state.setSession);
  const resumePendingIntent = useMeadowAuthStore((state) => state.resumePendingIntent);

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen) {
      setStep('email');
      setEmail('');
      setDigits(Array(OTP_LENGTH).fill(''));
      setError(null);
      setIsSubmitting(false);
      setResendCooldown(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === 'code') {
      digitRefs.current[0]?.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  const panelStyle: CSSProperties = isMobile
    ? {
        ...meadowSheetPanelBase,
        width: '100%',
        borderRadius: '10px 10px 0 0',
        maxHeight: '82vh',
        padding: '24px 20px max(24px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowFadeIn 160ms ease' : 'meadowSlideUp 220ms ease-out',
      }
    : {
        ...meadowSheetPanelBase,
        width: 'min(360px, calc(100vw - 32px))',
        maxHeight: '72vh',
        padding: '24px',
        overflowY: 'auto',
        animation: reducedMotion ? 'meadowFadeIn 160ms ease' : 'meadowSlideIn 220ms ease-out',
      };

  const transparencyLine = (
    <p
      style={{
        margin: '12px 0 0',
        fontSize: '0.68rem',
        color: 'rgba(242, 245, 250, 0.45)',
        letterSpacing: '0.03em',
        lineHeight: 1.5,
      }}
    >
      New here? Signing in creates your free Storytailor account.
    </p>
  );

  const handleSendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await sendOtp(email.trim());
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setStep('code');
    setDigits(Array(OTP_LENGTH).fill(''));
    setResendCooldown(RESEND_COOLDOWN_SEC);
  };

  const handleVerifyCode = async (code: string) => {
    setError(null);
    setIsSubmitting(true);

    const result = await verifyOtp(email.trim(), code);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      setDigits(Array(OTP_LENGTH).fill(''));
      digitRefs.current[0]?.focus();
      return;
    }

    setSession(result.session);
    resumePendingIntent();
  };

  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '');

    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, OTP_LENGTH).split('');
      const next = [...digits];
      pasted.forEach((char, offset) => {
        if (index + offset < OTP_LENGTH) {
          next[index + offset] = char;
        }
      });
      setDigits(next);
      const focusIndex = Math.min(index + pasted.length, OTP_LENGTH - 1);
      digitRefs.current[focusIndex]?.focus();
      if (next.every((digit) => digit.length === 1)) {
        void handleVerifyCode(next.join(''));
      }
      return;
    }

    const next = [...digits];
    next[index] = sanitized;
    setDigits(next);

    if (sanitized && index < OTP_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }

    if (next.every((digit) => digit.length === 1)) {
      void handleVerifyCode(next.join(''));
    }
  };

  const handleDigitKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    await handleSendCode();
  };

  const handleUseDifferentEmail = () => {
    setStep('email');
    setDigits(Array(OTP_LENGTH).fill(''));
    setError(null);
    setResendCooldown(0);
  };

  return (
    <div style={meadowOverlayRootStyle(isMobile)}>
      <style>{`
        ${meadowFocusCss}
        ${meadowCrtCss}
        @keyframes meadowSlideUp {
          from { transform: translateY(12px); opacity: 0; }
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
        style={meadowSheetBackdropStyle}
        onClick={closeAuthSheet}
      />

      <section
        ref={panelRef}
        className="meadow-sheet-panel meadow-crt-panel meadow-crt-warmup meadow-focusable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meadow-auth-title"
        tabIndex={-1}
        style={panelStyle}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          {!isMobile ? (
            <button
              type="button"
              className="meadow-focusable meadow-crt-keycap"
              onClick={closeAuthSheet}
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
              onClick={closeAuthSheet}
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

        {step === 'email' ? (
          <>
            <h2
              id="meadow-auth-title"
              className="meadow-crt-title"
              style={{
                margin: '0 0 18px',
                fontSize: '0.85rem',
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: '0.04em',
              }}
            >
              One account for Booster&apos;s lights and Storytailor stories.
            </h2>

            <form onSubmit={handleSendCode} style={{ display: 'grid', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={meadowHudLabelStyle}>Email</span>
                <input
                  className="meadow-focusable"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                {isSubmitting ? 'ONE MOMENT…' : 'Send my code'}
              </button>

              {transparencyLine}

              <button
                type="button"
                className="meadow-focusable"
                onClick={closeAuthSheet}
                style={meadowHudQuietButtonStyle}
              >
                Not now
              </button>
            </form>
          </>
        ) : (
          <>
            <h2
              id="meadow-auth-title"
              className="meadow-crt-title"
              style={{
                margin: '0 0 6px',
                fontSize: '0.85rem',
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: '0.04em',
              }}
            >
              Check your email.
            </h2>

            <p style={{ margin: '0 0 18px', fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
              We sent a 6 digit code to {email.trim()}.
            </p>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div
                role="group"
                aria-label="6-digit verification code"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${OTP_LENGTH}, 1fr)`,
                  gap: '8px',
                }}
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      digitRefs.current[index] = element;
                    }}
                    className="meadow-focusable"
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={OTP_LENGTH}
                    value={digit}
                    aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                    onChange={(event) => handleDigitChange(index, event.target.value)}
                    onKeyDown={(event) => handleDigitKeyDown(index, event)}
                    style={{
                      ...meadowHudInputStyle,
                      textAlign: 'center',
                      padding: '10px 4px',
                      fontSize: '1rem',
                      letterSpacing: '0.08em',
                    }}
                  />
                ))}
              </div>

              {error ? (
                <p role="alert" style={{ margin: 0, fontSize: '0.75rem', color: '#f9a8a8', letterSpacing: '0.03em' }}>
                  {error}
                </p>
              ) : null}

              {isSubmitting ? (
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em' }}>
                  ONE MOMENT…
                </p>
              ) : null}

              <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em' }}>
                Didn&apos;t get it?{' '}
                <button
                  type="button"
                  className="meadow-focusable"
                  disabled={resendCooldown > 0 || isSubmitting}
                  style={{
                    ...meadowHudLinkStyle(false),
                    display: 'inline',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    opacity: resendCooldown > 0 ? 0.5 : 1,
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => void handleResend()}
                >
                  Resend code{resendCooldown > 0 ? ` (${resendCooldown}s)` : ''}
                </button>
              </p>

              {transparencyLine}

              <button
                type="button"
                className="meadow-focusable"
                onClick={handleUseDifferentEmail}
                style={meadowHudQuietButtonStyle}
              >
                Use a different email
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
