import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './TextInput.module.css'
import { EyeIcon, EyeOffIcon } from './icons'

export type TextInputProps = {
  // Always required — every field is labelled (design-system §7). Rendered as a
  // real <label>, so the whole thing is presentational and accessible.
  label: string
  // When set, the field shows its error state: red border, message, and
  // aria-invalid wired to the input.
  error?: string
  // Optional helper text shown below the field when there's no error.
  hint?: ReactNode
  // 'password' adds a show/hide toggle.
  type?: 'text' | 'email' | 'password'
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'id'>

/**
 * Labelled text field with error and password variants. Presentational — the
 * parent owns the value and validation; this only renders state.
 */
export function TextInput({ label, error, hint, type = 'text', ...rest }: TextInputProps) {
  const id = useId()
  const describedById = `${id}-desc`
  const [reveal, setReveal] = useState(false)

  const isPassword = type === 'password'
  const inputType = isPassword && reveal ? 'text' : type
  const hasError = Boolean(error)

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={`${styles.control} ${hasError ? styles.controlError : ''}`}>
        <input
          id={id}
          type={inputType}
          className={styles.input}
          aria-invalid={hasError || undefined}
          aria-describedby={error || hint ? describedById : undefined}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className={styles.toggle}
            // The label already names the field; announce only the action.
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            onClick={() => setReveal((r) => !r)}
          >
            {reveal ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={describedById} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={describedById} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
