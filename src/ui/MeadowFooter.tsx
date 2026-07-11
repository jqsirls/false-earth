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

const FOOTER_ITEMS: Array<{ id: LegalModalId; label: string }> = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'research', label: 'Research' },
];

export function MeadowFooter() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const gpuError = useGameStore((state) => state.gpuError);
  const openLegalModal = useMeadowUiStore((state) => state.openLegalModal);
  const triggerRefs = useRef<Record<LegalModalId, HTMLButtonElement | null>>({
    terms: null,
    privacy: null,
    research: null,
  });

  if (!isControlEnabled || gpuError) return null;

  const openFromFooter = (id: LegalModalId) => {
    trackLegalModalOpen(id);
    openLegalModal(id);
  };

  return (
    <>
      <style>{meadowFocusCss}</style>
      <footer
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'max(8px, env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          zIndex: 14,
          pointerEvents: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px 2px',
          maxWidth: 'min(96vw, 720px)',
          padding: '0 12px',
          color: meadowModalTokens.muted,
          fontFamily: meadowHudFontFamily,
          fontSize: '0.65rem',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        <span style={{ padding: '12px 4px' }}>© 2026 Storytailor Inc.</span>
        <span aria-hidden style={{ opacity: 0.45 }}>·</span>
        {FOOTER_ITEMS.map((item, index) => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              ref={(node) => {
                triggerRefs.current[item.id] = node;
              }}
              type="button"
              className="meadow-focusable"
              style={meadowFooterLinkStyle}
              onClick={() => openFromFooter(item.id)}
              onMouseEnter={(event) => {
                event.currentTarget.style.textDecoration = 'underline';
                event.currentTarget.style.color = meadowModalTokens.accent;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.textDecoration = 'none';
                event.currentTarget.style.color = meadowModalTokens.muted;
              }}
              onFocus={(event) => {
                event.currentTarget.style.textDecoration = 'underline';
                event.currentTarget.style.color = meadowModalTokens.accent;
              }}
              onBlur={(event) => {
                event.currentTarget.style.textDecoration = 'none';
                event.currentTarget.style.color = meadowModalTokens.muted;
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
