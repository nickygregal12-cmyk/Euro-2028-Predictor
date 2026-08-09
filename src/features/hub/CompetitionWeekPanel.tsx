import { Link } from 'react-router'
import { Skeleton } from '../../design-system'
import { formatWeekDeadline, type CompetitionWeek, type WeekAction } from './competitionWeekModel'
import styles from './CompetitionWeekPanel.module.css'

/**
 * Overview's answer to "what do I need to do this week?" (`DFA-006`).
 *
 * A FAILED READ IS NOT AN EMPTY WEEK, and this panel will not render one as the
 * other. If a game's read fails, the panel says the week could not be assembled
 * rather than showing the remaining games as though they were the whole
 * picture — a summary that silently drops a game is worse than no summary,
 * because a player reads "nothing to do" and misses a lock.
 *
 * DEADLINES ARE FORMATTED IN THE COMPETITION'S OWN TIMEZONE, the same decision
 * `matchesModel` and contract 122 made: a Saturday 15:00 lock is Saturday to
 * everyone who follows that league. The 12-or-24-hour format stays the
 * viewer's, which is a reading preference rather than a fact about the round.
 */

export type CompetitionWeekPanelProps = {
  week: CompetitionWeek | null
  /** True while any game's read is still in flight. */
  loading: boolean
  /** Set when a game's read failed; the week is then not shown at all. */
  failed: boolean
  timeZone: string
}

function ActionRow({
  action,
  timeZone,
  primary,
}: {
  action: WeekAction
  timeZone: string
  primary: boolean
}) {
  const when = formatWeekDeadline(action, timeZone)
  const body = (
    <>
      <span className={styles.title}>{action.title}</span>
      {when ? <span className={styles.when}>{when}</span> : null}
    </>
  )

  // A joined game whose surface is not reachable is listed without a link,
  // exactly as Play lists it: hiding it would misreport membership and linking
  // it would be a dead link.
  return action.href ? (
    <Link className={primary ? styles.primary : styles.secondary} to={action.href}>
      {body}
    </Link>
  ) : (
    <div className={primary ? styles.primaryInert : styles.secondaryInert}>{body}</div>
  )
}

export function CompetitionWeekPanel({
  week,
  loading,
  failed,
  timeZone,
}: CompetitionWeekPanelProps) {
  if (loading) {
    return (
      <section className={styles.panel} aria-busy="true" aria-live="polite">
        <h2 className={styles.heading}>This week</h2>
        <span className={styles.srOnly}>Working out what needs doing</span>
        <Skeleton height={64} radius="card" />
      </section>
    )
  }

  if (failed) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>This week</h2>
        <p className={styles.note}>
          One of your games could not be read, so this would be an incomplete
          answer. Open the games below to see where each one stands.
        </p>
      </section>
    )
  }

  if (!week || week.empty) return null

  return (
    <section className={styles.panel} aria-labelledby="competition-week-heading">
      <h2 className={styles.heading} id="competition-week-heading">
        This week
      </h2>

      {week.primary ? (
        <ActionRow action={week.primary} timeZone={timeZone} primary />
      ) : (
        <p className={styles.note}>
          {week.allClear
            ? 'Nothing needs doing here right now.'
            : 'Nothing is outstanding in the games you have joined.'}
        </p>
      )}

      {week.secondary.length > 0 ? (
        <ul className={styles.list}>
          {week.secondary.map((action) => (
            <li key={action.kind}>
              <ActionRow action={action} timeZone={timeZone} primary={false} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
