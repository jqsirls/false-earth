import type { CSSProperties } from 'react';

export const meadowFontFamily = 'Inter, system-ui, sans-serif';
export const meadowHudFontFamily = 'Cousine, monospace';

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

export const meadowSheetBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4, 6, 11, 0.72)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  zIndex: 30,
  pointerEvents: 'auto',
};

export const meadowSheetPanelBase: CSSProperties = {
  position: 'fixed',
  zIndex: 31,
  pointerEvents: 'auto',
  background: 'rgba(0, 0, 0, 0.55)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#F2F5FA',
  fontFamily: meadowHudFontFamily,
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
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
  color: 'rgba(255,255,255,0.55)',
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
  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
  fontFamily: meadowHudFontFamily,
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  textDecoration: active ? 'underline' : 'none',
  textUnderlineOffset: '4px',
});

export const meadowHudQuietButtonStyle: CSSProperties = {
  width: '100%',
  padding: '8px 0 0',
  border: 'none',
  background: 'transparent',
  color: 'rgba(255,255,255,0.45)',
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
