import { SESSION_TIMER_CHOICES_MIN, sessionTimerLabel } from '../core/store/sessionTimerStore';

interface SessionTimerPresetRowProps {
  selectedMinutes: number | null;
  onSelect: (minutes: number | null) => void;
}

/**
 * The one source of truth for the `NONE · 15 · 30 · 1H · 2H` preset buttons,
 * shared by the START gate disclosure and the soft session-ending screen.
 * Inherits font sizing/spacing from its parent row; parent owns layout.
 */
export function SessionTimerPresetRow({ selectedMinutes, onSelect }: SessionTimerPresetRowProps) {
  return (
    <>
      {[null, ...SESSION_TIMER_CHOICES_MIN].map((minutes) => {
        const isSelected = selectedMinutes === minutes;
        return (
          <button
            key={minutes ?? 'off'}
            type="button"
            className="meadow-clickable"
            onClick={() => onSelect(minutes)}
            aria-pressed={isSelected}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 2px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              cursor: 'pointer',
              color: isSelected ? '#fff' : 'rgba(255,255,255,0.45)',
            }}
          >
            {sessionTimerLabel(minutes)}
          </button>
        );
      })}
    </>
  );
}
