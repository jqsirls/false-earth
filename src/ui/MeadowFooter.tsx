import { useRef } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowUiStore } from '../core/store/meadowUiStore';
import type { LegalModalId } from './legalModalContent';
import { trackLegalModalOpen } from './LegalModal';
import {
  meadowFocusCss,
  meadowFooterLinkStyle,
  meadowHudFontFamily,
  meadowModalTokens,
} from './meadowUiStyles';
import { TimerCountdownText } from './TimerCountdown';
import { useSessionTimerStore } from '../core/store/sessionTimerStore';

const FOOTER_ITEMS: Array<{ id: LegalModalId; label: string }> = [
  { id: 'about', label: 'About' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'research', label: 'Research' },
];

export function MeadowFooter() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const isMobile = useGameStore((state) => state.isMobile);
  const gpuError = useGameStore((state) => state.gpuError);
  const openLegalModal = useMeadowUiStore((state) => state.openLegalModal);
  const timerArmed = useSessionTimerStore((state) => state.endsAt !== null);
  const triggerRefs = useRef<Record<LegalModalId, HTMLButtonElement | null>>({
    about: null,
    terms: null,
    privacy: null,
    research: null,
  });

  if (!isControlEnabled || gpuError) return null;

  const openFromFooter = (id: LegalModalId) => {
    trackLegalModalOpen(id);
    openLegalModal(id);
  };

  // Desktop reads too dim over the bright meadow horizon; mobile's current
  // step works there (owner call, 2026-07-11).
  const restColor = isMobile ? meadowModalTokens.muted : meadowModalTokens.mutedBright;

  return (
    <>
      <style>{meadowFocusCss}</style>
      <footer
        style={{
          position: 'fixed',
          left: '50%',
          // 24px breathing room from the bottom edge (owner call, 2026-07-12).
          bottom: 'max(24px, env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          zIndex: 14,
          pointerEvents: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px 2px',
          // Fixed + left:50% shrink-to-fit only gets half the viewport; without
          // this, four links wrap to two rows on phones.
          width: 'max-content',
          maxWidth: 'min(96vw, 720px)',
          padding: '0 12px',
          color: restColor,
          fontFamily: meadowHudFontFamily,
          fontSize: '0.65rem',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        {/* © line lives in the legal modals now — the persistent HUD keeps links only. */}
        {/* Live session countdown (owner placement, 2026-07-12): mobile gets its
            own centered line above the links; desktop leads the row inline
            (`01:02 · About · …`). Renders nothing when no timer is armed. */}
        {/* Wrapper gated on the (rarely-changing) armed state so an untimed
            session gets no empty flex row; the 1s tick stays isolated inside
            TimerCountdownText. */}
        {timerArmed ? (
          isMobile ? (
            <span
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TimerCountdownText style={{ color: restColor }} />
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <TimerCountdownText trailingSeparator style={{ color: restColor }} />
            </span>
          )
        ) : null}
        {FOOTER_ITEMS.map((item, index) => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              ref={(node) => {
                triggerRefs.current[item.id] = node;
              }}
              type="button"
              className="meadow-focusable"
              style={{ ...meadowFooterLinkStyle, color: restColor }}
              onClick={() => openFromFooter(item.id)}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = meadowModalTokens.accent;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = restColor;
              }}
              onFocus={(event) => {
                event.currentTarget.style.color = meadowModalTokens.accent;
              }}
              onBlur={(event) => {
                event.currentTarget.style.color = restColor;
              }}
            >
              {item.label}
            </button>
            {index < FOOTER_ITEMS.length - 1 ? (
              <span aria-hidden style={{ opacity: 0.45, padding: '0 2px' }}>·</span>
            ) : null}
          </span>
        ))}
      </footer>
    </>
  );
}
