import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  competitionRefFromPath,
  competitionSectionRoute,
  logicalWeeklyParent,
  weeklyRoutes,
} from '../../app/weeklyRoutes'
import styles from './SeasonCompetitionShell.module.css'

/**
 * The competition shell owns competition identity, parent exits and the one
 * competition-level navigation system. The global bottom navigation is hidden
 * by AppShell while this route family is active, so Hub and competition modes
 * no longer compete for the same screen.
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
  children: ReactNode
}

export function SeasonCompetitionShell({
  competitionName,
  seasonLabel,
  statusStrip,
  active,
  destinations,
  children,
}: SeasonCompetitionShellProps) {
  const { pathname } = useLocation()
  const ref = competitionRefFromPath(pathname)
  const gamesPath = ref ? competitionSectionRoute(ref, 'games') : null
  const effectiveActive: SeasonShellSection =
    gamesPath && (pathname === gamesPath || pathname.startsWith(`${gamesPath}/`))
      ? 'games'
      : active
  const parent = logicalWeeklyParent(pathname)

  return (
    <div className={styles.shell}>
      <div className={styles.parentNav} role="group" aria-label="Competition exits">
        {parent && parent.href !== weeklyRoutes.hub ? (
          <Link className={styles.parentLink} to={parent.href}>
            {parent.label}
          </Link>
        ) : null}
        <Link className={styles.parentLink} to={weeklyRoutes.hub}>
          Back to Hub
        </Link>
      </div>

      <header className={styles.masthead}>
        <p className={styles.eyebrow}>{seasonLabel}</p>
        <h1 className={styles.name}>{competitionName}</h1>
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

            return (
              <li key={section.id}>
                {href ? (
                  <Link className={styles.subNavLink} to={href}>
                    {section.label}
                  </Link>
                ) : (
                  <span
                    className={styles.subNavDisabled}
                    aria-disabled="true"
                    title={`${section.label} is not built yet for a season competition`}
                  >
                    {section.label}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.content}>{children}</div>
    </div>
  )
}
