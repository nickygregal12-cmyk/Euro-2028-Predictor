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
}

/**
 * Slim identity + theme bar shown on every signed-in screen. Left: section
 * context. Right: theme toggle and the user's avatar chip into their own
 * profile. The BottomNav remains the primary navigation. Presentational only.
 */
export function AppBar({ context, theme, onToggleTheme, displayName, onOpenProfile }: AppBarProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  return (
    <header className={styles.bar}>
      <span className={styles.context}>{context}</span>
      <div className={styles.actions}>
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
