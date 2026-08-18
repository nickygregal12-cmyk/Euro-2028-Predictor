import type { RivalryDetail, RivalrySide } from '../models/playerProfile'
import { accuracyRate, pointsGapLabel, rivalryComparable } from '../models/playerProfile'
import { formatNumber, formatOrdinal, formatShare } from '../foundations/format'
import text from '../foundations/typography.module.css'
import styles from './playerProfile.module.css'

/**
 * HOW THE TWO OF YOU COMPARE, ACROSS THE SEASON.
 *
 * ============================ THE DENOMINATOR IS DRAWN FIRST =============
 *
 * "3-1" is not an answer. `matchweeksCompared` is stated at the top of this
 * panel because the record beneath it is meaningless without it, and because
 * `recent` is a TRUNCATED window — a reader counting the strip would get a
 * different number from the record and be right to distrust both.
 *
 * ============================ 0-0-0 IS NOT A DRAW ========================
 *
 * Before any matchweek has settled, revealed and banked for BOTH players there
 * is nothing to compare, and every figure in the payload is zero. `0-0-0, level
 * on points` is a sentence about two players who have never met. So the panel
 * asks `rivalryComparable` and says so instead. Nothing here divides by that
 * denominator either — `accuracyRate` refuses rather than returning 0%.
 *
 * ============================ ONE COLUMN IS ALWAYS "YOU" =================
 *
 * Which is the structural answer to the Stage 10 rule that two players sharing
 * a display name must never be confusable. The caller's column is labelled
 * "You" whatever they are called, so the two headings differ even when the two
 * names do not — and the rows are keyed by `playerRef`, never by name.
 *
 * ============================ IT COMPARES NOTHING ITSELF =================
 *
 * Every figure is the server's, computed over the same matchweeks for both
 * sides. This file does not subtract two totals, does not decide who won a
 * matchweek and does not re-sign the gap.
 */

export type RivalryTableProps = {
  readonly detail: RivalryDetail
}

export function RivalryTable({ detail }: RivalryTableProps) {
  // NAMED FROM THE PAYLOAD THAT PRODUCED THE COLUMNS, not from the page's
  // heading. They agree; this is the one that stays true if they ever do not.
  const theirName = detail.them.displayName

  if (!rivalryComparable(detail)) {
    return (
      <p className={`${text.body} ${styles.panelEmpty}`}>
        No matchweek has settled for both of you yet, so there is nothing to
        compare.
      </p>
    )
  }

  const compared = `${formatNumber(detail.matchweeksCompared)} ${
    detail.matchweeksCompared === 1 ? 'matchweek' : 'matchweeks'
  }`

  return (
    <div className={styles.rivalry} data-vnext-zone="rivalry">
      <p className={`${text.body} ${styles.rivalryHeadline}`}>
        <strong className={styles.rivalryRecord}>
          {formatNumber(detail.yourWins)}–{formatNumber(detail.draws)}–
          {formatNumber(detail.theirWins)}
        </strong>{' '}
        <span className={styles.rivalryRecordKey}>
          (you–drawn–{theirName}) over {compared} you have both played
        </span>
      </p>
      <p className={`${text.micro} ${styles.rivalryGap}`}>{pointsGapLabel(detail.pointsGap)}</p>

      <table className={styles.compare}>
        <caption className={styles.visuallyHidden}>
          Your season compared with {theirName}, over {compared}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.visuallyHidden}>Measure</span>
            </th>
            {/* "You" ALWAYS, so two identical display names still give two
                different column headings. See the header. */}
            <th scope="col">You</th>
            <th scope="col">{theirName}</th>
          </tr>
        </thead>
        <tbody>
          <CompareRow label="Season points" you={detail.you} them={detail.them} render={points} />
          <CompareRow label="Matchweeks played" you={detail.you} them={detail.them} render={played} />
          <CompareRow label="Position" you={detail.you} them={detail.them} render={standing} />
          <CompareRow label="Exact scores" you={detail.you} them={detail.them} render={exact} />
          <CompareRow label="Correct outcomes" you={detail.you} them={detail.them} render={outcomes} />
        </tbody>
      </table>

      <h4 className={`${text.micro} ${styles.recentHeading}`}>
        Recent matchweeks, most recent first
      </h4>
      <ul className={styles.recent}>
        {detail.recent.map((matchweek) => (
          <li key={matchweek.matchweekId} className={styles.recentItem}>
            <span className={`${text.micro} ${styles.recentLabel}`}>{matchweek.label}</span>
            <span className={styles.recentScore}>
              {formatNumber(matchweek.yourPoints)}–{formatNumber(matchweek.theirPoints)}
            </span>
            {/* THE WORD, NOT ONLY THE COLOUR. §31's rule: a state a reader can
                only get from a hue is a state some readers do not get. */}
            <span
              className={`${text.micro} ${styles.recentOutcome}`}
              data-outcome={matchweek.outcome}
            >
              {outcomeWord(matchweek.outcome, theirName)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function outcomeWord(outcome: 'you' | 'them' | 'level', theirName: string): string {
  if (outcome === 'you') return 'You won'
  if (outcome === 'them') return `${theirName} won`
  return 'Level'
}

type CompareRowProps = {
  readonly label: string
  readonly you: RivalrySide
  readonly them: RivalrySide
  readonly render: (side: RivalrySide) => string
}

function CompareRow({ label, you, them, render }: CompareRowProps) {
  return (
    <tr>
      <th scope="row" className={text.micro}>
        {label}
      </th>
      <td>{render(you)}</td>
      <td>{render(them)}</td>
    </tr>
  )
}

function points(side: RivalrySide): string {
  return formatNumber(side.points)
}

function played(side: RivalrySide): string {
  return formatNumber(side.matchweeksPlayed)
}

/** A rank and its field, or the honest absence of one. Never a zeroth place. */
function standing(side: RivalrySide): string {
  if (side.standing === null) return 'Not yet ranked'
  return `${formatOrdinal(side.standing.rank)} of ${formatNumber(side.standing.fieldSize)}`
}

/**
 * A COUNT AND ITS RATE, OR JUST THE SENTENCE THAT THERE IS NOTHING TO RATE.
 *
 * `accuracyRate` returns null on a zero denominator rather than 0, because "0%
 * exact" is an accusation against a player who has simply not predicted
 * anything yet.
 */
function exact(side: RivalrySide): string {
  const rate = accuracyRate(side.accuracy)
  const count = formatNumber(side.accuracy.exactScores)
  return rate === null ? '—' : `${count} (${formatShare(rate.exact)})`
}

function outcomes(side: RivalrySide): string {
  const rate = accuracyRate(side.accuracy)
  const count = formatNumber(side.accuracy.correctOutcomes)
  return rate === null ? '—' : `${count} (${formatShare(rate.outcome)})`
}
