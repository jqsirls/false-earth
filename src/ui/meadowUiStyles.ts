import type { CSSProperties } from 'react';



export const meadowFontFamily = 'Inter, system-ui, sans-serif';

export const meadowHudFontFamily = 'Cousine, monospace';



/** PRD §3.1 modal tokens */

export const meadowModalTokens = {

  backdrop: 'rgba(4, 6, 11, 0.82)',

  bg: '#0A0D14',

  border: 'rgba(255, 255, 255, 0.14)',

  text: '#F2F5FA',

  muted: 'rgba(242, 245, 250, 0.55)',

  accent: '#FFFFFF',

  radius: '10px',

  maxWidth: '560px',

} as const;



export const meadowPillStyle: CSSProperties = {

  display: 'inline-flex',

  alignItems: 'center',

  justifyContent: 'center',

  padding: '10px 20px',

  borderRadius: '999px',

  border: '1px solid rgba(255,255,255,0.22)',

  background: 'rgba(0,0,0,0.45)',

  color: '#fff',

  fontFamily: meadowFontFamily,

  fontSize: '0.8rem',

  letterSpacing: '0.08em',

  textTransform: 'uppercase',

  outline: 'none',

  cursor: 'pointer',

};



export const meadowIconPillStyle: CSSProperties = {

  ...meadowPillStyle,

  padding: '10px 14px',

  textTransform: 'none',

  letterSpacing: 'normal',

};



export const meadowFocusCss = `

  .meadow-focusable:focus-visible {

    box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 4px rgba(21,94,239,0.85);

  }

`;



export const meadowCrtCss = `

  .meadow-crt-panel {

    position: relative;

    overflow: hidden;

    box-sizing: border-box;

    box-shadow:

      inset 0 0 60px rgba(0, 0, 0, 0.55),

      0 0 24px rgba(140, 180, 220, 0.08);

  }

  .meadow-crt-panel::after {

    content: '';

    pointer-events: none;

    position: absolute;

    inset: 0;

    border-radius: inherit;

    background: repeating-linear-gradient(

      180deg,

      rgba(255, 255, 255, 0.028) 0 1px,

      transparent 1px 3px

    );

    mix-blend-mode: overlay;

    z-index: 2;

  }

  .meadow-crt-warmup {

    animation: meadowCrtWarmup 300ms ease-out forwards;

  }

  @keyframes meadowCrtWarmup {

    from { opacity: 0.35; }

    to { opacity: 1; }

  }

  .meadow-crt-title {

    text-shadow: 0 0 8px rgba(190, 220, 255, 0.35);

  }

  .meadow-crt-section {

    text-shadow: 0 0 6px rgba(190, 220, 255, 0.2);

  }

  .meadow-crt-keycap {

    text-shadow: 0 0 6px rgba(190, 220, 255, 0.25);

  }

  .meadow-modal-scroll {

    position: relative;

    overflow-y: auto;

    overflow-x: hidden;

    max-height: calc(72vh - 120px);

    -webkit-overflow-scrolling: touch;

    overflow-wrap: anywhere;

    word-break: break-word;

    mask-image: linear-gradient(

      to bottom,

      transparent 0,

      #000 24px,

      #000 calc(100% - 24px),

      transparent 100%

    );

  }

  .meadow-modal-scroll-mobile {

    max-height: calc(82vh - 120px);

  }

  @media (prefers-reduced-motion: reduce) {

    .meadow-crt-warmup {

      animation: none;

      opacity: 1;

    }

    .meadow-crt-cursor {

      display: none;

    }

  }

  @keyframes meadowLegalFadeIn {

    from { opacity: 0; }

    to { opacity: 1; }

  }

  @keyframes meadowLegalRiseIn {

    from { opacity: 0; transform: translateY(8px); }

    to { opacity: 1; transform: translateY(0); }

  }

  @keyframes meadowLegalSlideUp {

    from { opacity: 0; transform: translateY(12px); }

    to { opacity: 1; transform: translateY(0); }

  }

`;



export const meadowSheetBackdropStyle: CSSProperties = {

  position: 'absolute',

  inset: 0,

  background: meadowModalTokens.backdrop,

  backdropFilter: 'blur(6px)',

  WebkitBackdropFilter: 'blur(6px)',

  zIndex: 0,

  pointerEvents: 'auto',

  border: 'none',

  padding: 0,

  cursor: 'default',

};



/** Flex overlay root — centers desktop panels, bottom-sheets on mobile. */

