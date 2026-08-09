import { useState, type ReactNode } from 'react'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import type { FixtureListRow } from './fixtureListModel'
import { SeasonMatchCentre, type SeasonFootballContext } from './SeasonMatchCentre'
import type { SeasonMatchCentreCardReader } from './useSeasonMatchCentre'
import {
  useSeasonFixtureWindow,
  type SeasonFixtureWindowGateway,
} from './useSeasonFixtureWindow'
import styles from './SeasonMatchesPage.module.css'

/**
 * §7.3's Matches section: a competition's fixtures and results.
 *
 * IT IS ORDERED BY KICKOFF AND LABELLED BY MATCHWEEK, which is a correction
 * rather than a preference. This surface used to read one matchweek at a time
 * through `get_season_matchweek_card` and group strictly by round — and
 * `MASTER-TODO.md` names that as the easy misreading: a fixture postponed out
 * of matchweek 5 into November keeps `competition_round_id = 5` deliberately,
 * so a by-round list files a November match under a September heading and puts
 * it nowhere near the matches it is played beside. Contract 139's read is
 * windowed by DATE and carries the round as a label, which is what makes the
 * right answer expressible.
 *
 * IT IS A COMPETITION SURFACE, NOT A GAME SURFACE. Fixtures belong to the
 * competition, so this is readable by anyone following it, joined or not — the
 * read asks for no entry and returns no prediction, no Joker and no points.
 *
 * THE CLOCK IS NOT AN AUTHORITY ON WHETHER A MATCH FINISHED. A fixture is
 * played because the server says `played`, never because its kickoff has
 * passed, which would be wrong every time a match is delayed or abandoned.
 *
 * A PROVISIONAL SCORE IS NEVER SHOWN AS A SCORE. Contract 139 returns what the
 * platform settled and what a provider currently reports in two separate
 * fields, precisely so a surface cannot promote one to the other. Where there
 * is no official result and a provider has both numbers, the row shows them
 * marked as provisional; the confirmation gate decides everything else.
 *
 * Club identity is `ClubIdentity` with contract 136's stored code and colours,
 * and it is never the sole identifier — the club's name is beside it, and the
 * screen-reader summary remains the single spoken fixture description.
 */

export type SeasonMatchesPageProps = {
  gateway: SeasonFixtureWindowGateway
  /** The competition's own timezone; every date and time is resolved in it. */
  timeZone: string
  /**
   * Reads the caller's own matchweek card, for the Match Centre a fixture
   * opens into. Omitted where there is no entry to read — the DEV harness, and
   * any future context with fixtures but no player — and the rows are then
   * plain rows rather than controls that open nothing.
   */
  readMatchweekCard?: SeasonMatchCentreCardReader
  /**
   * Contract 141's club form and season head-to-head, for an opened fixture.
   * Optional and independent of the card: the football is the same for
   * everybody and is shown even where an entry could not be read.
   */
  football?: SeasonFootballContext
}

const SKELETON_ROWS = 6

function windowLabel(window: { from: string; to: string } | null, timeZone: string): string {
  if (!window) return 'Fixtures'
  const format = (instant: string) =>
    new Date(instant).toLocaleDateString(undefined, {
      timeZone,
      day: 'numeric',
      month: 'short',
    })
  return `${format(window.from)} – ${format(window.to)}`
}

