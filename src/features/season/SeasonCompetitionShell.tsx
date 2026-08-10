import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Workspace } from '../../design-system'
import {
  competitionRefFromPath,
  competitionRoute,
  competitionSectionRoute,
  logicalWeeklyParent,
  weeklyRoutes,
} from '../../app/weeklyRoutes'
import styles from './SeasonCompetitionShell.module.css'

/**
 * The competition shell owns competition identity, parent exits, quick
 * competition switching and the one competition-level navigation system. It
 * sits UNDER the global bottom navigation rather than in place of it — the
 * design authority keeps the five global destinations visible and unchanged
 * inside competition context.
 *
 * THERE IS NO "BACK TO HUB" LINK HERE, and its absence is the point. The same
 * authority says the Hub stays one click away "without a compensating Back to
 * Hub control", and lists adding one among the things not to do: the Home tab
 * in the global bar IS that control. What remains is the LOGICAL PARENT, which
 * is a different thing — `DFA-005` requires a deep route to say where it sits,
 * and "Back to Games" from a game page is that answer, not a way home.
 */
export type SeasonShellSection = 'overview' | 'play' | 'matches' | 'games' | 'leagues'

const SECTIONS: readonly { id: SeasonShellSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'play', label: 'Play' },
  { id: 'matches', label: 'Matches' },
  { id: 'games', label: 'Games' },
  { id: 'leagues', label: 'Leagues' },
]

export type SeasonCompetitionShellProps = {
  competitionName: string
  seasonLabel: string
  statusStrip: readonly string[]
  active: SeasonShellSection
  destinations?: Partial<Record<SeasonShellSection, string>>
  /**
   * The desktop contextual panel for this section, and the name it is given as
   * a landmark. Below the wide breakpoint it stacks under the content in source
   * order, so nothing may be reachable only from here.
   *
   * COMPOSED BY THE ROUTE, not by the page: the route is where the second read
   * and its gateway already are, and a page that fetched a panel's data would
   * make the panel compulsory.
   */
  aside?: ReactNode
  asideLabel?: string
  /**
   * `reading` caps the content column at a readable measure and is the default
   * — a fixture list or a form spread across 1440px is the widened-phone
   * failure in reverse. `full` is for the sections whose content genuinely is a
   * wide table.
   */
  width?: 'reading' | 'full'
  children: ReactNode
}

export function SeasonCompetitionShell({
  competitionName,
  seasonLabel,
  statusStrip,
  active,
  destinations,
  aside,
  asideLabel,
  width = 'reading',
  children,
}: SeasonCompetitionShellProps) {
  const { pathname, search, hash } = useLocation()
  const ref = competitionRefFromPath(pathname)
  const gamesPath = ref ? competitionSectionRoute(ref, 'games') : null
  const effectiveActive: SeasonShellSection =
    gamesPath && (pathname === gamesPath || pathname.startsWith(`${gamesPath}/`))
      ? 'games'
      : active
  const parent = logicalWeeklyParent(pathname)
  const switchRef = ref
    ? {
        competitionSlug:
          ref.competitionSlug === 'premier-league' ? 'scottish-premiership' : 'premier-league',
        seasonSlug: '2026-27',
      }
    : null
  const switchLabel = ref?.competitionSlug === 'premier-league' ? 'Scottish Premiership' : 'Premier League'
  const switchHref = ref && switchRef
    ? `${pathname.replace(competitionRoute(ref), competitionRoute(switchRef))}${search}${hash}`
    : null

  return (
    <div className={styles.shell}>
      {parent && parent.href !== weeklyRoutes.hub ? (
        <div className={styles.parentNav} role="group" aria-label="Competition exits">
          <Link className={styles.parentLink} to={parent.href}>
            {parent.label}
          </Link>
        </div>
      ) : null}

      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{seasonLabel}</p>
        <div className={styles.mastheadRow}>
          <h1 className={styles.name}>{competitionName}</h1>
          {switchHref ? (
            <Link className={styles.switcherLink} to={switchHref}>
              Switch to {switchLabel}
            </Link>
          ) : null}
        </div>
        {statusStrip.length > 0 ? (
          <dl className={styles.status}>
            {statusStrip.map((entry) => (
              <div key={entry} className={styles.statusItem}>
                <dd className={styles.statusValue}>{entry}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <nav className={styles.subNav} aria-label={`${competitionName} sections`} tabIndex={0}>
        <ul className={styles.subNavList}>
          {SECTIONS.map((section) => {
            const isActive = section.id === effectiveActive
            const href = destinations?.[section.id]

            if (isActive) {
              return (
                <li key={section.id}>
                  <span className={styles.subNavActive} aria-current="page">
                    {section.label}
                  </span>
                </li>
              )
            }

            // A section with no destination is not listed. Every caller
            // supplies all five today via `seasonShellDestinations`, so this is
            // the DEV harness's path in practice — but it is the same trap the
            // game sub-navigation had actually fallen into, and a greyed label
            // left here is how the next section quietly becomes one.
            if (!href) return null

            return (
              <li key={section.id}>
                <Link className={styles.subNavLink} to={href}>
                  {section.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.content}>
        <Workspace aside={aside} asideLabel={asideLabel} width={width}>
          {children}
        </Workspace>
      </div>
    </div>
  )
}
