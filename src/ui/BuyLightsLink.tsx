import type { CSSProperties } from 'react';
import { meadowHudFontFamily, meadowModalTokens } from './meadowUiStyles';

/**
 * Amazon affiliate link for visitors who want to try the lights but have none.
 * Canonical everywhere (owner decision 2026-07-11): Amazon Hue store page so
 * buyers choose their own starter set.
 */
export const BUY_LIGHTS_URL = 'https://amzn.to/4vw54hn';

const lineStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.65rem',
  lineHeight: 1.75,
  letterSpacing: '0.04em',
  color: meadowModalTokens.muted,
  fontFamily: meadowHudFontFamily,
  textAlign: 'center',
};

/**
 * Quiet secondary line for the lights flow. Serves rather than sells: no
 * prices, no urgency, just a way out for people with no color lights yet.
 */
export function BuyLightsLink({ style }: { style?: CSSProperties }) {
  return (
    <p style={{ ...lineStyle, ...style }}>
      No color lights yet?{' '}
      <a
        href={BUY_LIGHTS_URL}
        target="_blank"
        rel="noopener sponsored"
        data-testid="meadow-buy-lights"
        style={{
          color: meadowModalTokens.accent,
          textDecoration: 'none',
        }}
      >
        Get Philips Hue
      </a>
    </p>
  );
}
