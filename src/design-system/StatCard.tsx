import type { ReactNode } from 'react'
import styles from './StatCard.module.css'
import { ChevronUpIcon, ChevronDownIcon } from './icons'

export type StatCardProps = {
  // Small caps label, e.g. "Points", "Overall rank".
  label: string
  // The headline figure. A string lets callers format ("—", "#4", "72%").
  value: ReactNode
  // Accent the value (e.g. Points Today / your rank on your own profile).
  accent?: boolean
  // Optional movement arrow shown beside the value (rank cards).
  movement?: 'up' | 'down' | 'none'
  // Makes the whole card a button when it deep-links to its source screen
  // (design-system §6 — stat strip segments tap through).
  onClick?: () => void
}

/**
 * A single stat: big number over a small label, sized for the four-up profile
 * stat grid (design-system §6). Renders as a real <button> when `onClick` is
 * given, otherwise a static block. Presentational only.
 */
export function StatCard({ label, value, accent = false, movement, onClick }: StatCardProps) {
  const inner = (
    <>
      <span className={styles.valueRow}>
        <span className={`${styles.value} ${accent ? styles.accent : ''}`}>{value}</span>
        {movement && movement !== 'none' ? (
          <span className={styles.movement} aria-hidden="true">
            {movement === 'up' ? (
              <ChevronUpIcon size={14} className={styles.up} />
            ) : (
              <ChevronDownIcon size={14} className={styles.down} />
            )}
          </span>
        ) : null}
      </span>
      <span className={styles.label}>{label}</span>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={`${styles.card} ${styles.tappable}`} onClick={onClick}>
        {inner}
      </button>
    )
  }
  return <div className={styles.card}>{inner}</div>
}
