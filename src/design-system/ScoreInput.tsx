import styles from './ScoreInput.module.css'

export type ScoreInputProps = {
  value: number | null
  // Accessible label, per team — e.g. "Scotland score" (design-system §7).
  ariaLabel: string
  onChange?: (value: number | null) => void
  // Locked variant: a static, non-focusable chip (entry deadline passed).
  locked?: boolean
  name?: string
}

/**
 * The 44×44 numeric score box. Editable is the primary action on prediction
 * screens (accent border in both themes); locked is a read-only chip.
 * Presentational only — the parent owns the value and lock state.
 */
export function ScoreInput({ value, ariaLabel, onChange, locked = false, name }: ScoreInputProps) {
  if (locked) {
    return (
      <span className={styles.locked}>
        <span className="sr-only">{ariaLabel}: </span>
        {value ?? '–'}
      </span>
    )
  }

  return (
    <input
      className={styles.input}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      autoComplete="off"
      name={name}
      aria-label={ariaLabel}
      value={value === null ? '' : String(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
        onChange?.(digits === '' ? null : Number(digits))
      }}
    />
  )
}
