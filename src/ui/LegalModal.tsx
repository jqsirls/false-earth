import { useEffect, useRef } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { useMeadowUiStore } from '../core/store/meadowUiStore';
import { useFocusTrap } from '../core/hooks/useFocusTrap';
import { useHueEntry } from '../core/hooks/useHueEntry';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';
import { LEGAL_MODAL_CONTENT, type LegalModalId } from './legalModalContent';
import { BuyLightsLink } from './BuyLightsLink';
import {
  meadowClickableCss,
  meadowCrtCss,
  meadowFocusCss,
  meadowHudActionStyle,
  meadowHudFontFamily,
  meadowLegalPanelDesktop,
  meadowLegalPanelMobile,
  meadowModalTokens,
  meadowOverlayRootStyle,
  meadowSheetBackdropStyle,
} from './meadowUiStyles';

function renderParagraph(text: string) {
  const termsMatch = text.match(/storytailor\.com\/terms/);
  const privacyMatch = text.match(/storytailor\.com\/privacy/);
  const mingMatch = text.match(/mingjyunhung\.com/);

  if (termsMatch) {
    const [before, after] = text.split('storytailor.com/terms');
    return (
      <>
        {before}
        <a
          href="https://storytailor.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="meadow-clickable"
          style={{ color: meadowModalTokens.accent, textDecoration: 'none' }}
        >
          storytailor.com/terms
        </a>
        {after}
      </>
    );
  }

  if (privacyMatch) {
    const [before, after] = text.split('storytailor.com/privacy');
    return (
      <>
        {before}
        <a
          href="https://storytailor.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="meadow-clickable"
          style={{ color: meadowModalTokens.accent, textDecoration: 'none' }}
        >
          storytailor.com/privacy
        </a>
        {after}
      </>
    );
  }

  if (mingMatch) {
    const [before, after] = text.split('mingjyunhung.com');
    return (
      <>
        {before}
        <a
          href="https://mingjyunhung.com"
          target="_blank"
          rel="noopener noreferrer"
          className="meadow-clickable"
          style={{ color: meadowModalTokens.accent, textDecoration: 'none' }}
        >
          mingjyunhung.com
        </a>
        {after}
      </>
    );
  }

  if (text.includes('@')) {
    return (
      <a
        href={`mailto:${text}`}
        className="meadow-clickable"
        style={{ color: meadowModalTokens.accent, textDecoration: 'none' }}
      >
        {text}
      </a>
    );
  }

  return text;
}

