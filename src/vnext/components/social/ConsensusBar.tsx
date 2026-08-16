import type { ConsensusGroup, Scoreline } from '../../models/football'
import { formatNumber, formatScoreline, formatShare } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import styles from './ConsensusBar.module.css'

export type ConsensusBarProps = {
  group: ConsensusGroup
  homeName: string
  awayName: string
  /** The user's own scoreline, so agreement or disagreement can be shown. */
  userScore?: Scoreline | null
}

/**
 * Where the crowd is, and whether the user is with it.
 *
 * The comparison is the point. A prediction game gets its tension from knowing
 * that 76% of everyone went the other way, so the popular scoreline the user
 * matched is marked "your call" and a scoreline nobody else picked is worth
 * seeing as a gap.
 *
 * The split bar is drawn with three labelled segments and a text summary
 * underneath. It is not a chart component and does not need one: three
 * percentages that add to 100 are a bar, and Recharts would be a heavier answer
 * to a lighter question.
 */
export function ConsensusBar({
  group,
  homeName,
  awayName,
  userScore = null,
}: ConsensusBarProps) {
  const { homeWinShare, drawShare, awayWinShare, popular, sampleSize, label } = group

  return (
    <div className={styles.consensus}>
      <div className={styles.head}>
        <span className={typography.label}>{label}</span>
        <span className={typography.micro}>
          {formatNumber(sampleSize)} predictions
        </span>
      </div>

      <div
        className={styles.bar}
        role="img"
        aria-label={`${label}: ${formatShare(homeWinShare)} ${homeName}, ${formatShare(
          drawShare,
        )} draw, ${formatShare(awayWinShare)} ${awayName}`}
      >
        <span
          className={`${styles.segment} ${styles.home}`}
          style={{ flexGrow: homeWinShare }}
        />
        <span
          className={`${styles.segment} ${styles.draw}`}
          style={{ flexGrow: drawShare }}
        />
        <span
          className={`${styles.segment} ${styles.away}`}
          style={{ flexGrow: awayWinShare }}
        />
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span className={typography.micro}>
          {formatShare(homeWinShare)} home
        </span>
        <span className={typography.micro}>{formatShare(drawShare)} draw</span>
        <span className={typography.micro}>
          {formatShare(awayWinShare)} away
        </span>
      </div>

      {popular.length > 0 ? (
        <ul className={styles.popular}>
          {popular.map((entry) => {
            const isUserScore =
              userScore !== null &&
              userScore.home === entry.score.home &&
              userScore.away === entry.score.away
            return (
              <li
                key={`${entry.score.home}-${entry.score.away}`}
                className={`${styles.popularItem} ${isUserScore ? styles.userMatch : ''}`}
              >
                <span className={typography.numeric}>
                  {formatScoreline(entry.score.home, entry.score.away)}
                </span>
                <span className={styles.popularShare}>
                  {formatShare(entry.share)}
                </span>
                {isUserScore ? (
                  <span className={styles.youTag}>your call</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
