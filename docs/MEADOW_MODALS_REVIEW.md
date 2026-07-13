# Meadow Modals PRD — Review vs Current UI

**Reviewed:** 2026-07-09  
**PRD source:** `PRD_MEADOW_MODALS.md` (owner draft v1)  
**Compared against:** `MeadowCta.tsx`, `LampButton.tsx`, `AuthSheet.tsx`, `HueSheet.tsx`, `meadowUiStyles.ts`, `ControlsHint.tsx`, upstream `readme.md` / `src/ui/` patterns

---

## 1. PRD intent (summary)

The PRD defines a **legal layer** for Booster's Meadow — not auth or Hue flows:

- A single footer line: `© 2026 Storytailor Inc. · Privacy · Terms · Credits`
- Three **in-experience text modals** (Credits, Terms, Privacy) that extend the HUD's terminal-calm voice (`W A S D MOVE` / `SHIFT RUN` energy)
- Monospace typography, near-black panels, hairline borders, backdrop blur so the meadow stays visible
- World and music **never pause** while a modal is open
- ESC closes an open modal first (consumed); only then does ESC toggle cursor
- Mobile: bottom sheet, 44px hit targets, safe-area insets
- No logos, marketing, or cookie-banner behavior in the legal layer

**Principle (PRD):** legal copy whispers in the same voice as control hints — users never feel like they left the Meadow.

---

## 2. Upstream False Earth aesthetic

Upstream UI is intentionally minimal:

- Fixed overlays with **no MUI chrome** (no AppBar, no Material dialogs)
- Control hints: **Cousine monospace**, key-cap pills, low opacity, `pointer-events: none`
- Dark translucent surfaces, hairline borders (`rgba(255,255,255,0.14)`)
- Loading gate uses `[ START ]` mono affordance — calm, not app-like
- Audio control is a small WebGPU canvas hit target, not a labeled button

The meadow fork adds Storytailor-specific pills (`MeadowCta`, `LampButton`) using **Inter** uppercase labels — a deliberate softening for product CTAs while keeping pill geometry aligned with upstream darkness.

---

## 3. Alignment vs conflicts

### Strong alignment (adopt PRD as-is for legal modals)

| PRD requirement | Upstream / meadow fit |
|-----------------|----------------------|
| Text-only, no logos in modal body | Matches False Earth restraint |
| Backdrop blur + dim, world visible | Consistent with "refuge not billboard" |
| Mono HUD voice for legal copy | `ControlsHint` already uses Cousine + key caps |
| ESC stacking (modal before cursor) | Required — meadow already documents ESC for cursor |
| Music/world continue | Already true for Auth/Hue sheets; must stay for legal modals |
| Footer same weight as HUD hints | Fits bottom overlay stack (`ControlsHint` is already bottom-center) |

### Soft conflicts (resolve with judgment)

| PRD | Current meadow | Recommendation |
|-----|----------------|----------------|
| **Space Mono / IBM Plex Mono** for modals | HUD uses **Cousine** (`ControlsHint`, font in `public/fonts/`) | **Use Cousine** — one mono across HUD + legal modals; do not introduce Space Mono |
| Centered 560px panel (desktop) | Auth/Hue sheets are **top-right / bottom sheet** | Legal modals: **centered** per PRD. Auth/Hue: keep corner sheets (functional, not legal) |
| No color accents in modals | Auth primary button uses brand blue | **Legal modals:** white/mono only. **Auth/Hue:** keep subtle brand blue on primary CTA only |
| Modal title `P R I V A C Y` spacing | Auth/Hue use sentence-case Inter headings | Legal modals: adopt PRD uppercase mono titles. Auth/Hue: keep Inter sentence case (account UI, not legal) |
| Footer fades with HUD idle | Not implemented yet | **Adopt** when idle-fade exists; footer should share HUD visibility |

### Reject or defer

| PRD item | Verdict |
|----------|---------|
| Trademark block in footer | **Reject** — PRD correctly puts it in Terms modal only |
| Links out except storytailor.com/terms, privacy, mingjyunhung.com | **Adopt** for legal modals |
| Drag-down to close mobile sheet | **Adopt** for legal modals; optional for Auth/Hue (lower priority) |
| Analytics open event per modal | **Soften** — one internal meadow analytics event is fine; no third-party pixels |

