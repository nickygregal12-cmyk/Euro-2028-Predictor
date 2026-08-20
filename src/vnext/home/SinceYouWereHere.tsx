import { useId } from 'react'
import type { SinceLastVisit } from '../models/home'
import { formatDayHeading, formatNumber } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { teamColourStyle } from '../foundations/teamColour'
import styles from './home.module.css'

export type SinceYouWereHereProps = {
  readonly since: SinceLastVisit | null | undefined
}

/**
 * SINCE YOU WERE LAST HERE — the football that happened while you were away.
 *
 * ============================ WHY IT IS AT THE TOP =======================
 *
 * A player who opens Home on a Monday has one question before any other: what
 * happened? Everything else on the page answers "what now" — the deadline, the
 * matchweek, the table — and answering "what now" first to somebody who has not
 * yet been told the weekend's results is the wrong order. It sits above the
 * body and below the ticker, which is where the recap belongs and nowhere else.
 *
 * ============================ IT SAYS WHAT HAPPENED, NOT WHAT IT MEANT ===
 *
 * Results and the reader's own call, and nothing further. What those results
 * DID — points banked, rank moved, exact scores hit — is a different question
 * answered from the player's own banked totals, and a points claim inside a
 * list of results that has no points in it is exactly the confusion this zone
 * has to avoid. The list is short and says how much it is not showing.
 *
 * ============================ AND IT DISAPPEARS ==========================
 *
 * `null` on a first visit and whenever nothing has finished since the marker,
 * which is most days. A zone that is present but empty would teach a player to
 * scroll past the one place that is worth reading on the day it matters.
 */
export function SinceYouWereHere({ since }: SinceYouWereHereProps) {
  const headingId = useId()

  if (!since || since.results.length === 0) return null

  return (
    <section
      className={styles.since}
      data-vnext-zone="since"
      aria-labelledby={headingId}
    >
      <div className={styles.sinceHead}>
        <h2 id={headingId} className={`${typography.label} ${styles.zoneTitle}`}>
          Since you were last here
        </h2>
        {since.more > 0 ? (
          <span className={typography.micro}>
            and {formatNumber(since.more)} more
          </span>
        ) : null}
      </div>

      <ul className={styles.sinceList}>
        {since.results.map((match) => (
          <li key={match.id}>
            <article
              className={styles.sinceRow}
              style={teamColourStyle(match.home.team)}
              /* ONE SENTENCE, BECAUSE A ROW READ COLUMN BY COLUMN IS NOISE.
                 The visible layout is a score line; read aloud it is the
                 sentence a person would say. */
              aria-label={[
                `${match.home.team.name} ${match.score?.home ?? ''}`,
                `${match.away.team.name} ${match.score?.away ?? ''}`,
                match.prediction
                  ? `your call ${match.prediction.score.home}–${match.prediction.score.away}`
                  : 'you did not predict this one',
                formatDayHeading(match.kickoff),
              ].join(', ')}
            >
              <span className={styles.sinceSpine} aria-hidden="true" />
              <div className={styles.sinceTeams} aria-hidden="true">
                {[match.home, match.away].map((side, index) => (
                  <div key={side.team.id} className={styles.sinceTeamRow}>
                    <span className={`${typography.body} ${typography.clamp2}`}>
                      {side.team.shortName}
                    </span>
                    <span className={`${styles.sinceGoals} ${typography.numeric}`}>
                      {match.score ? (index === 0 ? match.score.home : match.score.away) : '–'}
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.sinceCall} aria-hidden="true">
                {match.prediction ? (
                  <>
                    <span className={typography.label}>Your call</span>
                    <span className={`${styles.sinceCallScore} ${typography.numeric}`}>
                      {match.prediction.score.home}–{match.prediction.score.away}
                    </span>
                  </>
                ) : (
                  <span className={`${typography.micro} ${styles.sinceMissed}`}>
                    Not predicted
                  </span>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
