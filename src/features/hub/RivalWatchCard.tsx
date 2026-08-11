import { useState } from 'react'
import { Alert, Button } from '../../design-system'
import { pointsSentence } from './rivalWatchModel'
import type { RivalWatchState } from './useRivalWatch'
import { ordinal } from '../league/ordinal'
import styles from './RivalWatchCard.module.css'

/**
 * Rival Watch on the Hub (`MIG-UI-09`).
 *
 * IT IS ABSENT RATHER THAN EMPTY when there is nothing to say. No private
 * league, no league table, a failed read — all produce no card, because Rival
 * Watch is context and an empty box where football should be is worse than
 * nothing. The one state it DOES render with no rival is "you are in a league
 * and have pinned nobody", which is an offer rather than an emptiness.
 *
 * IT NAMES THE LEAGUE THE COMPARISON COMES FROM, every time. Rank here is the
 * LEAGUE's rank — recomputed inside the league by the server, because a private
 * league is its own table (contract 128) — and calling it a season rank would
 * be a different number. The bound is stated for the same reason the Matchweek
 * Recap states its own: this covers one league in one competition, and a cap
 * nobody can see reads as complete coverage.
 *
 * THE PICKER IS THE LEAGUE TABLE, WHICH IS THE WHOLE PRIVACY STORY. Every name
 * offered is somebody the player already shares a private league with, which is
 * exactly the boundary `set_pinned_rival` enforces server-side. There is no
 * search, no directory and no way to reach anybody who is not already on
 * screen.
 */

export type RivalWatchCardProps = {
  state: RivalWatchState & { pin: (rivalUserId: string, pinned: boolean) => Promise<void> }
}

export function RivalWatchCard({ state }: RivalWatchCardProps) {
  const [picking, setPicking] = useState(false)

  if (state.status !== 'ready' || !state.watch || !state.leagueName) return null

  const { watch } = state

  if (watch.youAreNotPlaying) return null
  if (watch.pinned.length === 0 && watch.candidates.length === 0) return null

  return (
    <section className={styles.card} aria-labelledby="rival-watch-title">
      <header className={styles.head}>
        <h2 className={styles.title} id="rival-watch-title">
          Rival Watch
        </h2>
        <p className={styles.where}>
          {state.leagueName}
          {state.competitionName ? ` · ${state.competitionName}` : ''}
        </p>
      </header>

      {state.pinError ? (
        <Alert variant="warning" title="Rival not saved">
          {state.pinError}
        </Alert>
      ) : null}

      {watch.pinned.length === 0 ? (
        <p className={styles.empty}>
          Pin someone from {state.leagueName} and you will see how you are doing against them here.
        </p>
      ) : (
        <ul className={styles.list}>
          {watch.pinned.map((rival) => (
            <li className={styles.rival} key={rival.userId}>
              <div className={styles.rivalBody}>
                <span className={styles.rivalName}>{rival.displayName}</span>
                <span className={styles.rivalGap}>{pointsSentence(rival)}</span>
                <span className={styles.rivalMeta}>
                  {/* Both ranks, both labelled as the league's. A single number
                      would leave the player working out whose it was. */}
                  You {ordinal(rival.yourRank)} · them {ordinal(rival.theirRank)} in the league
                  {rival.hasGamesInHand
                    ? ` · they have played ${rival.matchweeksPlayed} matchweeks`
                    : ''}
                </span>
              </div>
              <Button variant="secondary" onClick={() => void state.pin(rival.userId, false)}>
                Unpin
              </Button>
            </li>
          ))}
        </ul>
      )}

      {watch.candidates.length > 0 ? (
        <div className={styles.picker}>
          <Button variant="secondary" aria-expanded={picking} onClick={() => setPicking(!picking)}>
            {picking ? 'Done' : 'Pin a rival'}
          </Button>
          {picking ? (
            <ul className={styles.candidates}>
              {watch.candidates.map((candidate) => (
                <li key={candidate.userId}>
                  <button
                    type="button"
                    className={styles.candidate}
                    onClick={() => {
                      setPicking(false)
                      void state.pin(candidate.userId, true)
                    }}
                  >
                    {candidate.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className={styles.note}>
        From one of your private leagues. Open the competition to compare across all of them.
      </p>
    </section>
  )
}
