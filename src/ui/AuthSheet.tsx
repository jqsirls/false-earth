import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowAuthStore } from '../core/store/meadowAuthStore';
import {
  completeProfile,
  getProfileStatus,
  MEADOW_USER_TYPE_OPTIONS,
  sendOtp,
  verifyOtp,
} from '../api/meadowAuthApi';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { useFocusTrap } from '../core/hooks/useFocusTrap';
import {
  meadowClickableCss,
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

type AuthStep = 'email' | 'code' | 'profile' | 'checking';

const RESEND_COOLDOWN_SEC = 30;
const OTP_LENGTH = 6;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildBirthday(year: string, month: string, day: string): string | null {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return null;
  }
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return `${year}-${pad2(m)}-${pad2(d)}`;
}

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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [userType, setUserType] = useState('');
  const [firstNameRequired, setFirstNameRequired] = useState(true);

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
      setFirstName('');
      setLastName('');
      setBirthYear('');
      setBirthMonth('');
      setBirthDay('');
      setUserType('');
      setFirstNameRequired(true);
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

  // Opened while already signed in (lamp gate / Hue sheet CONTINUE):
  // check profile status and land directly on the profile step.
  useEffect(() => {
    if (!isOpen) return undefined;
    const session = useMeadowAuthStore.getState().session;
    if (!session) return undefined;

    let cancelled = false;
    setStep('checking');

    void (async () => {
      const statusResult = await getProfileStatus();
      if (cancelled) return;

      if (!statusResult.ok) {
        setError(statusResult.message);
        setStep('profile');
        return;
      }

      if (statusResult.status.complete) {
        resumePendingIntent();
        return;
      }

      const prefill = statusResult.status.prefill;
      if (prefill.firstName) {
        setFirstName(prefill.firstName);
        setFirstNameRequired(false);
      } else {
        setFirstName('');
        setFirstNameRequired(true);
      }
      setLastName(prefill.lastName ?? '');
      setStep('profile');
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, resumePendingIntent]);

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

  const afterVerifySuccess = async () => {
    const statusResult = await getProfileStatus();
    if (!statusResult.ok) {
      setError(statusResult.message);
      return;
    }

    if (statusResult.status.complete) {
      resumePendingIntent();
      return;
    }

    const prefill = statusResult.status.prefill;
    if (prefill.firstName) {
      setFirstName(prefill.firstName);
      setFirstNameRequired(false);
    } else {
      setFirstName('');
      setFirstNameRequired(true);
    }
    setLastName(prefill.lastName ?? '');
    setBirthYear('');
    setBirthMonth('');
    setBirthDay('');
    setUserType('');
    setStep('profile');
  };

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
    if (!result.ok) {
      setIsSubmitting(false);
      setError(result.message);
      setDigits(Array(OTP_LENGTH).fill(''));
      digitRefs.current[0]?.focus();
      return;
    }

    setSession(result.session);
    await afterVerifySuccess();
    setIsSubmitting(false);
  };

  const handleCompleteProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const birthday = buildBirthday(birthYear.trim(), birthMonth.trim(), birthDay.trim());
    if (!birthday) {
      setError('Enter a valid birthday.');
      return;
    }
    if (firstNameRequired && !firstName.trim()) {
      setError('Enter your first name.');
      return;
    }
    if (!firstName.trim()) {
      setError('Enter your first name.');
      return;
    }
    if (!userType) {
      setError('Choose how you use Storytailor.');
      return;
    }

    setIsSubmitting(true);
    const result = await completeProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      birthday,
      userType,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

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

  const selectStyle: CSSProperties = {
    ...meadowHudInputStyle,
    appearance: 'none' as const,
    backgroundImage:
      'linear-gradient(45deg, transparent 50%, rgba(242,245,250,0.7) 50%), linear-gradient(135deg, rgba(242,245,250,0.7) 50%, transparent 50%)',
    backgroundPosition: 'calc(100% - 16px) calc(50% - 2px), calc(100% - 11px) calc(50% - 2px)',
    backgroundSize: '5px 5px, 5px 5px',
    backgroundRepeat: 'no-repeat',
    paddingRight: '28px',
  };

  return (
    <div style={meadowOverlayRootStyle(isMobile)}>
      <style>{`
        ${meadowFocusCss}
        ${meadowClickableCss}
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

        {step === 'checking' ? (
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
              ONE MOMENT…
            </h2>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
              Checking your account.
            </p>
          </>
        ) : null}

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
                className="meadow-focusable meadow-clickable"
                onClick={closeAuthSheet}
                style={meadowHudQuietButtonStyle}
              >
                Not now
              </button>
            </form>
          </>
        ) : null}

        {step === 'code' ? (
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
                  className="meadow-focusable meadow-clickable"
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
                className="meadow-focusable meadow-clickable"
                onClick={handleUseDifferentEmail}
                style={meadowHudQuietButtonStyle}
              >
                Use a different email
              </button>
            </div>
          </>
        ) : null}

        {step === 'profile' ? (
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
              A few details so we can turn on the lights.
            </h2>

            <p style={{ margin: '0 0 18px', fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.45)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
              One quick step — then Booster can light the room.
            </p>

            <form onSubmit={handleCompleteProfile} style={{ display: 'grid', gap: '14px' }}>
              {(firstNameRequired || !firstName) ? (
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={meadowHudLabelStyle}>First name</span>
                  <input
                    className="meadow-focusable"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    style={meadowHudInputStyle}
                  />
                </label>
              ) : (
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(242, 245, 250, 0.55)', letterSpacing: '0.04em' }}>
                  Hi, {firstName}.
                </p>
              )}

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={meadowHudLabelStyle}>Last name (optional)</span>
                <input
                  className="meadow-focusable"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  style={meadowHudInputStyle}
                />
              </label>

              <fieldset style={{ margin: 0, padding: 0, border: 'none', display: 'grid', gap: '6px' }}>
                <legend style={meadowHudLabelStyle}>Birthday</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: '8px' }}>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ ...meadowHudLabelStyle, fontSize: '0.58rem' }}>Year</span>
                    <input
                      className="meadow-focusable"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday-year"
                      placeholder="YYYY"
                      maxLength={4}
                      required
                      value={birthYear}
                      onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      style={meadowHudInputStyle}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ ...meadowHudLabelStyle, fontSize: '0.58rem' }}>Month</span>
                    <input
                      className="meadow-focusable"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday-month"
                      placeholder="MM"
                      maxLength={2}
                      required
                      value={birthMonth}
                      onChange={(event) => setBirthMonth(event.target.value.replace(/\D/g, '').slice(0, 2))}
                      style={meadowHudInputStyle}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ ...meadowHudLabelStyle, fontSize: '0.58rem' }}>Day</span>
                    <input
                      className="meadow-focusable"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday-day"
                      placeholder="DD"
                      maxLength={2}
                      required
                      value={birthDay}
                      onChange={(event) => setBirthDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
                      style={meadowHudInputStyle}
                    />
                  </label>
                </div>
              </fieldset>

              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={meadowHudLabelStyle}>I am a…</span>
                <select
                  className="meadow-focusable"
                  required
                  value={userType}
                  onChange={(event) => setUserType(event.target.value)}
                  style={selectStyle}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {MEADOW_USER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
                {isSubmitting ? 'ONE MOMENT…' : 'Continue'}
              </button>

              <button
                type="button"
                className="meadow-focusable meadow-clickable"
                onClick={closeAuthSheet}
                style={meadowHudQuietButtonStyle}
              >
                Not now
              </button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