export function LegalModal() {
  const isMobile = useGameStore((state) => state.isMobile);
  const reducedMotion = usePrefersReducedMotion();
  const legalModal = useMeadowUiStore((state) => state.legalModal);
  const closeLegalModal = useMeadowUiStore((state) => state.closeLegalModal);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { isChecking: isHueEntryChecking, enterHueFlow } = useHueEntry();

  useFocusTrap(Boolean(legalModal), panelRef);

  useEffect(() => {
    if (legalModal) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
        triggerRef.current?.focus?.();
      };
    }
    return undefined;
  }, [legalModal]);

  if (!legalModal) return null;

  const content = LEGAL_MODAL_CONTENT[legalModal];
  const panelStyle = isMobile ? meadowLegalPanelMobile : meadowLegalPanelDesktop;
  const enterAnimation = reducedMotion
    ? 'meadowLegalFadeIn 160ms ease forwards'
    : isMobile
      ? 'meadowLegalSlideUp 220ms ease-out forwards'
      : 'meadowLegalRiseIn 220ms ease-out forwards';

  return (
    <div style={meadowOverlayRootStyle(isMobile)}>
      <style>{`${meadowFocusCss}${meadowClickableCss}${meadowCrtCss}`}</style>

      <button
        type="button"
        aria-label="Close dialog"
        style={{
          ...meadowSheetBackdropStyle,
          animation: 'meadowLegalFadeIn 160ms ease forwards',
        }}
        onClick={closeLegalModal}
      />

      <section
        ref={panelRef}
        className="meadow-crt-panel meadow-crt-warmup meadow-focusable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meadow-legal-title"
        tabIndex={-1}
        style={{
          ...panelStyle,
          animation: enterAnimation,
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <h2
            id="meadow-legal-title"
            className="meadow-crt-title"
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: meadowHudFontFamily,
            }}
          >
            {content.title}
            {!reducedMotion && (
              <span className="meadow-crt-cursor" aria-hidden style={{ marginLeft: '4px', animation: 'meadowBlink 1.2s step-end infinite' }}>
                ▮
              </span>
            )}
          </h2>

          {isMobile ? (
            <button
              type="button"
              className="meadow-focusable meadow-crt-keycap"
              aria-label="Close"
              onClick={closeLegalModal}
              style={{
                minWidth: '44px',
                minHeight: '44px',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.35)',
                color: meadowModalTokens.accent,
                fontFamily: meadowHudFontFamily,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              className="meadow-focusable meadow-crt-keycap"
              onClick={closeLegalModal}
              style={{
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '4px',
                background: 'rgba(0,0,0,0.35)',
                color: meadowModalTokens.accent,
                fontFamily: meadowHudFontFamily,
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              [ ESC ]
            </button>
          )}
        </div>

        {content.lastUpdated ? (
          <p style={{ margin: '0 0 16px', fontSize: '11px', color: meadowModalTokens.muted, letterSpacing: '0.04em' }}>
            Last updated: {content.lastUpdated}
          </p>
        ) : null}

        <div
          className={`meadow-modal-scroll ${isMobile ? 'meadow-modal-scroll-mobile' : ''}`}
          style={{ flex: '1 1 auto', minHeight: 0 }}
        >
          {content.sections.map((section, sectionIndex) => (
            <div key={`${content.id}-section-${sectionIndex}`} style={{ marginBottom: '18px' }}>
              {section.heading ? (
                <h3
                  className="meadow-crt-section"
                  style={{
                    margin: '0 0 8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: meadowModalTokens.muted,
                    fontFamily: meadowHudFontFamily,
                  }}
                >
                  {section.heading}
                </h3>
              ) : null}
              {section.subheading ? (
                <p
                  className="meadow-crt-section"
                  style={{
                    margin: '0 0 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontFamily: meadowHudFontFamily,
                  }}
                >
                  {section.subheading}
                </p>
              ) : null}
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={`${content.id}-p-${sectionIndex}-${paragraphIndex}`}
                  style={{
                    margin:
                      paragraphIndex === section.paragraphs.length - 1 && !section.citations?.length
                        ? 0
                        : '0 0 12px',
                    fontSize: '13.5px',
                    lineHeight: 1.75,
                    maxWidth: '62ch',
                    fontFamily: meadowHudFontFamily,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {renderParagraph(paragraph)}
                </p>
              ))}
              {section.citations?.length ? (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    fontSize: '11.5px',
                    lineHeight: 1.7,
                    color: meadowModalTokens.muted,
                    fontFamily: meadowHudFontFamily,
                  }}
                >
                  {section.citations.map((citation) => (
                    <li key={citation.url} style={{ overflowWrap: 'anywhere' }}>
                      {'\u2192 '}
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="meadow-clickable"
                        style={{
                          color: meadowModalTokens.accent,
                          textDecoration: 'none',
                        }}
                      >
                        {citation.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        {content.id === 'about' ? (
          <div style={{ marginTop: '18px' }}>
            <button
              type="button"
              className="meadow-focusable meadow-clickable"
              data-testid="meadow-about-connect-lights"
              aria-busy={isHueEntryChecking}
              onClick={() => void enterHueFlow(closeLegalModal)}
              style={{
                ...meadowHudActionStyle,
                opacity: isHueEntryChecking ? 0.65 : 1,
                cursor: isHueEntryChecking ? 'wait' : 'pointer',
              }}
            >
              [ CONNECT LIGHTS ]
            </button>
            <BuyLightsLink style={{ marginTop: '10px' }} />
          </div>
        ) : null}

        <p
          style={{
            margin: '16px 0 0',
            fontSize: '11px',
            letterSpacing: '0.06em',
            color: meadowModalTokens.muted,
            fontFamily: meadowHudFontFamily,
          }}
        >
          © 2026 Storytailor Inc.
        </p>
      </section>

      <style>{`
        @keyframes meadowBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function trackLegalModalOpen(_id: LegalModalId) {
  if (import.meta.env.DEV) {
    console.info('[meadow] legal modal open');
  }
}