function Match({
  row,
  expanded,
  onToggle,
  children,
}: {
  row: FixtureListRow
  /** Null where no Match Centre is available — the row is then not a control. */
  expanded: boolean | null
  onToggle: () => void
  children?: ReactNode
}) {
  // A row with nothing behind it stays a row. Making every fixture a button
  // when opening one shows nothing is a control that lies about being one.
  const Row = expanded === null ? 'div' : 'button'

  return (
    <li className={styles.matchItem}>
      <Row
        className={styles.match}
        {...(expanded === null
          ? {}
          : { type: 'button' as const, onClick: onToggle, 'aria-expanded': expanded })}
      >
      <span className={styles.srOnly}>{row.accessibleSummary}</span>
      <span className={styles.home} aria-hidden="true">
        <span className={styles.clubName}>{row.home.name}</span>
        <span className={styles.clubVisual}>
          <ClubIdentity name={row.home.name} tokens={row.home.tokens} size="table" />
        </span>
      </span>
      <span className={row.played ? styles.score : styles.kickoff} aria-hidden="true">
        {/* A dash, not a zero: an unplayed fixture has no score, and "0 - 0" is
            a result somebody could act on. */}
        {row.score ?? row.provisional ?? row.kickoff ?? '—'}
      </span>
      <span className={styles.away} aria-hidden="true">
        <span className={styles.clubVisual}>
          <ClubIdentity name={row.away.name} tokens={row.away.tokens} size="table" />
        </span>
        <span className={styles.clubName}>{row.away.name}</span>
      </span>
      {/* The matchweek, only where the day carries more than one — which is
          exactly when a reader needs telling. And the provisional marker, only
          where a provisional score is being shown in place of a result. */}
      {row.roundLabel || row.provisional ? (
        <span className={styles.rowMeta} aria-hidden="true">
          {row.roundLabel ? <span className={styles.roundTag}>{row.roundLabel}</span> : null}
          {row.provisional ? <span className={styles.provisional}>Provisional</span> : null}
        </span>
      ) : null}
      </Row>
      {children}
    </li>
  )
}

export function SeasonMatchesPage({
  gateway,
  timeZone,
  readMatchweekCard,
  football,
}: SeasonMatchesPageProps) {
  const { status, view, window, stepping, error, previous, next, reload } =
    useSeasonFixtureWindow(gateway, timeZone)
  // One at a time. Several open panels would be several card reads on screen
  // saying the same thing about the same matchweek.
  const [openFixture, setOpenFixture] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <section className={styles.page} aria-busy="true">
        <h2 className={styles.heading}>Matches</h2>
        <Skeleton width="40%" height={24} />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} width="100%" height={48} />
        ))}
      </section>
    )
  }

  if (status === 'failed' || !view) {
    return (
      <section className={styles.page}>
        <h2 className={styles.heading}>Matches</h2>
        <Alert variant="error" title="We could not load these fixtures">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Matches</h2>

      <div className={styles.stepper}>
        <Button
          variant="secondary"
          onClick={previous}
          disabled={stepping}
          aria-label="Earlier fixtures"
        >
          ←
        </Button>
        {/* Announced on change, so a screen-reader user stepping through the
            season hears where they have landed. */}
        <p className={styles.matchweek} aria-live="polite">
          {windowLabel(window, timeZone)}
        </p>
        <Button
          variant="secondary"
          onClick={next}
          disabled={stepping}
          aria-label="Later fixtures"
        >
          →
        </Button>
      </div>

      {view.hasRescheduled ? (
        <p className={styles.note}>
          A day below carries more than one matchweek. A rescheduled fixture keeps
          the matchweek it was scheduled in and is listed on the day it is
          actually played, so its matchweek is shown beside it.
        </p>
      ) : null}

      {view.resultsNote ? <p className={styles.note}>{view.resultsNote}</p> : null}

      {view.empty ? (
        <EmptyState
          title="No fixtures in this period"
          description="Nothing is scheduled between these dates. Step forward or back to find the next matches."
        />
      ) : (
        <div className={stepping ? styles.stepping : undefined}>
          {view.days.map((day) => (
            <section key={day.key} className={styles.day}>
              <h3 className={styles.dayHeading}>{day.label}</h3>
              <ul className={styles.list}>
                {day.rows.map((row) => (
                  <Match
                    key={row.id}
                    row={row}
                    expanded={readMatchweekCard ? openFixture === row.id : null}
                    onToggle={() =>
                      setOpenFixture((open) => (open === row.id ? null : row.id))
                    }
                  >
                    {readMatchweekCard && openFixture === row.id ? (
                      <SeasonMatchCentre
                        fixture={row}
                        read={readMatchweekCard}
                        football={football}
                      />
                    ) : null}
                  </Match>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
