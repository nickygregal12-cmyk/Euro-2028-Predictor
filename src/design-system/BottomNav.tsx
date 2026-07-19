import styles from './BottomNav.module.css'
import { HomeIcon, PredictIcon, CalendarIcon, TrophyIcon, MoreIcon, type IconProps } from './icons'

// The five app sections. Fixed set (design-system §5 / build plan), so the
// config lives here rather than being passed in.
export type NavKey = 'home' | 'predict' | 'matches' | 'leagues' | 'more'

const ITEMS: { key: NavKey; label: string; Icon: (p: IconProps) => React.ReactElement }[] = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'predict', label: 'Predict', Icon: PredictIcon },
  { key: 'matches', label: 'Matches', Icon: CalendarIcon },
  { key: 'leagues', label: 'Leagues', Icon: TrophyIcon },
  { key: 'more', label: 'More', Icon: MoreIcon },
]

export type BottomNavProps = {
  active: NavKey
  onNavigate: (key: NavKey) => void
}

/**
 * Fixed five-tab bottom navigation. Active tab is accent; each tab is a real
 * button at least 44px tall (design-system §7). Colour is never the only active
 * signal — the label and icon both change colour and the tab is aria-current.
 * Presentational: the parent owns the active key and handles navigation.
 */
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {ITEMS.map(({ key, label, Icon }) => {
        const isActive = key === active
        return (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(key)}
          >
            <Icon size={22} />
            <span className={styles.label}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
