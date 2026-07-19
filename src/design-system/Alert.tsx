import type { ReactNode } from 'react'
import styles from './Alert.module.css'
import { InfoIcon, CheckIcon, AlertIcon, CloseIcon, type IconProps } from './icons'

// Semantic colours are app-wide (design-system §1): success = accent,
// warning = amber, error = red. Info stays neutral — cyan is reserved for live
// tournament data and must never stand in for a UI message.
export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const ICONS: Record<AlertVariant, (p: IconProps) => React.ReactElement> = {
  info: InfoIcon,
  success: CheckIcon,
  warning: AlertIcon,
  error: AlertIcon,
}

export type AlertProps = {
  variant?: AlertVariant
  // Optional bold lead line above the message.
  title?: string
  children: ReactNode
  // When provided, renders a dismiss button.
  onDismiss?: () => void
}

/**
 * Inline, in-flow message block. Sits in the layout (unlike Toast, which
 * floats). Errors/warnings announce assertively; info/success politely.
 * Presentational only.
 */
export function Alert({ variant = 'info', title, children, onDismiss }: AlertProps) {
  const Icon = ICONS[variant]
  const assertive = variant === 'error' || variant === 'warning'
  return (
    <div
      className={`${styles.alert} ${styles[variant]}`}
      role={assertive ? 'alert' : 'status'}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className={styles.body}>
        {title ? <p className={styles.title}>{title}</p> : null}
        <div className={styles.message}>{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={onDismiss}>
          <CloseIcon size={16} />
        </button>
      ) : null}
    </div>
  )
}
