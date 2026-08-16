import type { Match } from '../../models/football'
import type { HomeModel } from '../../models/home'
import {
  formatCountdown,
  formatKickoffLabel,
  formatShare,
} from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { TeamKey } from './TeamKey'
import styles from './command.module.css'

export type CommandDecisionsProps = {
  model: HomeModel
  now: string
}

/**
 * The decision queue.
 *
 * NOT A FIXTURE LIST. A fixture list is ordered by kick-off; this is ordered by
 * how soon the user loses the ability to act, which is a different sort and the
 * whole reason the zone exists. Each row states the deadline, what the crowd
 * has done, and what the user has said — and then offers exactly one control.
 *
 * A row that is already answered stays in the queue rather than disappearing,
 * marked as answered. Removing it would make "3 of 5 in" a claim with nothing
 * behind it, and changing a submitted prediction before the lock is a real
 * thing a player does.
 */
export function CommandDecisions({ model, now }: CommandDecisionsProps) {
  const queue = [...model.upcomingMatches].sort(
    (left, right) => deadlineOf(left) - deadlineOf(right),
  )
  const progress = model.primaryAction.progress

  return (
    <div className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={`${typography.label} ${styles.panelTitle}`}>Open decisions</h2>
        {progress ? (
          <p className={typography.micro}>
            {progress.completed} of {progress.total} predictions in
          </p>
        ) : null}
      </header>

      <ol className={styles.queue}>
        {queue.map((match) => {
          const countdown = match.lockAt ? formatCountdown(match.lockAt, now) : null
          const answered = match.prediction !== null
          const crowd = match.consensus?.community ?? null

          return (
            <li
              key={match.id}
              className={`${styles.queueRow} ${answered ? styles.queueAnswered : styles.queueOpen}`}
            >
              <span className={styles.queueWhen}>
                <span className={`${typography.label} ${styles.queueWhenLabel}`}>
                  {answered ? 'Answered' : 'Needs you'}
                </span>
                <span className={`${styles.queueClock} ${typography.numeric}`}>
                  {countdown ? `${countdown} left` : 'Locked'}
                </span>
                <span className={typography.micro}>
                  {formatKickoffLabel(match.kickoff, now)}
                </span>
              </span>

              <span className={styles.queueFixture}>
                <span className={styles.queueTeams}>
                  <TeamKey team={match.home.team} />
                  <span className={styles.queueVersus} aria-hidden="true">
                    v
                  </span>
                  <TeamKey team={match.away.team} />
                </span>
                {crowd ? (
                  <span className={`${typography.micro} ${styles.queueCrowd}`}>
                    {crowdLine(match, crowd.homeWinShare, crowd.awayWinShare)}
                    {match.consensus?.friends
                      ? ` · ${match.consensus.friends.sampleSize} of your league have called it`
                      : ''}
                  </span>
                ) : null}
              </span>

              <span className={styles.queueCall}>
                {match.prediction ? (
                  <>
                    <span className={`${styles.queueCallScore} ${typography.numeric}`}>
                      {match.prediction.score.home}–{match.prediction.score.away}
                    </span>
                    <span className={`${typography.micro} ${styles.queueCallNote}`}>
                      {againstTheCrowd(match) ? 'Against the crowd' : 'With the crowd'}
                    </span>
                  </>
                ) : (
                  <span className={`${styles.queueCallScore} ${styles.queueCallEmpty}`}>
                    Not predicted
                  </span>
                )}
              </span>

              <button
                type="button"
                className={`${styles.queueAction} ${answered ? '' : styles.queueActionUrgent}`}
                aria-label={`${answered ? 'Change prediction' : 'Predict'} — ${
                  match.home.team.name
                } versus ${match.away.team.name}`}
              >
                {answered ? 'Change' : 'Predict'}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function deadlineOf(match: Match): number {
  return match.lockAt ? Date.parse(match.lockAt) : Number.MAX_SAFE_INTEGER
}

function crowdLine(match: Match, homeShare: number, awayShare: number): string {
  const homeLeads = homeShare >= awayShare
  return `${formatShare(homeLeads ? homeShare : awayShare)} on ${
    homeLeads ? match.home.team.shortName : match.away.team.shortName
  }`
}

/**
 * Whether the user's own result differs from the crowd's favourite. It compares
 * the RESULT rather than the scoreline, because "76% went the other way" is a
 * statement about who wins, and no scoring rule is being applied here.
 */
function againstTheCrowd(match: Match): boolean {
  const prediction = match.prediction
  const crowd = match.consensus?.community
  if (!prediction || !crowd) return false
  const crowdResult =
    crowd.homeWinShare >= crowd.drawShare && crowd.homeWinShare >= crowd.awayWinShare
      ? 'home'
      : crowd.awayWinShare >= crowd.drawShare
        ? 'away'
        : 'draw'
  const userResult =
    prediction.score.home === prediction.score.away
      ? 'draw'
      : prediction.score.home > prediction.score.away
        ? 'home'
        : 'away'
  return crowdResult !== userResult
}
