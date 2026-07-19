import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

// primary = the accent call-to-action; secondary = quieter outline action;
// destructive = irreversible/red action (delete, leave league). Solid fills
// (primary, destructive) take --bg as their text colour: in dark the fill is
// bright and --bg is dark, in light the fill is dark and --bg is light, so the
// pairing is legible in both themes without a bespoke contrast token.
export type ButtonVariant = 'primary' | 'secondary' | 'destructive'

export type ButtonProps = {
  variant?: ButtonVariant
  // Shows a spinner, blocks clicks and sets aria-busy while an action is in
  // flight. Width is held steady so the layout doesn't jump.
  loading?: boolean
  // Stretches to the container width — the default for forms and bottom-of-card
  // actions on mobile.
  fullWidth?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>

/**
 * The standard action button. A real <button> (design-system §7 — no clickable
 * divs); minimum 44px tall for tap targets. Presentational only.
 */
export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        styles.btn,
        styles[variant],
        fullWidth ? styles.fullWidth : '',
        loading ? styles.loading : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* Kept in the DOM while loading so the button holds its width; hidden
          from view (and named for SR via the spinner) by the .loading class. */}
      <span className={styles.label}>{children}</span>
      {loading ? (
        <span className={styles.spinner} role="status" aria-label="Loading" />
      ) : null}
    </button>
  )
}
