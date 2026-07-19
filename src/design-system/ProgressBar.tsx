import { useId, type ReactNode } from 'react'
import styles from './ProgressBar.module.css'

export type ProgressBarProps = {
  value: number
  max?: number
  // Optional label above the track (e.g. "Predictions").
  label?: ReactNode
  // Shows "value / max" alongside the label.
  showValue?: boolean
}

/**
 * Determinate progress track (e.g. group-stage predictions completed). Accent
 * fill = the user's progress. role=progressbar with aria values.
 * Presentational only.
 */
export function ProgressBar({ value, max = 100, label, showValue = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, max))
  const pct = max === 0 ? 0 : (clamped / max) * 100
  const labelId = useId()

  return (
    <div className={styles.root}>
      {label || showValue ? (
        <div className={styles.head}>
          {label ? (
            <span id={labelId} className={styles.label}>
              {label}
            </span>
          ) : (
            <span />
          )}
          {showValue ? (
            <span className={styles.value}>
              {clamped} / {max}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-labelledby={label ? labelId : undefined}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
