import { Link } from 'react-router'
import styles from './BottomNav.module.css'
import { HomeIcon, BallIcon, CalendarIcon, TrophyIcon, MoreIcon, type IconProps } from './icons'
import { weeklyRoutes } from '../app/shellRoutes'

// Internal keys are retained for design-system compatibility; the public weekly
// navigation is Home · Play · Matches · Leagues · More.
export type NavKey = 'home' | 'predict' | 'matches' | 'league' | 'more'

const ITEMS: {
  key: NavKey
  label: string
  to: string
  Icon: (p: IconProps) => React.ReactElement
}[] = [
  { key: 'home', label: 'Home', to: weeklyRoutes.hub, Icon: HomeIcon },
  { key: 'predict', label: 'Play', to: weeklyRoutes.play, Icon: BallIcon },
  { key: 'matches', label: 'Matches', to: weeklyRoutes.matches, Icon: CalendarIcon },
  { key: 'league', label: 'Leagues', to: weeklyRoutes.leagues, Icon: TrophyIcon },
  { key: 'more', label: 'More', to: weeklyRoutes.more, Icon: MoreIcon },
]

export type BottomNavProps = {
  active: NavKey
  /** Dev/demo-only override. Production navigation should omit this. */
  onNavigate?: (key: NavKey) => void
}

/**
 * Fixed five-tab global navigation. Every destination is a real link, so
 * browser and assistive-technology link behaviours remain available. Active
 * state is conveyed by aria-current as well as the icon/label colour change.
 */
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {ITEMS.map(({ key, label, to, Icon }) => {
        const isActive = key === active
        return (
          <Link
            key={key}
            to={to}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={
              onNavigate
                ? (event) => {
                    event.preventDefault()
                    onNavigate(key)
                  }
                : undefined
            }
          >
            <Icon size={22} />
            <span className={styles.label}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
