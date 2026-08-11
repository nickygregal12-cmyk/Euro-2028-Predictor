import styles from './AppBar.module.css'
import { MoonIcon, SunIcon } from './icons'
import { initialsOf } from './PlayerChip'

export type AppBarProps = {
  // The current section's context label (e.g. the active tab's name). Context
  // only — page titles stay content-owned (design-system §6, one title system).
  context: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  // The signed-in user's display name; drives the avatar initials.
  displayName: string | null
  onOpenProfile: () => void
  /**
   * The action-centre control. Omitted, the bar renders exactly as before, so
   * a gallery or a shell without an inbox is unaffected.
   */
  actions?: {
    /**
     * How many things the player OWES. Not an unread count: this is a
     * server-derived fact about what they have not DONE, so it is identical on
     * every device and clears when they act rather than when they look. The
     * label the control announces says "to do" for the same reason.
     */
    outstanding: number
    onOpen: () => void
  }
}

/**
 * Slim identity + theme bar shown on every signed-in screen. Left: section
 * context. Right: theme toggle and the user's avatar chip into their own
 * profile. The BottomNav remains the primary navigation. Presentational only.
 */
export function AppBar({
  context,
  theme,
  onToggleTheme,
  displayName,
  onOpenProfile,
  actions,
}: AppBarProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  return (
    <header className={styles.bar}>
      <span className={styles.context}>{context}</span>
      <div className={styles.actions}>
        {actions ? (
          <button
            type="button"
            className={styles.iconButton}
            onClick={actions.onOpen}
            aria-label={
              actions.outstanding > 0
                ? `To do — ${actions.outstanding} ${
                    actions.outstanding === 1 ? 'thing' : 'things'
                  } to do`
                : 'To do — nothing outstanding'
            }
          >
            <span aria-hidden="true" className={styles.todo}>
              {/* The number IS the control when there is one. A badge floating
                  over an icon is smaller than the tap target it decorates and
                  reads as a decoration; the count reads as the point. */}
              {actions.outstanding > 0 ? actions.outstanding : '·'}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'dark' ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onOpenProfile}
          aria-label="Your profile"
        >
          <span className={styles.avatar} aria-hidden="true">
            {initialsOf(displayName ?? '')}
          </span>
        </button>
      </div>
    </header>
  )
}
