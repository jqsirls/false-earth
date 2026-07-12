import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';

const CURSOR_SIZE = 24;
const CONDENSED_SCALE = 12 / CURSOR_SIZE;

/** Anything clickable condenses the cursor (shrink = focus, never grow). */
const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, select, textarea, label, summary, [onclick], [data-interactive]';

/** Native I-beam + caret stay in text fields; the circle hides there. */
const TEXT_FIELD_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea';

const cursorGlobalCss = `
  html.meadow-cursor-active,
  html.meadow-cursor-active * {
    cursor: none !important;
  }
  html.meadow-cursor-active input,
  html.meadow-cursor-active textarea {
    cursor: text !important;
  }
`;

function isFinePointerNoTouch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    navigator.maxTouchPoints === 0
  );
}

/**
 * Desktop-only custom cursor: 24px soft-glow circle following the pointer via
 * translate3d (GPU transform, no repaint pressure — glow instead of backdrop
 * blur on purpose). Condenses to 12px over interactive elements. Touch
 * devices never mount it; reduced motion makes size changes instant.
 */
export function MeadowCursor() {
  const [active, setActive] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [overTextField, setOverTextField] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const followerRef = useRef<HTMLDivElement>(null);
  const hasPositionRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setActive(isFinePointerNoTouch());
  }, []);

  useEffect(() => {
    if (!active) return;

    document.documentElement.classList.add('meadow-cursor-active');

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      lastX = e.clientX;
      lastY = e.clientY;
      const el = followerRef.current;
      if (el) {
        el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
      hasPositionRef.current = true;
      // Always restore on move: Chrome fires pointerout with a null
      // relatedTarget when the hovered element is REMOVED (splash unmount,
      // sheet close), not only when the pointer leaves the window. Without
      // this the dot hides permanently mid-session while cursor:none stays,
      // leaving the user with no cursor at all. React bails out when the
      // value is unchanged, so this costs nothing per move.
      setVisible(true);
    };

    const applyHoverState = (target: Element | null) => {
      if (!target || typeof target.closest !== 'function') {
        setCondensed(false);
        setOverTextField(false);
        return;
      }
      setCondensed(Boolean(target.closest(INTERACTIVE_SELECTOR)));
      setOverTextField(Boolean(target.closest(TEXT_FIELD_SELECTOR)));
    };

    const onPointerOver = (e: PointerEvent) => {
      applyHoverState(e.target as Element | null);
    };

    // Clicks can remove the hovered element (e.g. START) without a fresh
    // pointerover — re-check what is actually under the pointer.
    let lastX = 0;
    let lastY = 0;
    const onClickRecheck = () => {
      requestAnimationFrame(() => {
        applyHoverState(document.elementFromPoint(lastX, lastY));
      });
    };

    // Hide gracefully when the pointer leaves the window. A null
    // relatedTarget ALSO happens when the hovered element is removed from
    // the DOM (Chrome), so additionally require the coordinates to be at or
    // beyond the viewport edge before hiding.
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      const outsideViewport =
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth - 1 ||
        e.clientY >= window.innerHeight - 1;
      if (outsideViewport) setVisible(false);
    };
    const onPointerEnter = () => {
      if (hasPositionRef.current) setVisible(true);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerover', onPointerOver, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('pointerenter', onPointerEnter, { passive: true });
    document.addEventListener('click', onClickRecheck, { passive: true });

    return () => {
      document.documentElement.classList.remove('meadow-cursor-active');
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerenter', onPointerEnter);
      document.removeEventListener('click', onClickRecheck);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      <style>{cursorGlobalCss}</style>
      <div
        ref={followerRef}
        aria-hidden
        data-meadow-cursor
        data-condensed={condensed ? 'true' : 'false'}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          zIndex: 20000,
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      >
        <div
          data-meadow-cursor-dot
          style={{
            position: 'absolute',
            top: `${-CURSOR_SIZE / 2}px`,
            left: `${-CURSOR_SIZE / 2}px`,
            width: `${CURSOR_SIZE}px`,
            height: `${CURSOR_SIZE}px`,
            borderRadius: '50%',
            boxSizing: 'border-box',
            // Frosted-glass lens, not a filled disc: near-transparent fill,
            // strong backdrop blur does the visual work, hairline rim keeps
            // the edge findable. A solid 70% fill read as a "full moon" and
            // competed with the collectible orbs.
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            // Whisper of glow only — visible in motion, quiet when parked.
            boxShadow: '0 0 8px 1px rgba(255, 255, 255, 0.12)',
            transform: `scale(${condensed ? CONDENSED_SCALE : 1})`,
            transition: reducedMotion
              ? 'none'
              : 'transform 180ms ease, opacity 180ms ease',
            opacity: visible && !overTextField ? 1 : 0,
          }}
        />
      </div>
    </>
  );
}
