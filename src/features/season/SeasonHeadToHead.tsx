import { useEffect, useState } from 'react'
import { Button, Skeleton } from '../../design-system'
import {
  HeadToHeadHiddenError,
  OpponentNotEnteredError,
  type SeasonHeadToHead as HeadToHead,
} from '../../services/supabase/seasonHeadToHeadModel'
import styles from './SeasonHeadToHead.module.css'

/**
 * One matchweek, you against one league rival (contract 129).
 *
 * OPENED FROM A LEAGUE TABLE ROW AND NOWHERE ELSE. A private league is a room
 * you are both in, which is what makes comparing predictions a reasonable thing
 * to offer; the public season leaderboard exposes no account identifier at all,
 * so a head-to-head against a stranger is not merely unbuilt but unaddressable.
 * That is a boundary rather than a gap.
 *
 * THREE ANSWERS, KEPT APART. Hidden means the matchweek has not locked — or its
 * kickoffs are incomplete, which contract 129 treats the same way and errs
 * towards hiding. Not-entered means the rival holds no entry in this season,
 * which no amount of waiting changes. Anything else is a failure. Collapsing
 * any two would send a player to wait for something that is not coming, or make
 * an outage look like a rule.
 *
 * A NULL MATCHWEEK POINTS FIGURE IS NOT ZERO and is rendered as an em dash: the
 * matchweek has not settled, which is a different fact from settling at
 * nothing, and printing 0 would invent a result for both players.
 */

export type SeasonHeadToHeadProps = {
  opponentName: string
  matchweek: number
  load: () => Promise<HeadToHead>
  onClose: () => void
}

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'not_entered' }
  | { kind: 'failed' }
  | { kind: 'ready'; h2h: HeadToHead }

function points(value: number | null): string {
  return value === null ? '—' : String(value)
}

function scoreline(prediction: { home: number; away: number } | null): string {
  return prediction ? `${prediction.home}-${prediction.away}` : '—'
}

export function SeasonHeadToHead({
  opponentName,
  matchweek,
  load,
  onClose,
}: SeasonHeadToHeadProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    load()
      .then((h2h) => {
        if (active) setState({ kind: 'ready', h2h })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof HeadToHeadHiddenError) setState({ kind: 'hidden' })
        else if (error instanceof OpponentNotEnteredError) setState({ kind: 'not_entered' })
        else setState({ kind: 'failed' })
      })
    return () => {
      active = false
    }
  }, [load])

  const heading = `You against ${opponentName}`

  return (
    <section className={styles.panel} aria-labelledby="h2h-heading">
      <div className={styles.head}>
        <h4 className={styles.heading} id="h2h-heading">
          {heading}
        </h4>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>

      {state.kind === 'loading' ? <Skeleton height={120} radius="card" /> : null}

      {state.kind === 'hidden' ? (
        <p className={styles.note}>
          Matchweek {matchweek} has not locked yet, so nobody else’s predictions
          are shown. This fills in once it does.
        </p>
      ) : null}

      {state.kind === 'not_entered' ? (
        <p className={styles.note}>
          {opponentName} has not entered this season, so there is nothing to
          compare. They are in the league; they are not playing the game it
          ranks.
        </p>
      ) : null}

      {state.kind === 'failed' ? (
        <p className={styles.note}>
          This comparison could not be loaded. Your own predictions and points
          are unaffected.
        </p>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <dl className={styles.summary}>
            <div className={styles.figure}>
              <dt>You</dt>
              <dd>{points(state.h2h.you.points)}</dd>
            </div>
            <div className={styles.figure}>
              <dt>{state.h2h.opponent.displayName ?? opponentName}</dt>
              <dd>{points(state.h2h.opponent.points)}</dd>
            </div>
            <div className={styles.figure}>
              <dt>Season</dt>
              <dd>
                {state.h2h.you.seasonPoints} v {state.h2h.opponent.seasonPoints}
              </dd>
            </div>
          </dl>

          {state.h2h.you.joker || state.h2h.opponent.joker ? (
            <p className={styles.note}>
              Joker played this matchweek:{' '}
              {[state.h2h.you.joker ? 'you' : null, state.h2h.opponent.joker ? opponentName : null]
                .filter(Boolean)
                .join(' and ')}
              .
            </p>
          ) : null}

          <ul className={styles.list}>
            {state.h2h.fixtures.map((fixture) => (
              <li className={styles.row} key={fixture.id}>
                <span className={styles.teams}>
                  {fixture.homeName} v {fixture.awayName}
                </span>
                <span className={styles.picks}>
                  <span>{scoreline(fixture.yours)}</span>
                  <span className={styles.divider} aria-hidden="true">
                    ·
                  </span>
                  <span>{scoreline(fixture.theirs)}</span>
                </span>
                <span className={styles.result}>
                  {fixture.resultHome !== null && fixture.resultAway !== null
                    ? `${fixture.resultHome}-${fixture.resultAway}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>

          {state.h2h.fixtures.length === 0 ? (
            <p className={styles.note}>This matchweek has no fixtures.</p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
