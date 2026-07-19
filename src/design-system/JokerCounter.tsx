import styles from './JokerCounter.module.css'

export type JokerCounterProps = {
  used: number
  total?: number // default 5 jokers per entry
}

/**
 * The always-visible joker allowance on prediction screens: five gold dots
 * (filled = used, outline = remaining) plus an "N left" label. Presentational —
 * the max-5 rule itself is enforced server-side.
 */
export function JokerCounter({ used, total = 5 }: JokerCounterProps) {
  const clampedUsed = Math.max(0, Math.min(used, total))
  const remaining = total - clampedUsed
  return (
    <div className={styles.counter}>
      <span className={styles.dots} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < clampedUsed ? styles.dotUsed : styles.dotFree} />
        ))}
      </span>
      <span className={styles.label}>{remaining} left</span>
      <span className="sr-only">
        {remaining} of {total} jokers remaining
      </span>
    </div>
  )
}
