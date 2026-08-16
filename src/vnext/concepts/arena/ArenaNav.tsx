import { CalendarDays, Home, Radio, Trophy, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import typography from '../../foundations/typography.module.css'
import styles from './arena.module.css'

export type ArenaNavProps = {
  /** `masthead` is the desktop band; `bar` is the mobile bottom bar. */
  variant: 'masthead' | 'bar'
  openPredictions: number
}

type ArenaDestination = {
  id: string
  label: string
  icon: LucideIcon
}

/**
 * Arena's navigation exploration: destinations as part of the broadcast
 * masthead, not as a rail.
 *
 * This is one of the three answers the concepts give to the open navigation
 * question, and it is the one that costs the football nothing horizontally —
 * a rail takes a column off the stage forever, a masthead band takes 48px
 * once. It also puts "Live" first, which no ordinary app navigation would,
 * because on this concept's terms that IS the product today.
 *
 * NOT ROUTING. Nothing here navigates; the current destination is fixed and
 * the buttons are representational, because Stage 3 explores navigation and
 * must not establish app routing.
 */
const ARENA_DESTINATIONS: readonly ArenaDestination[] = [
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'home', label: 'Matchday', icon: Home },
  { id: 'fixtures', label: 'Fixtures', icon: CalendarDays },
  { id: 'leagues', label: 'Leagues', icon: Users },
  { id: 'season', label: 'Season', icon: Trophy },
]

const ACTIVE_ID = 'home'

export function ArenaNav({ variant, openPredictions }: ArenaNavProps) {
  return (
    <nav
      className={`${styles.nav} ${variant === 'bar' ? styles.navBar : styles.navMasthead}`}
      aria-label="Matchday Arena"
    >
      <ul className={styles.navList}>
        {ARENA_DESTINATIONS.map((destination) => {
          const Icon = destination.icon
          const isActive = destination.id === ACTIVE_ID
          const badge = destination.id === 'fixtures' ? openPredictions : 0
          return (
            <li key={destination.id} className={styles.navItem}>
              <button
                type="button"
                className={`${styles.navLink} ${isActive ? styles.navActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  badge > 0 ? `${destination.label}, ${badge} waiting` : undefined
                }
              >
                <span className={styles.navIcon}>
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {badge > 0 ? (
                    <span className={styles.navBadge} aria-hidden="true">
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span className={`${styles.navLabel} ${typography.label}`}>
                  {destination.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
