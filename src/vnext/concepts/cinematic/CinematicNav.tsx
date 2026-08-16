import { CalendarDays, Compass, Trophy, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { HomeModel } from '../../models/home'
import { formatOrdinal } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import styles from './cinematic.module.css'

export type CinematicNavProps = {
  model: HomeModel
  openPredictions: number
  /** `overlay` floats on the hero; `bar` is the detached mobile pill. */
  variant?: 'overlay' | 'bar'
}

type CinematicDestination = {
  id: string
  label: string
  icon: LucideIcon
}

const DESTINATIONS: readonly CinematicDestination[] = [
  { id: 'home', label: 'Discover', icon: Compass },
  { id: 'fixtures', label: 'Fixtures', icon: CalendarDays },
  { id: 'leagues', label: 'Leagues', icon: Users },
  { id: 'season', label: 'Season', icon: Trophy },
]

const ACTIVE_ID = 'home'

/**
 * Cinematic's navigation exploration: chrome that gets out of the way.
 *
 * The third of the three answers. Concept A puts destinations in a solid
 * broadcast masthead and Concept B gives them a permanent rail; this one floats
 * them over the hero so nothing horizontal or vertical is spent on navigation
 * at all, and pairs them with a "you" pill carrying the rank — the smallest
 * honest answer to "how am I doing" on a surface that is otherwise about
 * discovery.
 *
 * The trade-off is stated rather than hidden: an overlay bar is the least
 * discoverable of the three and depends entirely on its own contrast, which is
 * why it carries a solid scrim of its own rather than relying on the hero
 * behind it.
 *
 * NOT ROUTING. The active destination is fixed and nothing navigates.
 */
export function CinematicNav({
  model,
  openPredictions,
  variant = 'overlay',
}: CinematicNavProps) {
  const isBar = variant === 'bar'

  return (
    <div className={isBar ? styles.navBarWrap : styles.navOverlayWrap}>
      {isBar ? null : (
        <div className={styles.navBrand}>
          <span className={typography.label}>{model.competition.shortName}</span>
          <span className={`${typography.body} ${styles.navBrandLine}`}>
            {model.competition.matchweekLabel}
          </span>
        </div>
      )}

      <nav
        className={`${styles.nav} ${isBar ? styles.navBar : styles.navOverlay}`}
        aria-label={isBar ? 'Cinematic Football, compact' : 'Cinematic Football'}
      >
        <ul className={styles.navList}>
          {DESTINATIONS.map((destination) => {
            const Icon = destination.icon
            const isActive = destination.id === ACTIVE_ID
            const badge = destination.id === 'fixtures' ? openPredictions : 0
            return (
              <li key={destination.id}>
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
                  <span className={styles.navLabel}>{destination.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {isBar ? null : (
        <p className={styles.navYou}>
          <span className={typography.label}>You</span>
          <span className={`${styles.navYouRank} ${typography.numeric}`}>
            {formatOrdinal(model.recentPerformance.rank)}
          </span>
          <span className={typography.micro}>
            {model.recentPerformance.provisionalPoints} pts on the pitch
          </span>
        </p>
      )}
    </div>
  )
}