export const meadowOverlayRootStyle = (isMobile: boolean): CSSProperties => ({

  position: 'fixed',

  inset: 0,

  display: 'flex',

  alignItems: isMobile ? 'flex-end' : 'center',

  justifyContent: 'center',

  padding: isMobile ? 0 : '24px',

  boxSizing: 'border-box',

  zIndex: 50,

  pointerEvents: 'none',

});



export const meadowSheetPanelBase: CSSProperties = {

  position: 'relative',

  zIndex: 1,

  pointerEvents: 'auto',

  background: meadowModalTokens.bg,

  border: `1px solid ${meadowModalTokens.border}`,

  color: meadowModalTokens.text,

  fontFamily: meadowHudFontFamily,

  borderRadius: meadowModalTokens.radius,

  boxSizing: 'border-box',

  maxWidth: '100%',

};



export const meadowLegalPanelDesktop: CSSProperties = {

  ...meadowSheetPanelBase,

  width: 'min(560px, calc(100vw - 48px))',

  maxHeight: 'min(72vh, calc(100dvh - 48px))',

  margin: '0 auto',

  padding: '24px',

  display: 'flex',

  flexDirection: 'column',

};



export const meadowLegalPanelMobile: CSSProperties = {

  ...meadowSheetPanelBase,

  width: '100%',

  borderRadius: '10px 10px 0 0',

  maxHeight: '82vh',

  padding: '24px 20px max(24px, env(safe-area-inset-bottom))',

  display: 'flex',

  flexDirection: 'column',

};



export const meadowHudInputStyle: CSSProperties = {

  width: '100%',

  boxSizing: 'border-box',

  padding: '10px 12px',

  borderRadius: '4px',

  border: '1px solid rgba(255,255,255,0.22)',

  background: 'rgba(0,0,0,0.35)',

  color: '#fff',

  fontFamily: meadowHudFontFamily,

  fontSize: '0.8rem',

  letterSpacing: '0.04em',

  outline: 'none',

};



export const meadowHudLabelStyle: CSSProperties = {

  fontSize: '0.65rem',

  letterSpacing: '0.12em',

  textTransform: 'uppercase',

  color: meadowModalTokens.muted,

};



export const meadowHudActionStyle: CSSProperties = {

  width: '100%',

  padding: '12px 16px',

  borderRadius: '999px',

  border: '1px solid rgba(255,255,255,0.22)',

  background: 'rgba(0,0,0,0.45)',

  color: '#fff',

  fontFamily: meadowHudFontFamily,

  fontSize: '0.75rem',

  letterSpacing: '0.2rem',

  textTransform: 'uppercase',

  cursor: 'pointer',

  outline: 'none',

};



export const meadowHudLinkStyle = (active: boolean): CSSProperties => ({

  padding: 0,

  border: 'none',

  background: 'transparent',

  color: active ? meadowModalTokens.accent : meadowModalTokens.muted,

  fontFamily: meadowHudFontFamily,

  fontSize: '0.7rem',

  letterSpacing: '0.08em',

  textTransform: 'uppercase',

  cursor: 'pointer',

  textDecoration: active ? 'underline' : 'none',

  textUnderlineOffset: '4px',

});



export const meadowFooterLinkStyle: CSSProperties = {

  padding: '12px 8px',

  margin: '-12px -8px',

  border: 'none',

  background: 'transparent',

  color: meadowModalTokens.muted,

  fontFamily: meadowHudFontFamily,

  fontSize: '0.65rem',

  letterSpacing: '0.06em',

  cursor: 'pointer',

  textDecoration: 'none',

  outline: 'none',

};



export const meadowHudQuietButtonStyle: CSSProperties = {

  width: '100%',

  padding: '8px 0 0',

  border: 'none',

  background: 'transparent',

  color: meadowModalTokens.muted,

  fontFamily: meadowHudFontFamily,

  fontSize: '0.65rem',

  letterSpacing: '0.08em',

  textTransform: 'uppercase',

  cursor: 'pointer',

  outline: 'none',

};



/** @deprecated Use meadowHudInputStyle for auth/Hue sheets */

export const meadowInputStyle: CSSProperties = meadowHudInputStyle;



/** @deprecated Use meadowHudActionStyle */

export const meadowPrimaryButtonStyle: CSSProperties = meadowHudActionStyle;



/** @deprecated Use meadowHudQuietButtonStyle */

export const meadowSecondaryButtonStyle: CSSProperties = meadowHudQuietButtonStyle;


