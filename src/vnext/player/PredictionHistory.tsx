import type { ProfileMatchweek } from '../models/playerProfile'
import { formatNumber } from '../foundations/format'
import text from '../foundations/typography.module.css'
import styles from './playerProfile.module.css'

/**
 * THE MATCHWEEKS THE SERVER WAS WILLING TO SHOW.
 *
 * ============================ THE GAPS ARE THE BOUNDARY, AND ARE NOT
 * COUNTED ==================================================================
 *
 * Contract 151 does not blank an unrevealed matchweek — it OMITS it, admitting
 * a round only once that round's own lock has passed (or the profile is the
 * caller's own, because those are their own picks). So this list is already
 * reveal-safe, and its gaps mean "not yet revealed" OR "they did not play it".
 * The payload does not say which.
 *
 * Which is why THERE IS NO "3 of 12" HERE, no progress bar and no percentage of
 * the season. Every one of those needs a denominator this page does not have,
 * and inventing one would put a claim about a player's participation on screen
 * that no read established. The heading counts what is shown and says so.
 *
 * ============================ AN UNSETTLED MATCHWEEK IS NOT A ZERO =======
 *
 * A locked matchweek that has not been marked arrives with no points figure,
 * and `ProfileMatchweekResult` makes that its own case so nothing here can
 * `?? 0` it. "0 pts" against an unmarked matchweek is a scoreline the player
 * did not get.
 *
 * ============================ THE PICKS ARE COUNTED, NOT NAMED ===========
 *
 * The payload keys predictions by SEASON FIXTURE ID and carries no team names —
 * see §6 of `docs/product/vnext-player-profiles.md`, where this is recorded as
 * REAL BUT PARTIAL. Naming the fixtures would take one read per matchweek,
 * which is the N+1 the Stage 10 predicate forbids; printing "2–1" beside an
 * opaque identifier would be a scoreline against no one. So the count is drawn,
 * which is true, and the scorelines wait for a fixture join that is not this
 * stage's.
 */

export type PredictionHistoryProps = {
  readonly history: readonly ProfileMatchweek[]
  /** Whether this is the reader's own profile, which changes the sentence. */
  readonly isYou: boolean
}

export function PredictionHistory({ history, isYou }: PredictionHistoryProps) {
  if (history.length === 0) {
    return (
      <p className={`${text.body} ${styles.panelEmpty}`}>
        {isYou
          ? 'You have not predicted a matchweek in this season yet.'
          : 'There is no revealed matchweek to show for this player yet.'}
      </p>
    )
  }

  return (
    <ol className={styles.history} data-vnext-zone="history">
      {history.map((matchweek) => (
        <li key={matchweek.matchweekId} className={styles.historyItem}>
          <div className={styles.historyHead}>
            <span className={`${text.body} ${styles.historyLabel}`}>{matchweek.label}</span>
            {matchweek.jokerPlayed ? (
              <span className={`${text.micro} ${styles.joker}`}>Joker played</span>
            ) : null}
          </div>
          <div className={styles.historyFacts}>
            {matchweek.result.kind === 'settled' ? (
              <span className={styles.historyPoints}>
                {formatNumber(matchweek.result.points)}
                <span className={`${text.micro} ${styles.historyUnit}`}> pts</span>
              </span>
            ) : (
              /* NOT "0 pts". See the header. */
              <span className={`${text.micro} ${styles.historyPending}`}>Not settled yet</span>
            )}
            <span className={`${text.micro} ${styles.historyPicks}`}>
              {formatNumber(matchweek.picks.length)}{' '}
              {matchweek.picks.length === 1 ? 'prediction' : 'predictions'}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
