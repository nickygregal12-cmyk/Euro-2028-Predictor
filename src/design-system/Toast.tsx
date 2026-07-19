import styles from './Toast.module.css'
import { InfoIcon, CheckIcon, AlertIcon, CloseIcon, type IconProps } from './icons'

// Same semantic mapping as Alert: success = accent, warning = amber,
// error = red, info = neutral (cyan stays reserved for live data).
export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

const ICONS: Record<ToastVariant, (p: IconProps) => React.ReactElement> = {
  info: InfoIcon,
  success: CheckIcon,
  warning: AlertIcon,
  error: AlertIcon,
}

export type ToastProps = {
  variant?: ToastVariant
  message: string
  // Renders a dismiss button when provided. Auto-dismiss timing is the host's
  // job — this component is purely the visual.
  onDismiss?: () => void
}

/**
 * A transient, floating notification (distinct from the in-flow Alert). Opaque
 * card surface with a semantic left bar so it reads clearly over any content.
 * Presentational only — a host owns placement and auto-dismiss timing.
 */
export function Toast({ variant = 'info', message, onDismiss }: ToastProps) {
  const Icon = ICONS[variant]
  const assertive = variant === 'error' || variant === 'warning'
  return (
    <div
      className={`${styles.toast} ${styles[variant]}`}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className={styles.message}>{message}</span>
      {onDismiss ? (
        <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={onDismiss}>
          <CloseIcon size={16} />
        </button>
      ) : null}
    </div>
  )
}
