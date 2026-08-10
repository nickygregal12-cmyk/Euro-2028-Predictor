import { useEffect, useId, useState } from 'react'
import { Skeleton } from '../../design-system'
import {
  ConsensusHiddenError,
  type SeasonConsensus,
  type SeasonConsensusFixture,
} from '../../services/supabase/seasonConsensusModel'
import styles from './SeasonFixtureConsensus.module.css'

/**
 * What everybody predicted for ONE fixture — the Match Centre's "Everyone"
 * section.
 *
 * IT IS THE MATCHWEEK READ, NARROWED, NOT A NEW ONE. Contract 130 already
 * returns per-fixture outcome shares and top scorelines for the whole
 * matchweek, so a Match Centre needs no additional authority: it takes the row
 * for the fixture it is showing. That also means the reveal rule is the same
 * one, enforced in the same place — the read raises until this matchweek's own
 * lock instant has passed.
 *
 * FOUR STATES, KEPT APART. Loading; hidden by rule, which renders NOTHING at
 * all rather than counting down to other people's predictions; a suppressed
 * short cohort, which is a different answer and says how many played and how
 * many are needed; and failed, which says so. "Hidden by rule" and "failed to
 * load" are never the same sentence.
 *
 * NOTHING HERE IDENTIFIES ANYBODY. Counts and shares only. Named league
 * predictions are a SEPARATE read — contract 149, rendered by
 * `SeasonFixtureLeagues` under its own "Your leagues" heading — and the two
 * must never be merged: this one is anonymous, platform-wide and has a minimum
 * cohort; that one is named, private and league-scoped. The heading says
 * "Everyone", and the note says the numbers are anonymous.
 */

export type SeasonFixtureConsensusProps = {
  matchweek: number
  fixtureId: string
  load: (matchweek: number) => Promise<SeasonConsensus>
}

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'failed' }
  | { kind: 'ready'; consensus: SeasonConsensus }

export function SeasonFixtureConsensus({
  matchweek,
  fixtureId,
  load,
}: SeasonFixtureConsensusProps) {
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
        // The read's own refusal, classified rather than flattened: before the
        // lock there is deliberately nothing to show, and that is not an error.
        setState({ kind: error instanceof ConsensusHiddenError ? 'hidden' : 'failed' })
      })
    return () => {
      active = false
    }
  }, [load, matchweek])

  if (state.kind === 'hidden') return null

  if (state.kind === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <h2 className={styles.heading}>Everyone</h2>
        <Skeleton width="100%" height={64} />
      </section>
    )
  }

  if (state.kind === 'failed') {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Everyone</h2>
        {/* Failed, not hidden, and not empty. The distinction is the point. */}
        <p className={styles.note}>What everyone predicted could not be loaded.</p>
      </section>
    )
  }

  const { consensus } = state

  if (consensus.suppressed) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Everyone</h2>
        <p className={styles.note}>
          {consensus.submittedEntries === 1
            ? '1 player played this matchweek'
            : `${consensus.submittedEntries} players played this matchweek`}
          . Predictions are shown once {consensus.minimumEntries} have.
        </p>
      </section>
    )
  }

  const fixture = consensus.fixtures.find((entry) => entry.id === fixtureId) ?? null
  if (!fixture) {
    // The matchweek locked and this fixture is not in its consensus — a real
    // possibility for a rescheduled match, and not something to guess about.
    return null
  }

  return <Distribution fixture={fixture} />
}

function Distribution({ fixture }: { fixture: SeasonConsensusFixture }) {
  // Generated: the panel is rendered more than once on a gallery page, and a
  // fixed id is a critical duplicate-id-aria the moment it is.
  const headingId = useId()
  const bars = [
    { key: 'home', label: fixture.homeName, share: fixture.shares.homeWin, count: fixture.homeWin },
    { key: 'draw', label: 'Draw', share: fixture.shares.draw, count: fixture.draw },
    { key: 'away', label: fixture.awayName, share: fixture.shares.awayWin, count: fixture.awayWin },
  ]

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Everyone
      </h2>
      <p className={styles.note}>
        {fixture.predicted === 1
          ? '1 prediction, anonymous'
          : `${fixture.predicted} predictions, anonymous`}
      </p>

      <ul className={styles.bars}>
        {bars.map((bar) => (
          <li className={styles.bar} key={bar.key}>
            {/* One spoken sentence per row; the bar itself is decoration. */}
            <span className={styles.srOnly}>
              {bar.label}: {bar.share}%, {bar.count} of {fixture.predicted}
            </span>
            <span className={styles.barLabel} aria-hidden="true">
              {bar.label}
            </span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${bar.share}%` }} />
            </span>
            <span className={styles.barValue} aria-hidden="true">
              {bar.share}%
            </span>
          </li>
        ))}
      </ul>

      {fixture.topScores.length > 0 ? (
        <>
          <h3 className={styles.subheading}>Most predicted</h3>
          <ol className={styles.scores}>
            {fixture.topScores.map((score) => (
              <li className={styles.score} key={`${score.home}-${score.away}`}>
                <span className={styles.scoreLine}>
                  {score.home} – {score.away}
                </span>
                <span className={styles.scorePicks}>
                  {score.picks === 1 ? '1 player' : `${score.picks} players`}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  )
}
