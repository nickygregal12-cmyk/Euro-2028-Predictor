import { useId } from 'react'
import { motion } from 'framer-motion'
import type { SeasonWrappedModel, SeasonWrappedResult } from '../models/wrapped'
import { wrappedIsEmpty } from '../models/wrapped'
import { formatDayHeading, formatNumber, formatOrdinal, formatShare } from '../foundations/format'
import { VNextTrophyIcon } from '../foundations/VNextIcon'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { StatTile } from '../components/game/StatTile'
import { useFeedbackOnLatch } from '../foundations/feedbackContext'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './wrapped.module.css'

export type VNextSeasonWrappedProps = {
  readonly model: SeasonWrappedModel
  /** Ask the host to read again. Offered beside a read that did not answer. */
  readonly onRetry?: (() => void) | undefined
}

/**
 * vNEXT SEASON WRAPPED — the season you played, once it is over.
 *
 * ============================ WHAT IT IS FOR =============================
 *
 * A season is thirty-eight matchweeks long and a player experiences it as a
 * fortnight at a time. This is the one surface that says what the whole of it
 * added up to — how many you got exactly right, the week you were unstoppable,
 * where you finished — and it is the only place in the product where the answer
 * is FINAL rather than moving.
 *
 * ============================ EVERY FIGURE IS THE ARCHIVE'S ==============
 *
 * Contract 156 writes `season_wrapped` once, when the season ends, and a
 * trigger makes it immutable. Nothing on this page is derived from anything
 * else on it: not the points, not the rank, not the field size, and not a
 * percentile — a percentile computed here from a rank and a field size would be
 * a number the archive never agreed to, and it would change the day somebody
 * changed the formula. The two accuracy percentages are the exception the
 * contract itself sanctions, and they arrive already divided.
 *
 * ============================ THREE ANSWERS, ALL OF THEM REAL ============
 *
 * A season still running has no Wrapped and says so. A season that has ended
 * but whose archive row has not been written says THAT, which is a different
 * sentence. And a read that did not answer is an apology with a way to try
 * again — never a page of zeros, because a season showing "0 points, rank 0" is
 * a lie about a season the player may currently be winning.
 *
 * ============================ AND IT IS ONLY EVER YOURS ==================
 *
 * `get_season_wrapped` resolves the caller from `auth.uid()` and takes no
 * parameter for whose Wrapped to read, so this surface is unshareable by
 * construction. There is nothing to link to somebody else and no disclosure
 * decision being taken here.
 */
export function VNextSeasonWrapped({ model, onRetry }: VNextSeasonWrappedProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context, body } = model

  return (
    <VNextShell
      /*
       * NO DESTINATION IS SELECTED, exactly as About and Account render.
       * A finished season belongs to none of the four: it is not this week's
       * football, not a game you can play and not a table that can still move.
       * Lighting one of them would say a player was somewhere they are not.
       */
      destination="none"
      header={
        <VNextPageHeader
          title="Your season"
          competition={
            context.seasonLabel
              ? `${context.competitionName} · ${context.seasonLabel}`
              : context.competitionName
          }
          {...(context.playerName ? { context: context.playerName } : {})}
        />
      }
    >
      <motion.div
        className={styles.page}
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        {body.kind === 'wrapped' ? (
          <WrappedResult result={body.result} context={context} />
        ) : body.kind === 'pending' ? (
          <Notice
            title="This season is still going"
            body="Your Wrapped is written once the season finishes. Until then, the standings are where your season lives."
          />
        ) : (
          <Notice
            title="We could not read your season"
            body="Nothing has been lost — the archive is written once and does not change. Try again in a moment."
            {...(onRetry ? { onRetry } : {})}
          />
        )}
      </motion.div>
    </VNextShell>
  )
}

/**
 * A sentence and, where there is anything to do about it, one control.
 *
 * The two states this covers are NOT the same and never share a sentence:
 * "still going" is an answer to a fair question, and "could not read" is an
 * apology. Only the second offers a retry, because there is nothing to retry
 * about a season that has not ended.
 */
function Notice({
  title,
  body,
  onRetry,
}: {
  readonly title: string
  readonly body: string
  readonly onRetry?: (() => void) | undefined
}) {
  return (
    <section className={styles.notice} data-vnext-zone="notice">
      <h2 className={`${text.title} ${styles.noticeTitle}`}>{title}</h2>
      <p className={`${text.body} ${styles.noticeBody}`}>{body}</p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  )
}

