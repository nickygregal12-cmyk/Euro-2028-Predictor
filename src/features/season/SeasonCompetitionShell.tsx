import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './SeasonCompetitionShell.module.css'

/**
 * The thin competition shell: a masthead and a horizontal sub-navigation.
 *
 * §4.5's navigation rule is the whole design here, and it is a rule about what
 * this component must NOT do: "The global desktop rail remains global and
 * remains visible inside competition context. It never swaps its destinations."
 * So this shell renders inside the existing app shell and adds competition
 * identity above the content — it does not replace, wrap or re-implement global
 * navigation, and there is deliberately no "Back to Hub" control, because the
 * Hub is still one tap away in the navigation that was never taken over.
 *
 * §11.1 constrains the masthead further: "a flat tint band or subtle geometric
 * mark, never a gradient-heavy hero treatment", and the competition accent may
 * touch only the active navigation indicator, the single primary action, the
 * focus ring and the masthead. Both are honoured in the stylesheet.
 *
 * Sub-navigation renders a real link for every section the caller can name a
 * destination for, and an explicitly unavailable label for the rest — a dead
 * link is a worse answer than a disabled control that says why.
 *
 * THE SCROLL CONTAINER IS FOCUSABLE, AND THAT IS AN ACCESSIBILITY FIX RATHER
 * THAN A STYLE CHOICE. §7.3 requires this bar to scroll horizontally on narrow
 * screens, and `.subNav` is the overflow region. When every item inside it is a
 * non-interactive label — which is what this was before destinations existed —
 * the region has no keyboard-focusable content, so a keyboard or switch user
 * can neither reach it nor scroll it. axe reports `scrollable-region-focusable`
 * as SERIOUS, and it was right: the mobile browser suite caught it the first
 * time this shell was ever scanned, because its only previous consumer sits
 * behind a flag that renders 404 in the harness.
 *
 * `tabIndex={0}` makes the region reachable regardless of which section is
 * active or how many destinations the caller supplies — the active section is
 * never a link, so a shell showing only Overview-as-active would otherwise
 * regress to the same violation.
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
  /** The live status strip §4.5 asks for: deadline, matchweek, rank. */
  statusStrip: readonly string[]
  active: SeasonShellSection
  /** Where each reachable section lives. Absent sections stay unavailable. */
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
  return (
    <div className={styles.shell}>
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

      <nav
        className={styles.subNav}
        aria-label={`${competitionName} sections`}
        tabIndex={0}
      >
        <ul className={styles.subNavList}>
          {SECTIONS.map((section) => {
            const isActive = section.id === active
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