---

## 4. Current AuthSheet / HueSheet vs PRD

The PRD targets **legal modals**, not auth/Hue. Current sheets are **account/utility surfaces** opened from the lamp pill — correctly separate from Credits/Terms/Privacy.

### What already matches

- Dark translucent panels, hairline borders (pill family)
- Bottom sheet on mobile, top-right panel on desktop
- `role="dialog"`, `aria-modal`, backdrop click to close
- `prefers-reduced-motion` fade fallback
- No MUI `Dialog` — custom overlay like upstream

### Gaps vs PRD modal tokens (partially addressed 2026-07-09)

| Token / behavior | Before | After polish |
|------------------|--------|--------------|
| Backdrop `rgba(4,6,11,0.82)` + blur | `rgba(0,0,0,0.55)`, no blur | Updated in `meadowUiStyles.ts` |
| Panel `#0A0D14` | `rgba(12,14,20,0.94)` | Updated to `rgba(10,13,20,0.96)` |
| Enter 8px rise / 220ms ease-out | Mixed 16px / -8px | Unified 8px rise |
| ESC closes sheet | Not wired | **Still TODO** — add when legal modals ship (same ESC stack) |
| Focus trap + return focus | Not implemented | **TODO** before auth/Hue production |
| Centered max-width 560px | 380px corner panel | **Keep** for Auth/Hue — legal modals get centered layout |

### LampButton / MeadowCta

- **Aligned** with upstream pill pattern (dark translucent, uppercase Inter, safe-area positioning)
- **No change needed** for legal PRD — footer is a separate bottom element

---

## 5. Recommendations

### Adopt (legal modals — new work)

1. **`MeadowFooter.tsx`** — single line, three text buttons, 44px tap padding on mobile
2. **`LegalModal.tsx`** — shared shell: Cousine mono, PRD tokens, centered desktop / bottom sheet mobile, scroll fade mask, `[ ESC ]` close on desktop
3. **ESC priority hook** — if any modal/sheet open → close it; else existing cursor behavior
4. **Content modules** — static copy from PRD §4 (Credits, Terms, Privacy)
5. **Counsel gate** — do not ship Terms/Privacy copy publicly until Sherry/Swyft pass (PRD §6)

### Keep separate (do not force legal PRD onto auth/Hue)

- Inter body type for account forms
- Top-right / bottom-sheet positioning for lamp-driven flows
- Brand blue primary button on sign-in (functional affordance)

### Soften

- Backdrop blur on very old mobile: PRD allows solid `0.88` fallback — detect or use `prefers-reduced-motion` to skip blur
- Auth/Hue: share backdrop/panel tokens with legal modals (done via `meadowUiStyles.ts`) but not mono titles

### Reject

- Space Mono as second mono face
- Logos or illustrations inside any modal
- Pausing WebGPU loop or BGM when overlays open

---

## 6. Concrete UI tweaks (implemented vs next)

### Implemented (2026-07-09)

- `meadowSheetBackdropStyle`: night-sky opacity + `backdrop-filter: blur(6px)`
- `meadowSheetPanelBase`: `#0A0D14` family, softer shadow, `#F2F5FA` text
- Auth/Hue animations: 8px rise, 220ms ease-out, 160ms fade exit

### Next (when building legal modals)

- Footer component below or integrated with `ControlsHint` stack
- `LegalModal` with Cousine, uppercase spaced titles, internal scroll fade
- Global ESC handler ordering
- Focus trap in Auth/Hue + legal modals
- Idle-fade parity for footer + HUD

---

## 7. Verdict

**PRD is good** for the legal layer — it extends upstream False Earth HUD language without breaking meadow as refuge. **Do not merge** legal modal spec into Auth/Hue sheets; share only backdrop/panel tokens.

**Priority order:**

1. Ship legal footer + three modals (PRD scope)
2. Wire ESC stacking + focus trap across all overlays
3. Optional: drag-to-close on mobile Auth/Hue

Auth/Hue sheets are already directionally correct as quiet pill extensions; token polish closes the main visual gap with the PRD modal layer.
