import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Skeleton } from '../../design-system'
import type { SeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictionsModel'
import {
  presentLeagueMatchweek,
  type LeagueMatchweekFixture,
  type LeagueMatchweekView,
} from './leagueMatchweekModel'
import {
  coverageNotice,
  LEAGUE_MEMBER_NOUN,
  type ListCoverage,
} from '../shared/listCoverage'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovementModel'
import { presentSideHonours } from './sideHonoursModel'
import { SeasonLeagueHonours } from './SeasonLeagueHonours'
import styles from './SeasonLeagueMatchweek.module.css'

/**
 * A private league's matchweek: what every member predicted, fixture by fixture
 * (contract 149, closing `MIG-UI-01`).
 *
 * TWO LAYOUTS, NOT ONE SHRUNK. Desktop gets the comparison matrix the design
 * authority asks for — fixtures across, members down — because comparing eight
 * people over ten fixtures is what a grid is for. A phone gets a purpose-built
 * fixture-by-fixture list with the player's own row first, because a ten-column
 * grid on a 390px screen is unreadable at any scale. Both render the same
 * model, so they cannot disagree about what somebody predicted, and the matrix
 * scrolls inside its own container so the page body never scrolls sideways.
 *
 * THE REVEAL BOUNDARY IS THE SERVER'S. Contract 149 resolves the matchweek's
 * own lock and accepts no time argument. Before it, the read returns no members
 * at all and a predicted count of zero — so this component says the predictions
 * are hidden and does NOT say how many people have played, because that is the
 * thing the read deliberately withholds.
 *
 * POINTS ARE THE SEASON'S. They come from `season_matchweek_scores` through the
 * read and are absent until the matchweek settles; nothing here recomputes one,
 * so a league cannot disagree with the season about what a matchweek was worth.
 */

export type SeasonLeagueMatchweekProps = {
  leagueId: string
  leagueName: string
  /** The matchweek to show, as a competition round id. */
  competitionRoundId: string | null
  load: (
    leagueId: string,
    competitionRoundId: string,
  ) => Promise<SeasonLeagueMatchweekPredictions>
  /** Where a member's name links. Omitted renders plain text. */
  playerHref?: (playerId: string) => string
  /** Deterministic zone for harnesses and tests; production resolves the viewer's. */
  timeZone?: string
  /**
   * Contract 150's movement for this same matchweek, when the caller has it.
   * Present, the `INNOV-012` honours can award Biggest Mover; absent, they
   * simply do not include it. This component never reads it for itself.
   */
  movement?: SeasonLeagueMovement | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | {
      kind: 'ready'
      view: LeagueMatchweekView
      /**
       * The payload the view came from, carried so the `INNOV-012` honours can
       * be derived from it without a second read of the same matchweek.
       */
      page: SeasonLeagueMatchweekPredictions
    }

export function SeasonLeagueMatchweek({
  leagueId,
  leagueName,
  competitionRoundId,
  load,
  playerHref,
  timeZone,
  movement = null,
}: SeasonLeagueMatchweekProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!competitionRoundId) return
    let active = true
    setState({ kind: 'loading' })
    load(leagueId, competitionRoundId)
      .then((page) => {
        if (active) {
          setState({ kind: 'ready', view: presentLeagueMatchweek(page, timeZone), page })
        }
      })
      .catch(() => {
        if (active) setState({ kind: 'failed' })
      })
    return () => {
      active = false
    }
  }, [leagueId, competitionRoundId, load, timeZone])

  if (competitionRoundId === null) {
    return (
      <p className={styles.note}>
        This season has no matchweek to show yet.
      </p>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className={styles.panel} aria-busy="true">
        <Skeleton width="100%" height={64} />
        <Skeleton width="100%" height={64} />
      </div>
    )
  }

  if (state.kind === 'failed') {
    return (
      <Alert variant="error" title={`We could not load ${leagueName}'s matchweek`}>
        Nothing is hidden here — the read failed. Try again shortly.
      </Alert>
    )
  }

  const { view, page } = state

  if (!view.revealed) {
    return (
      <div className={styles.panel}>
        {/* Hidden by rule, and hidden completely: no member rows and no count
            of who has played. Saying "6 of 8 have predicted" before the lock
            would leak exactly what the boundary exists to withhold. */}
        <p className={styles.note}>
          Everyone&rsquo;s predictions appear once {view.matchweek.label} locks at its first
          kickoff. Until then only your own are visible, on the Match Predictor card.
        </p>
      </div>
    )
  }

  if (view.fixtures.length === 0) {
    return <p className={styles.note}>{view.matchweek.label} has no fixtures.</p>
  }

  return (
    <div className={styles.panel}>
      <p className={styles.caption}>
        {view.matchweek.label} · {view.predictedCount} of {view.memberCount}{' '}
        {view.memberCount === 1 ? 'member' : 'members'} predicted
        {view.settled ? ' · settled' : ''}
      </p>

      {/* Contract 171. The caption above stays true under truncation — both its
          numbers are whole-league counts the server takes across every member —
          but the two layouts below are short, and without this line the members
          the cap dropped are indistinguishable from members who did not play. */}
      <CoverageNotice coverage={view.coverage} />

      {/* Phone: fixture by fixture, the caller's own row first in each. */}
      <ul className={styles.fixtures}>
        {view.fixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} playerHref={playerHref} />
        ))}
      </ul>

      {/* Desktop: the comparison matrix, scrolling inside its own container. */}
      <div className={styles.matrix}>
        <div className={styles.matrixScroll}>
          <table className={styles.grid}>
            <caption className={styles.srOnly}>
              {leagueName} predictions for {view.matchweek.label}
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.gridHead}>
                  Player
                </th>
                {view.fixtures.map((fixture) => (
                  <th scope="col" key={fixture.id} className={styles.gridHead}>
                    {fixture.home} v {fixture.away}
                    {fixture.score ? (
                      <span className={styles.gridScore}>{fixture.score}</span>
                    ) : null}
                  </th>
                ))}
                <th scope="col" className={styles.gridHead}>
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {view.members.map((member) => (
                <tr key={member.userId} className={member.isSelf ? styles.gridSelf : undefined}>
                  <th scope="row">
                    {member.displayName}
                    {member.isSelf ? <span className={styles.srOnly}> (you)</span> : null}
                  </th>
                  {member.cells.map((cell) => (
                    <td
                      key={cell.fixtureId}
                      className={
                        cell.label === null
                          ? styles.gridCellEmpty
                          : cell.outcome === 'exact'
                            ? styles.gridCellExact
                            : styles.gridCell
                      }
                    >
                      {cell.label ?? '—'}
                    </td>
                  ))}
                  <td className={styles.gridPoints}>
                    {/* Absent points and zero points are different answers. */}
                    {member.points === null ? '—' : member.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* INNOV-012, below the matchweek it describes and never beside the
          table: these change no points and no position, and a settled
          matchweek is the only thing they are ever awarded from. */}
      <SeasonLeagueHonours honours={presentSideHonours(page, movement)} />
    </div>
  )
}

/** Contract 171's truncation line, or nothing when the read carried everything. */
function CoverageNotice({ coverage }: { coverage: ListCoverage }) {
  const notice = coverageNotice(coverage, LEAGUE_MEMBER_NOUN)
  if (!notice) return null
  return (
    <p className={styles.note} role="status">
      {notice}
    </p>
  )
}

function FixtureCard({
  fixture,
  playerHref,
}: {
  fixture: LeagueMatchweekFixture
  playerHref?: (playerId: string) => string
}) {
  return (
    <li className={styles.fixture}>
      <div className={styles.fixtureHead}>
        <span className={styles.fixtureTeams}>
          {fixture.home} v {fixture.away}
        </span>
        {fixture.score ? (
          <span className={styles.fixtureScore}>{fixture.score}</span>
        ) : (
          <span className={styles.fixtureMeta}>{fixture.kickoff ?? 'TBC'}</span>
        )}
      </div>

      {fixture.rows.length === 0 ? (
        <p className={styles.note}>Nobody in this league predicted this match.</p>
      ) : (
        <ul className={styles.picks}>
          {fixture.rows.map((row) => {
            const href = playerHref?.(row.userId)
            return (
              <li
                key={row.userId}
                className={`${styles.pick} ${row.isSelf ? styles.pickSelf : ''}`}
              >
                <span className={styles.pickName}>
                  {href ? (
                    <Link className={styles.pickLink} to={href}>
                      {row.displayName}
                    </Link>
                  ) : (
                    row.displayName
                  )}
                  {row.isSelf ? <span className={styles.srOnly}> (you)</span> : null}
                </span>
                <span className={styles.pickValue}>{row.label}</span>
                <span
                  className={
                    row.outcome === 'exact'
                      ? `${styles.outcome} ${styles.outcomeExact}`
                      : row.outcome === 'correct'
                        ? `${styles.outcome} ${styles.outcomeCorrect}`
                        : styles.outcome
                  }
                >
                  {row.outcome === 'exact'
                    ? 'Exact'
                    : row.outcome === 'correct'
                      ? 'Result'
                      : row.outcome === 'wrong'
                        ? 'Missed'
                        : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