function WrappedResult({
  result,
  context,
}: {
  readonly result: SeasonWrappedResult
  readonly context: SeasonWrappedModel['context']
}) {
  const headingId = useId()
  const arrive = useVNextMotion(vnextMotion.achievementArrive)
  const { season, accuracy, best } = result
  const ranked = season.rank !== null && season.fieldSize !== null
  const empty = wrappedIsEmpty(result)

  /*
   * THE ONE CELEBRATION, ON THE ONE SURFACE THAT IS ABOUT AN ENDING.
   *
   * It fires on the EDGE into a finished Wrapped, so a player who opens the
   * page a second time gets the same trophy with no beat — the achievement is a
   * fact and the motion is only how it arrived. A season nobody played gets
   * nothing: there is no achievement to mark.
   */
  useFeedbackOnLatch(!empty, 'important')

  return (
    <section className={styles.result} aria-labelledby={headingId}>
      <header className={styles.hero} data-vnext-zone="hero">
        {empty ? null : (
          <motion.span
            className={styles.heroMark}
            variants={arrive}
            initial="rest"
            animate="earned"
            aria-hidden="true"
          >
            <VNextTrophyIcon />
          </motion.span>
        )}
        <h2 id={headingId} className={`${text.display} ${styles.heroTitle}`}>
          {context.seasonLabel} is done
        </h2>
        <p className={`${text.body} ${styles.heroBody}`}>
          {empty
            ? 'You were in this season but never put a scoreline in, so there is nothing to look back on. The next one starts from nothing for everybody.'
            : `${formatNumber(season.matchweeksPlayed)} ${season.matchweeksPlayed === 1 ? 'matchweek' : 'matchweeks'} played in ${context.competitionName}.`}
        </p>
      </header>

      {empty ? null : (
        <div className={styles.tiles} data-vnext-zone="totals">
          <StatTile
            label="Points"
            value={formatNumber(season.points)}
            meta="all season"
            tone="accent"
          />
          {/* A RANK THE ARCHIVE DID NOT STATE IS OMITTED. Not "unranked", not
              zero — the tile simply is not there. */}
          {ranked ? (
            <StatTile
              label="Finished"
              value={formatOrdinal(season.rank as number)}
              meta={`of ${formatNumber(season.fieldSize as number)}`}
            />
          ) : null}
          <StatTile
            label="Exact scores"
            value={formatNumber(accuracy.exactScores)}
            meta={
              accuracy.exactShare === null
                ? undefined
                : `${formatShare(accuracy.exactShare)} of your calls`
            }
          />
          <StatTile
            label="Right result"
            value={formatNumber(accuracy.correctOutcomes)}
            meta={
              accuracy.correctShare === null
                ? undefined
                : `${formatShare(accuracy.correctShare)} of your calls`
            }
          />
        </div>
      )}

      {best === null ? null : (
        <div className={styles.best} data-vnext-zone="best">
          <p className={`${text.label} ${styles.bestLabel}`}>Your best matchweek</p>
          <p className={styles.bestLine}>
            <span className={`${text.display} ${text.numeric} ${styles.bestPoints}`}>
              {formatNumber(best.points)}
            </span>
            <span className={text.body}>
              points in Matchweek {formatNumber(best.ordinal)}
            </span>
          </p>
        </div>
      )}

      <dl className={styles.footnotes} data-vnext-zone="footnotes">
        {empty ? null : (
          <div className={styles.footnote}>
            <dt className={text.label}>Predictions made</dt>
            <dd className={`${text.body} ${text.numeric}`}>
              {formatNumber(accuracy.fixturesPredicted)}
            </dd>
          </div>
        )}
        <div className={styles.footnote}>
          <dt className={text.label}>Jokers played</dt>
          <dd className={`${text.body} ${text.numeric}`}>
            {formatNumber(result.jokersPlayed)}
          </dd>
        </div>
        {result.finalisedAt === null ? null : (
          <div className={styles.footnote}>
            <dt className={text.label}>Archived</dt>
            <dd className={text.body}>{formatDayHeading(result.finalisedAt)}</dd>
          </div>
        )}
      </dl>

      {/* THE SENTENCE THAT MAKES THE PAGE HONEST, and it is not fine print.
          A player looking at a final table needs to know it cannot move any
          more — that is the difference between this page and the standings. */}
      <p className={`${text.micro} ${styles.sealed}`}>
        This is the season as it was recorded when it ended. It does not change.
      </p>
    </section>
  )
}
