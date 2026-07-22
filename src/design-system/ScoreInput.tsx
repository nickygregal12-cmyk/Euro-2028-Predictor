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
}

/**
 * The 44×44 numeric score box. Editable is the primary action on prediction
 * screens; the border signals state — accent while empty (act here), quiet
 * `--line` once filled (settled) — so a group screen visibly calms as it fills
 * (design-system §5, 2026-07-22 audit). Locked is a read-only chip.
 * Presentational only — the parent owns the value and lock state.
 */
export function ScoreInput({
  value,
  ariaLabel,
  onChange,
  locked = false,
  name,
  onAdvance,
  inputRef,
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

  return (
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
}
