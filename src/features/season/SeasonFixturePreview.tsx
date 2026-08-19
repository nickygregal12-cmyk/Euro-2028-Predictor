import { useId } from 'react'
import { Alert, Button, Skeleton } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import { previewFixtures, type FixturePreviewRow } from './fixtureListModel'
import {
  useSeasonFixtureWindow,
  type SeasonFixtureWindowGateway,
} from './useSeasonFixtureWindow'
import styles from './SeasonFixturePreview.module.css'

/**
 * A few of a competition's fixtures, for Overview.
 *
 * §7.3 gives Overview one job — what is due, before what exists — and until now
 * it answered only half of it. `CompetitionWeekPanel` says what each GAME is
 * asking of the player; nothing said what the COMPETITION is actually playing,
 * so a player following a season saw an entry deadline with no football behind
 * it, and a player who had joined no game here saw an empty page.
 *
 * IT IS THE SAME READ AND THE SAME MODEL AS THE MATCHES SECTION. Contract 139's
 * window, `presentFixtureList`, then `previewFixtures` to take a handful. A
 * second read shaped for Overview would be a second answer to "when is this
 * played", and the by-round view was retired for being exactly that.
 *
 * THERE IS NO STEPPER HERE, deliberately. Stepping is the Matches section's
 * job and duplicating it would make Overview a worse copy of it; this shows the
 * next few and links to the section that shows the season. It loads the
 * server's own default window for the same reason the Matches route does — the
 * browser holds no opinion about where "now" starts.
 *
 * A PROVISIONAL SCORE IS STILL NEVER A RESULT. The rows come from the same
 * model, so the confirmation gate is honoured here by construction rather than
 * by a second copy of the rule.
 */

export type SeasonFixturePreviewProps = {
  gateway: SeasonFixtureWindowGateway
  /**
   * A deterministic zone override for harnesses and tests. Production omits it
   * and the shared kickoff authority resolves the viewer's own zone.
   */
  timeZone?: string
  /** Opens the full Matches section. */
  onSeeAll: () => void
  /** How many rows to show. Overview's card, not a rule. */
  limit?: number | undefined
}

const DEFAULT_LIMIT = 4

function PreviewRow({ row }: { row: FixturePreviewRow }) {
  return (
    <li className={styles.match}>
      <span className={styles.srOnly}>
        {row.dayLabel}. {row.accessibleSummary}
      </span>
      <span className={styles.when} aria-hidden="true">
        {row.dayLabel}
      </span>
      <span className={styles.fixture} aria-hidden="true">
        <span className={styles.home}>
          <span className={styles.clubName}>{row.home.name}</span>
          <ClubIdentity name={row.home.name} tokens={row.home.tokens} size="table" />
        </span>
        <span className={row.played ? styles.score : styles.kickoff}>
          {row.score ?? row.provisional ?? row.kickoff ?? '—'}
        </span>
        <span className={styles.away}>
          <ClubIdentity name={row.away.name} tokens={row.away.tokens} size="table" />
          <span className={styles.clubName}>{row.away.name}</span>
        </span>
      </span>
      {/* Contract 209. Same rule as the full list, and deliberately the same
          words: a fixture must not describe itself one way on Overview and
          another in Matches. */}
      {row.roundLabel || row.provisional || row.abnormal || row.scheduleNote ? (
        <span className={styles.rowMeta} aria-hidden="true">
          {row.roundLabel ? <span className={styles.tag}>{row.roundLabel}</span> : null}
          {row.provisional ? <span className={styles.provisional}>Provisional</span> : null}
          {row.abnormal ? (
            <span className={styles.abnormal}>
              {row.abnormal}
              {row.scheduleNote ? ` · ${row.scheduleNote}` : ''}
            </span>
          ) : row.scheduleNote ? (
            <span className={styles.abnormal}>{row.scheduleNote}</span>
          ) : null}
        </span>
      ) : null}
    </li>
  )
}

export function SeasonFixturePreview({
  gateway,
  timeZone,
  onSeeAll,
  limit = DEFAULT_LIMIT,
}: SeasonFixturePreviewProps) {
  const { status, view, error, reload } = useSeasonFixtureWindow(gateway, timeZone)
  // Generated, not written. A fixed id makes the component unusable twice on
  // one page — which the component gallery does immediately, rendering both
  // theme panels at once, and axe called it a critical duplicate-id-aria.
  const headingId = useId()

  if (status === 'loading') {
    return (
      <section className={styles.card} aria-busy="true" aria-labelledby={headingId}>
        <h3 className={styles.heading} id={headingId}>
          Fixtures
        </h3>
        <Skeleton lines={3} />
      </section>
    )
  }

  if (status === 'failed' || !view) {
    return (
      <section className={styles.card} aria-labelledby={headingId}>
        <h3 className={styles.heading} id={headingId}>
          Fixtures
        </h3>
        {/* Failed is not empty. "No fixtures" would tell a player the season is
            not playing this week, which is a different and wrong thing. */}
        <Alert variant="warning" title="These fixtures could not be loaded">
          {error}
          <div className={styles.retry}>
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          </div>
        </Alert>
      </section>
    )
  }

  const preview = previewFixtures(view, limit)

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 className={styles.heading} id={headingId}>
          {/* Named for what the rows are. A "Next up" heading over a list of
              finished matches is the kind of small lie that costs trust. */}
          {preview.kind === 'results' ? 'Latest results' : 'Next up'}
        </h3>
        {preview.hidden > 0 ? (
          <span className={styles.more}>+{preview.hidden} more</span>
        ) : null}
      </div>

      {preview.empty ? (
        <p className={styles.none}>
          Nothing is scheduled in the next fortnight. The Matches section holds the
          rest of the season.
        </p>
      ) : (
        <ul className={styles.list}>
          {preview.rows.map((row) => (
            <PreviewRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Button variant="secondary" fullWidth onClick={onSeeAll}>
        All fixtures and results
      </Button>
    </section>
  )
}
