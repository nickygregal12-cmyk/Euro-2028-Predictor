import styles from './StatusBadge.module.css'
import { LockIcon, CheckIcon } from './icons'

// locked = neutral (deadline passed); live = cyan (real tournament data, per
// the app-wide meaning of cyan); submitted = accent (the user's saved world).
export type StatusBadgeVariant = 'locked' | 'live' | 'submitted'

const LABELS: Record<StatusBadgeVariant, string> = {
  locked: 'Locked',
  live: 'Live',
  submitted: 'Submitted',
}

export type StatusBadgeProps = {
  variant: StatusBadgeVariant
  // Overrides the default label text.
  label?: string
}

/**
 * Small status pill. Colour is never the only signal — each variant pairs its
 * tone with an icon (lock / pulsing dot / tick) and text. Presentational only.
 */
export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {variant === 'locked' ? <LockIcon size={12} /> : null}
      {variant === 'live' ? <span className={styles.dot} aria-hidden="true" /> : null}
      {variant === 'submitted' ? <CheckIcon size={12} /> : null}
      <span>{label ?? LABELS[variant]}</span>
    </span>
  )
}
