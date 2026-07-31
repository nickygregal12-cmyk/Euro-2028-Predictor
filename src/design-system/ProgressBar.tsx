import { useId, type ReactNode } from 'react'
import styles from './ProgressBar.module.css'

type ProgressBarBase = {
  value: number
  max?: number
  // Shows "value / max" alongside the label.
  showValue?: boolean
}

/**
 * A progressbar must carry an accessible name, so the props require one of the
 * two ways to give it and refuse both at once.
 *
 * `label` was optional, and without it the track rendered as a `progressbar`
 * role with values but no name — announced as a bare "0%" with nothing saying
 * what is progressing (WCAG 2.0 A, 4.1.2). Every production call site happened
 * to pass a label; the gallery's unlabelled variant did not, which is how the
 * component-level axe scan found it.
 *
 * Providing both is rejected rather than merged: a visible label and a
 * different accessible name is its own defect (WCAG 2.1 A, 2.5.3), and there is
 * no case here that needs them to differ.
 */
export type ProgressBarProps = ProgressBarBase &
  (
    | {
        // Visible label above the track (e.g. "Predictions"); also names the bar.
        label: ReactNode
        ariaLabel?: never
      }
    | {
        // No visible label — name the bar directly instead.
        label?: undefined
        ariaLabel: string
      }
  )

/**
 * Determinate progress track (e.g. group-stage predictions completed). Accent
 * fill = the user's progress. role=progressbar with aria values.
 * Presentational only.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  ariaLabel,
  showValue = false,
}: ProgressBarProps) {
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
        aria-label={label ? undefined : ariaLabel}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
