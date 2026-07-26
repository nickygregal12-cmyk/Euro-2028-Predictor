import { useEffect, useId, useRef, useState } from 'react'
import styles from './ChoiceSheet.module.css'

export type ChoiceSheetOption = {
  value: string
  label: string
}

export type ChoiceSheetProps = {
  label: string
  value: string
  options: ChoiceSheetOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

const FOCUSABLE = 'button:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * App-owned replacement for native select controls where iOS would otherwise
 * present the system wheel picker. Uses a compact trigger and a mobile bottom
 * sheet / desktop popover-style dialog while preserving keyboard and screen-
 * reader behaviour.
 */
export function ChoiceSheet({ label, value, options, onChange, disabled = false }: ChoiceSheetProps) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    const selectedButton = node?.querySelector<HTMLElement>('[aria-checked="true"]')
    const firstButton = node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(selectedButton ?? firstButton ?? node)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen(true)}
      >
        <span>{selected?.label ?? label}</span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className={styles.overlay} onMouseDown={() => setOpen(false)}>
          <div
            ref={dialogRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.handle} aria-hidden="true" />
            <h2 id={titleId} className={styles.title}>{label}</h2>
            <div className={styles.options} role="radiogroup" aria-label={label}>
              {options.map((option) => {
                const checked = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.option} ${checked ? styles.selected : ''}`}
                    role="radio"
                    aria-checked={checked}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    <span>{option.label}</span>
                    <span className={styles.check} aria-hidden="true">{checked ? '✓' : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
