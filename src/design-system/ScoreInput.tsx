import type { Ref } from 'react'
import styles from './ScoreInput.module.css'

export type ScoreInputProps = {
  value: number | null
  // Accessible label, per team — e.g. "Scotland score" (design-system §7).
  ariaLabel: string
  onChange?: (value: number | null) => void
  // Locked variant: a static, non-focusable chip (entry deadline passed).
  locked?: boolean
  name?: string
  // Keyboard assistance (design-system §5, 2026-07-22 audit). The parent (MatchCard)
  // owns the pairing: `inputRef` lets it focus/blur this box, and `onAdvance` fires
  // when a digit is entered into an EMPTY box (home → away → done) so a whole card
  // is typeable with no manual focus moves. Two-digit scores re-focus and type on.
  onAdvance?: () => void
  inputRef?: Ref<HTMLInputElement>
  /**
   * Tap-to-step controls above and below the box. On by default for the
   * editable variant — see the note below — and switchable off for a context
   * where the vertical room is not there.
   */
  steppers?: boolean
}

/** The highest score the two-digit box can hold. */
const MAX_SCORE = 99

/**
 * The 44×44 numeric score box. Editable is the primary action on prediction
 * screens; the border signals state — accent while empty (act here), quiet
 * `--line` once filled (settled) — so a group screen visibly calms as it fills
 * (design-system §5, 2026-07-22 audit). Locked is a read-only chip.
 * Presentational only — the parent owns the value and lock state.
 *
 * IT NOW STEPS AS WELL AS TYPES, and the reason is the one a player gave: on a
 * phone the only way to set a score was to hit a 44px box, wait for the numeric
 * keyboard, type, and dismiss it — for ten fixtures, twenty times. Predicted
 * scores are overwhelmingly 0, 1 and 2, so a tap should reach them.
 *
 * THE STEPPERS ARE VERTICAL, WHICH IS A LAYOUT CONSTRAINT RATHER THAN A STYLE.
 * The card row is `club name | scores | club name`, so putting − and + beside
 * each box would put six tap targets and a separator between two names and
 * crowd them off a 360px screen. Above and below costs no width at all.
 *
 * TYPING IS UNCHANGED AND STILL FIRST. The box keeps its numeric keyboard,
 * select-on-focus and auto-advance; the steppers are an addition for the common
 * values, not a replacement for entering 4.
 *
 * `−` IS GENUINELY DISABLED AT THE FLOOR rather than silently doing nothing. An
 * empty box has nothing to decrease and zero cannot go lower, and a control
 * that looks alive and refuses is the complaint this change came from.
 */
export function ScoreInput({
  value,
  ariaLabel,
  onChange,
  locked = false,
  name,
  onAdvance,
  inputRef,
  steppers = true,
}: ScoreInputProps) {
  if (locked) {
    return (
      <span className={styles.locked}>
        <span className="sr-only">{ariaLabel}: </span>
        {value ?? '–'}
      </span>
    )
  }

  const filled = value !== null
  // An empty box starts at zero rather than one: a nil is the single most
  // predicted score, so it should cost one tap, not two.
  const stepUp = value === null ? 0 : Math.min(MAX_SCORE, value + 1)
  const canStepDown = value !== null && value > 0

  const box = (
    <input
      ref={inputRef}
      className={`${styles.input} ${filled ? styles.filled : ''}`}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      autoComplete="off"
      name={name}
      aria-label={ariaLabel}
      value={value === null ? '' : String(value)}
      // Select-on-focus: tapping a filled box selects its value, so a correction
      // is retype-over, never clear-first.
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
        onChange?.(digits === '' ? null : Number(digits))
        // Single-digit auto-advance: only when a digit is entered into an EMPTY
        // box (prev value null → exactly one digit). Editing a box that already
        // had a value never advances — protects the re-focus-to-edit and the
        // two-digit-score cases (design-system §5).
        if (onAdvance && value === null && digits.length === 1) onAdvance()
      }}
    />
  )

  if (!steppers || !onChange) return box

  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.step}
        // Named for the team, because a card carries two of these and "Add one"
        // twice over says nothing about which score moves.
        aria-label={`Add one to ${ariaLabel}`}
        onClick={() => onChange(stepUp)}
      >
        <span aria-hidden="true">+</span>
      </button>
      {box}
      <button
        type="button"
        className={styles.step}
        aria-label={`Subtract one from ${ariaLabel}`}
        disabled={!canStepDown}
        onClick={() => onChange((value ?? 0) - 1)}
      >
        <span aria-hidden="true">−</span>
      </button>
    </span>
  )
}
