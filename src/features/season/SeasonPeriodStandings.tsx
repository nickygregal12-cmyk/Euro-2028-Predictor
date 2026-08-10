import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import type { PeriodRowView, PeriodTableView } from './periodStandingsModel'
import type { SeasonPeriodStandingsGateway } from './periodStandingsModel'
import { formatMonth } from '../../shared/time/kickoff'
import { useSeasonPeriodStandings } from './useSeasonPeriodStandings'
import styles from './SeasonPeriodStandings.module.css'

/**
 * The two derived season tables ADR 0012 names: rolling form and the monthly
 * table (contract 122).
 *
 * IT SITS BENEATH THE CUMULATIVE TABLE AND SAYS WHY. The season is decided by
 * the overall standings and by nothing else; these are retention views over
 * the same settled matchweeks. Placing them above, or in their own section,
 * would give a monthly winner the visual weight of a season leader — so they
 * are secondary on the page and the sentence stating it is always rendered,
 * not only when a player might be confused.
 *
 * OPPONENTS ARE UNNAMED, AND THAT IS THE READ'S CONTRACT rather than a
 * limitation this component works around. Contract 122 returns no profile
 * join; the alternative — matching rows against the cumulative table — would
 * invent a correspondence the server never asserted. So a row is "You" or
 * "Entrant", exactly as the Championship phase table already renders.
 *
 * THE PERIOD SWITCH IS A RADIO GROUP, not two buttons that look like tabs. The
 * two views are mutually exclusive answers to one question, and a radio group
 * says that to a screen reader without the roving-tabindex machinery a real
 * tablist requires.
 *
 * NUMBERS ARE TABULAR (§11.4/§11.7 via --numeric), so a column does not
 * re-width as ranks and points change under it.
 */

export type SeasonPeriodStandingsProps = {
  gateway: SeasonPeriodStandingsGateway
}

const SKELETON_ROWS = 4

function Row({ row, pinned = false }: { row: PeriodRowView; pinned?: boolean }) {
  return (
    <li
      className={[styles.row, row.isYou ? styles.rowYou : '', pinned ? styles.rowPinned : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* One sentence for assistive technology; the cells below are visual. */}
      <span className={styles.srOnly}>{row.accessibleSummary}</span>
      <span className={styles.rank} aria-hidden="true">
        {row.rankLabel}
      </span>
      <span className={styles.name} aria-hidden="true">
        {row.label}
      </span>
      <span className={styles.played} aria-hidden="true">
        {row.matchweeksPlayed}
      </span>
      <span className={styles.points} aria-hidden="true">
        {row.points}
      </span>
    </li>
  )
}

function Table({ table }: { table: PeriodTableView }) {
  const heading = formatMonth(table.month)
  const shown = table.rows.length

  return (
    <div className={styles.table}>
      {heading ? <h4 className={styles.tableHeading}>{heading}</h4> : null}

      {table.yourLine ? <p className={styles.yourStanding}>{table.yourLine}</p> : null}

      {/* A truncated table never reads as a complete one. */}
      <p className={styles.caption}>
        {shown < table.totalCount
          ? `Top ${shown} of ${table.totalCount} ${table.totalCount === 1 ? 'player' : 'players'}.`
          : `${table.totalCount} ${table.totalCount === 1 ? 'player' : 'players'}.`}
      </p>

      <div className={styles.columns} aria-hidden="true">
        <span className={styles.rank}>#</span>
        <span className={styles.name}>Player</span>
        <span className={styles.played}>
          <abbr title="Matchweeks played">MW</abbr>
        </span>
        <span className={styles.points}>Pts</span>
      </div>

      <ul className={styles.list}>
        {table.rows.map((row) => (
          <Row key={row.key} row={row} />
        ))}
      </ul>

      {table.pinnedYou ? (
        <ul className={[styles.list, styles.pinnedList].join(' ')}>
          <Row row={table.pinnedYou} pinned />
        </ul>
      ) : null}
    </div>
  )
}

export function SeasonPeriodStandings({ gateway }: SeasonPeriodStandingsProps) {
  const { status, period, view, error, setPeriod, reload } = useSeasonPeriodStandings(gateway)

  const heading = <h3 className={styles.heading}>Form and months</h3>

  const chooser = (
    <fieldset className={styles.chooser}>
      <legend className={styles.srOnly}>Which view of the settled matchweeks</legend>
      {(
        [
          { id: 'form', label: 'Recent form' },
          { id: 'month', label: 'By month' },
        ] as const
      ).map((option) => (
        <label key={option.id} className={styles.choice}>
          <input
            className={styles.srOnly}
            type="radio"
            name="season-period"
            value={option.id}
            checked={period === option.id}
            onChange={() => setPeriod(option.id)}
          />
          <span className={styles.choiceLabel}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  )

  if (status === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        {heading}
        {chooser}
        <ul className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className={styles.row}>
              <Skeleton width="100%" height={40} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  // A failed read is a failure. The monthly table in particular raises when a
  // settled matchweek has no play window, and the operator can act on that;
  // showing "no months yet" instead would discard the whole point of the guard.
  if (status === 'failed' || !view) {
    return (
      <section className={styles.panel}>
        {heading}
        {chooser}
        <Alert variant="error" title="We could not load this view">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      {heading}
      <p className={styles.note}>{view.derivedNote}</p>
      {chooser}

      {view.empty ? (
        <EmptyState
          title="Nothing settled yet"
          description={
            view.period === 'form'
              ? 'Recent form appears once matchweeks start settling. Confirmed results decide it — provisional scores never do.'
              : 'A month appears once one of its matchweeks has settled.'
          }
        />
      ) : (
        <>
          {view.period === 'form' && view.window ? (
            <p className={styles.caption}>
              The last {view.window} {view.window === 1 ? 'matchweek' : 'matchweeks'} each player
              settled — not the season&rsquo;s last {view.window}, so a missed matchweek does not
              count as a blank.
            </p>
          ) : null}
          {view.tables.map((table) => (
            <Table key={table.month ?? 'form'} table={table} />
          ))}
        </>
      )}
    </section>
  )
}
