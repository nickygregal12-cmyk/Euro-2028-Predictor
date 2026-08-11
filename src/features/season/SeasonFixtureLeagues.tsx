import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '../../design-system'
import { ordinal } from '../league/ordinal'
import type { SeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictions'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovement'
import type { SeasonLeagueMatchweekPages } from './useSeasonLeagueMatchweek'
import {
  presentLeagueFixture,
  presentLeagueMovement,
  type LeagueFixtureRow,
  type LeagueFixtureView,
  type LeagueMovementLine,
} from './leagueFixtureModel'
import styles from './SeasonFixtureLeagues.module.css'

/**
 * What the people the player actually plays with predicted for THIS fixture,
 * and what the matchweek did to their table — the Match Centre's "Your leagues"
 * section (contracts 149 and 150).
 *
 * IT IS THE THIRD OF THREE DELIBERATELY SEPARATE THINGS, and they must not be
 * conflated: **You** is the player's own prediction and points, in the main
 * column; **Your leagues** is named, private and league-scoped; **Everyone** is
 * anonymous, platform-wide and has a minimum cohort. Named league predictions
 * are not a consensus and a consensus is not a league.
 *
 * THE REVEAL BOUNDARY IS THE SERVER'S. Contract 149 resolves the matchweek's
 * own lock and takes no time argument, so there is nothing here to pass and
 * nothing to compute. Before the lock the read returns no members and a
 * predicted count of zero, and this panel says the predictions are hidden until
 * the matchweek locks — it never counts how many people have played, because
 * the read deliberately withholds that and filling it in from elsewhere would
 * leak it.
 *
 * HIDDEN, EMPTY, UNAVAILABLE AND FAILED STAY FOUR STATES. A league that could
 * not be read says so; a league whose matchweek has not locked says that
 * instead; a league where nobody predicted this fixture says that; and none of
 * them is silence.
 *
 * MOVEMENT IS RENDERED ONLY FROM A SETTLED MATCHWEEK, which is contract 150's
 * own gate. An unsettled matchweek produces no line at all rather than a climb
 * out of totals that are still changing.
 *
 * NOTHING LEAVES THE LEAGUE. Every name here is a co-member of a private league
 * the caller belongs to, which is the disclosure boundary the register chose
 * and the server enforces.
 */

export type SeasonFixtureLeaguesLeague = {
  id: string
  name: string
}

/**
 * Neither `pages` nor `loadPredictions` was given. A caller must supply one;
 * failing here renders this league's "could not be loaded" state rather than
 * silently showing an empty league, which would read as "nobody predicted".
 */
function rejectMissingReader(): Promise<never> {
  return Promise.reject(new Error('SeasonFixtureLeagues needs pages or loadPredictions.'))
}

export type SeasonFixtureLeaguesProps = {
  fixtureId: string
  /** The matchweek this fixture belongs to, as a competition round id. */
  competitionRoundId: string | null
  /** The caller's private leagues in this season's Match Predictor. */
  leagues: readonly SeasonFixtureLeaguesLeague[]
  /**
   * Contract 149's payload per league, already read by the page.
   *
   * SUPPLIED RATHER THAN FETCHED because the `INNOV-001` projection needs the
   * same payload, and two components reading it separately would issue the same
   * RPC twice per league and could disagree about the reveal if one failed.
   * Omitted, this component reads for itself — which is what the component
   * gallery does, and what the panel did before the projection existed.
   */
  pages?: SeasonLeagueMatchweekPages
  loadPredictions?: (
    leagueId: string,
    competitionRoundId: string,
  ) => Promise<SeasonLeagueMatchweekPredictions>
  loadMovement: (
    leagueId: string,
    competitionRoundId: string,
  ) => Promise<SeasonLeagueMovement>
  /** Where a co-member's name links to. Omitted renders plain text. */
  playerHref?: (playerId: string) => string
}

type LeagueState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; view: LeagueFixtureView; movement: LeagueMovementLine | null }

