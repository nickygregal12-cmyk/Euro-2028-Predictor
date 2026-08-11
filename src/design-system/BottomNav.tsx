import { Link } from 'react-router'
import styles from './BottomNav.module.css'
import { HomeIcon, BallIcon, CalendarIcon, TrophyIcon, MoreIcon, type IconProps } from './icons'
import { weeklyRoutes, type GlobalNavTab } from '../app/shellRoutes'

// Internal keys are retained for design-system compatibility; the public weekly
// navigation is Home · Play · Matches · Leagues · More. The union itself lives
// with the route authority that resolves a pathname to a tab, so the list of
// tabs and the function that picks one cannot disagree.
export type NavKey = GlobalNavTab

export type BottomNavItem = {
  key: NavKey
  label: string
  to: string
}

/**
 * The icon each tab wears, keyed on the routing tab rather than on the label.
 *
 * A DEPLOYMENT MAY RENAME A DESTINATION BUT NOT REDRAW IT. The Euro site calls
 * the second tab "Predict" where the Hub calls it "Play"; it is the same
 * destination and wears the same ball. Keying on the tab is what keeps a
 * renamed label from silently losing its icon.
 */
const ICONS: Record<NavKey, (p: IconProps) => React.ReactElement> = {
  home: HomeIcon,
  predict: BallIcon,
  matches: CalendarIcon,
  league: TrophyIcon,
  more: MoreIcon,
}

/**
 * The weekly platform's own five, and the default when no site configuration is
 * supplied. `src/app/site/navigation.ts` derives the real list per deployment.
 */
const ITEMS: BottomNavItem[] = [
  { key: 'home', label: 'Home', to: weeklyRoutes.hub },
  { key: 'predict', label: 'Play', to: weeklyRoutes.play },
  { key: 'matches', label: 'Matches', to: weeklyRoutes.matches },
  { key: 'league', label: 'Leagues', to: weeklyRoutes.leagues },
  { key: 'more', label: 'More', to: weeklyRoutes.more },
]

export type BottomNavProps = {
  active: NavKey
  /**
   * This deployment's destinations, in its own order and wording. Omitted, the
   * bar is the weekly platform's — which is also what the fail-closed site
   * variant resolves to.
   */
  items?: readonly BottomNavItem[]
  /** Dev/demo-only override. Production navigation should omit this. */
  onNavigate?: (key: NavKey) => void
}

/**
 * Fixed five-tab global navigation. Every destination is a real link, so
 * browser and assistive-technology link behaviours remain available. Active
 * state is conveyed by aria-current as well as the icon/label colour change.
 */
export function BottomNav({ active, items = ITEMS, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {items.map(({ key, label, to }) => {
        const isActive = key === active
        const Icon = ICONS[key]
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
