import { useEffect, useState } from 'react'
import { Skeleton } from '../../design-system'
import {
  ConsensusHiddenError,
  type SeasonConsensus,
} from '../../services/supabase/seasonConsensusModel'
import styles from './SeasonConsensusPanel.module.css'

/**
 * What everyone else predicted for this matchweek (contract 130).
 *
 * IT RENDERS NOTHING BEFORE THE LOCK, and that is the read's decision rather
 * than this component's: `get_season_prediction_consensus` raises until the
 * matchweek's own lock instant has passed, because a consensus visible while
 * predictions are open would tell a player what everyone else picked before
 * they picked. The panel simply disappears, with no "come back later" — a
 * placeholder counting down to other people's predictions is an invitation to
 * wait for information a player should not be waiting for.
 *
 * TOO SMALL A COHORT IS A DIFFERENT ANSWER AND SAYS SO. Under ten entries in
 * THIS round the server returns a suppressed payload with the counts, so the
 * panel can say how many played and how many are needed. That distinction only
 * exists because the cohort is counted per matchweek: a season with fifty
 * entrants of whom six played matchweek 30 is precisely the case the minimum
 * protects, and a season-membership count would have hidden it.
 *
 * NOTHING HERE IDENTIFIES ANYBODY. The read returns counts and shares; no
 * entrant, rank or name appears in the payload, so no reveal question arises
 * beyond the lock the server already enforces.
 */

export type SeasonConsensusPanelProps = {
  matchweek: number
  /**
   * The read, supplied by the route. Required rather than defaulted to the
   * Supabase-backed fetch: a component that reaches for the configured client
   * cannot be rendered without one, and CLAUDE.md's rule is that components
   * never call Supabase at all.
   */
  load: (matchweek: number) => Promise<SeasonConsensus>
}

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'failed' }
  | { kind: 'ready'; consensus: SeasonConsensus }

export function SeasonConsensusPanel({ matchweek, load }: SeasonConsensusPanelProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    load(matchweek)
      .then((consensus) => {
        if (active) setState({ kind: 'ready', consensus })
      })
      .catch((error: unknown) => {
        if (!active) return
        // Hidden is not a failure, and a failure is not hidden. Rendering one
        // as the other would either invite a player to retry something that
        // will refuse identically, or make a genuine outage look like a rule.
        setState({ kind: error instanceof ConsensusHiddenError ? 'hidden' : 'failed' })
      })
    return () => {
      active = false
    }
  }, [matchweek, load])

  if (state.kind === 'hidden') return null

  if (state.kind === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <h3 className={styles.heading}>What everyone predicted</h3>
        <Skeleton height={96} radius="card" />
      </section>
    )
  }

  if (state.kind === 'failed') {
    return (
      <section className={styles.panel}>
        <h3 className={styles.heading}>What everyone predicted</h3>
        <p className={styles.note}>
          This could not be loaded. Your own card and points are unaffected.
        </p>
      </section>
    )
  }

  const { consensus } = state

  if (consensus.suppressed) {
    return (
      <section className={styles.panel}>
        <h3 className={styles.heading}>What everyone predicted</h3>
        <p className={styles.note}>
          {consensus.submittedEntries === 1
            ? '1 player predicted this matchweek'
            : `${consensus.submittedEntries} players predicted this matchweek`}
          , and {consensus.minimumEntries} are needed before the breakdown is
          shown. With fewer, a share is close enough to naming who picked what.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.panel} aria-labelledby="consensus-heading">
      <h3 className={styles.heading} id="consensus-heading">
        What everyone predicted
      </h3>
      <p className={styles.note}>
        From the {consensus.submittedEntries} entries that predicted matchweek{' '}
        {consensus.matchweek}.
      </p>

      <ul className={styles.list}>
        {consensus.fixtures.map((fixture) => (
          <li className={styles.fixture} key={fixture.id}>
            <div className={styles.fixtureHead}>
              <span className={styles.teams}>
                {fixture.homeName} v {fixture.awayName}
              </span>
              {fixture.resultHome !== null && fixture.resultAway !== null ? (
                <span className={styles.result}>
                  {fixture.resultHome} - {fixture.resultAway}
                </span>
              ) : null}
            </div>

            {/* A meter rather than a chart: three shares of one whole, which is
                what a player reads first. The numbers are beside it, because a
                bar with no figure is a shape. */}
            <div
              className={styles.bar}
              role="img"
              aria-label={
                `${fixture.homeName} win ${fixture.shares.homeWin}%, ` +
                `draw ${fixture.shares.draw}%, ` +
                `${fixture.awayName} win ${fixture.shares.awayWin}%`
              }
            >
              <span className={styles.home} style={{ width: `${fixture.shares.homeWin}%` }} />
              <span className={styles.draw} style={{ width: `${fixture.shares.draw}%` }} />
              <span className={styles.away} style={{ width: `${fixture.shares.awayWin}%` }} />
            </div>

            <p className={styles.shares} aria-hidden="true">
              <span>{fixture.shares.homeWin}% home</span>
              <span>{fixture.shares.draw}% draw</span>
              <span>{fixture.shares.awayWin}% away</span>
            </p>

            {fixture.topScores.length > 0 ? (
              <p className={styles.top}>
                Most picked:{' '}
                {fixture.topScores
                  .slice(0, 3)
                  .map((score) => `${score.home}-${score.away} (${score.picks})`)
                  .join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