export function SeasonFixtureLeagues({
  fixtureId,
  competitionRoundId,
  leagues,
  pages,
  loadPredictions,
  loadMovement,
  playerHref,
}: SeasonFixtureLeaguesProps) {
  const headingId = useId()
  const [states, setStates] = useState<Record<string, LeagueState>>({})

  useEffect(() => {
    if (!competitionRoundId || leagues.length === 0) return
    let active = true
    setStates(Object.fromEntries(leagues.map((league) => [league.id, { kind: 'loading' }])))

    for (const league of leagues) {
      void (async () => {
        try {
          // Each league fails alone. One unreadable league must not take the
          // section down for the others.
          const supplied = pages?.[league.id]
          if (supplied && supplied.kind !== 'ready') {
            if (!active) return
            setStates((current) => ({ ...current, [league.id]: supplied }))
            return
          }
          const page = supplied
            ? supplied.page
            : await (loadPredictions ?? rejectMissingReader)(league.id, competitionRoundId)
          // Movement is asked for only once the predictions have revealed:
          // before the lock there is nothing settled to have moved, and asking
          // is a request that can only answer "no".
          const movement = page.revealed
            ? await loadMovement(league.id, competitionRoundId).catch(() => null)
            : null
          if (!active) return
          setStates((current) => ({
            ...current,
            [league.id]: {
              kind: 'ready',
              view: presentLeagueFixture(page, fixtureId),
              movement: movement ? presentLeagueMovement(movement) : null,
            },
          }))
        } catch {
          if (!active) return
          setStates((current) => ({ ...current, [league.id]: { kind: 'failed' } }))
        }
      })()
    }

    return () => {
      active = false
    }
  }, [fixtureId, competitionRoundId, leagues, pages, loadPredictions, loadMovement])

  // A player in no private league has no league section, rather than an empty
  // one telling them about a feature they have not used.
  if (leagues.length === 0) return null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Your leagues
      </h2>

      {competitionRoundId === null ? (
        <p className={styles.note}>This match&rsquo;s matchweek could not be resolved.</p>
      ) : (
        leagues.map((league) => (
          <LeagueSection
            key={league.id}
            name={league.name}
            state={states[league.id] ?? { kind: 'loading' }}
            playerHref={playerHref}
          />
        ))
      )}
    </section>
  )
}

function LeagueSection({
  name,
  state,
  playerHref,
}: {
  name: string
  state: LeagueState
  playerHref?: (playerId: string) => string
}) {
  if (state.kind === 'loading') {
    return (
      <div className={styles.league} aria-busy="true">
        <h3 className={styles.leagueName}>{name}</h3>
        <Skeleton width="100%" height={48} />
      </div>
    )
  }

  if (state.kind === 'failed') {
    return (
      <div className={styles.league}>
        <h3 className={styles.leagueName}>{name}</h3>
        {/* Failed, not hidden and not empty. */}
        <p className={styles.note}>This league&rsquo;s predictions could not be loaded.</p>
      </div>
    )
  }

  const { view, movement } = state

  if (!view.revealed) {
    return (
      <div className={styles.league}>
        <h3 className={styles.leagueName}>{name}</h3>
        {/* No count of who has played: the read withholds it on purpose. */}
        <p className={styles.note}>
          Predictions are hidden until {view.matchweek.label} locks at its first kickoff.
        </p>
      </div>
    )
  }

  const predicted = view.rows.filter((row) => row.prediction !== null)

  return (
    <div className={styles.league}>
      <h3 className={styles.leagueName}>{name}</h3>

      {movement ? <MovementLine movement={movement} /> : null}

      {predicted.length === 0 ? (
        <p className={styles.note}>
          Nobody in this league predicted this match.
        </p>
      ) : (
        <ul className={styles.rows}>
          {predicted.map((row) => (
            <MemberRow key={row.userId} row={row} playerHref={playerHref} />
          ))}
        </ul>
      )}
    </div>
  )
}

function MovementLine({ movement }: { movement: LeagueMovementLine }) {
  const direction =
    movement.movement > 0
      ? { className: styles.movementUp, text: `↑${movement.movement}` }
      : movement.movement < 0
        ? { className: styles.movementDown, text: `↓${Math.abs(movement.movement)}` }
        : { className: styles.movementLevel, text: 'no change' }

  return (
    <p className={styles.movement}>
      <span className={styles.movementRank}>
        {ordinal(movement.rankBefore)} → {ordinal(movement.rankAfter)}
      </span>
      <span className={direction.className}>{direction.text}</span>
      {movement.pointsThisMatchweek !== null ? (
        <span>
          {movement.pointsThisMatchweek} pts in {movement.matchweekLabel ?? 'this matchweek'}
        </span>
      ) : null}
    </p>
  )
}

function MemberRow({
  row,
  playerHref,
}: {
  row: LeagueFixtureRow
  playerHref?: (playerId: string) => string
}) {
  const href = playerHref?.(row.userId)
  const outcome =
    row.outcome === 'exact'
      ? { className: `${styles.outcome} ${styles.outcomeExact}`, text: 'Exact score' }
      : row.outcome === 'correct'
        ? { className: `${styles.outcome} ${styles.outcomeCorrect}`, text: 'Correct result' }
        : row.outcome === 'wrong'
          ? { className: styles.outcome, text: 'Missed' }
          : null

  return (
    <li className={`${styles.row} ${row.isSelf ? styles.rowSelf : ''}`}>
      <span className={styles.name}>
        {href ? (
          <Link className={styles.nameLink} to={href}>
            {row.displayName}
          </Link>
        ) : (
          row.displayName
        )}
        {row.isSelf ? <span className={styles.srOnly}> (you)</span> : null}
      </span>
      <span className={styles.prediction}>{row.predictionLabel}</span>
      {outcome ? <span className={outcome.className}>{outcome.text}</span> : <span />}
    </li>
  )
}
