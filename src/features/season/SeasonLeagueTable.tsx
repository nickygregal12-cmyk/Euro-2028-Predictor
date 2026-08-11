import { useEffect, useState } from 'react'
import { Alert, Skeleton } from '../../design-system'
import type {
  CompetitionTable,
  CompetitionTableRow,
} from '../../services/supabase/competitionTableModel'
import {
  isProvisional,
  tieBreakerLabel,
} from '../../services/supabase/competitionTableModel'
import styles from './SeasonLeagueTable.module.css'

/**
 * The competition's own league table (contract 160, `MIG-UI-13`).
 *
 * WHAT THIS REPLACES: NOTHING, AND THAT WAS DELIBERATE. The Matches section
 * shipped Recent form and **no Table control at all**, because contract 141's
 * derivation is capped at twenty matches and knows none of the competition's
 * rules — and the register's own words were that a dead segment is worse than a
 * missing one. Contract 160 supplies the rules, so the segment can exist.
 *
 * EVERY NUMBER AND THE ORDER ARE THE SERVER'S. Points, position, tie-breaks,
 * deductions and the published boundaries are applied server-side under the
 * competition's stored rules. This renders rows in the order they arrive and
 * prints `position` rather than an index, so a competition whose tie-break
 * order changes does not need this component to change with it.
 *
 * A BOUNDARY IS DRAWN ONLY WHERE THE SERVER PUBLISHES ONE, and it is never
 * inferred from a club being top or bottom. A competition with no promotion
 * returns no promotion boundary, which is different from an unknown one.
 *
 * A DEDUCTION IS SHOWN BECAUSE IT EXPLAINS THE TABLE. It is already inside
 * `points`; printing it beside the total is what stops a club's position
 * looking like an error. It is only ever shown when the server sent one — there
 * is no zero case, because the server forbids a zero adjustment.
 *
 * IT SAYS WHEN IT IS INCOMPLETE. A table of a season with matches outstanding
 * is a real table of an incomplete season; provenance comes from the read and
 * is stated rather than left for the reader to assume the season is over.
 *
 * THE PHONE LAYOUT DROPS COLUMNS, NOT ROWS. Played, goal difference and points
 * survive at every width because they are what a table is for; won, drawn,
 * lost, and goals for and against appear when there is room. Nothing is
 * horizontally scrolled off the side of a phone unnoticed.
 */

export type SeasonLeagueTableProps = {
  /** Reads contract 160's table for this season. */
  read: () => Promise<CompetitionTable>
}

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; table: CompetitionTable }

export function SeasonLeagueTable({ read }: SeasonLeagueTableProps) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    read()
      .then((table) => {
        if (active) setState({ status: 'ready', table })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [read, nonce])

  if (state.status === 'loading') {
    return (
      <section className={styles.section} aria-busy="true">
        <h3 className={styles.heading}>Table</h3>
        <Skeleton width="100%" height={240} />
      </section>
    )
  }

  if (state.status === 'failed') {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>Table</h3>
        {/* Not an empty table. A table of nothing and a table we could not read
            are different, and only one of them is about the football. */}
        <Alert variant="warning" title="We could not load the table">
          <button type="button" className={styles.retry} onClick={() => setNonce((n) => n + 1)}>
            Try again
          </button>
        </Alert>
      </section>
    )
  }

  const { table } = state

  if (table.rows.length === 0) {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>Table</h3>
        <p className={styles.note}>
          No result has been settled in this competition yet, so there is no table to show.
        </p>
      </section>
    )
  }

  const anyAdjustment = table.rows.some((row) => row.adjustment !== null)

  return (
    <section className={styles.section} aria-labelledby="season-table-heading">
      <h3 className={styles.heading} id="season-table-heading">
        Table
      </h3>

      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            {table.season.name}
            {isProvisional(table)
              ? ` — ${table.provenance.fixturesCounted} of ${
                  table.provenance.fixturesCounted + table.provenance.fixturesOutstanding
                } matches played`
              : ' — final'}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.pos}>
                <abbr title="Position">#</abbr>
              </th>
              <th scope="col" className={styles.club}>
                Club
              </th>
              <th scope="col">
                <abbr title="Played">P</abbr>
              </th>
              <th scope="col" className={styles.wide}>
                <abbr title="Won">W</abbr>
              </th>
              <th scope="col" className={styles.wide}>
                <abbr title="Drawn">D</abbr>
              </th>
              <th scope="col" className={styles.wide}>
                <abbr title="Lost">L</abbr>
              </th>
              <th scope="col" className={styles.wide}>
                <abbr title="Goals for">GF</abbr>
              </th>
              <th scope="col" className={styles.wide}>
                <abbr title="Goals against">GA</abbr>
              </th>
              <th scope="col">
                <abbr title="Goal difference">GD</abbr>
              </th>
              <th scope="col" className={styles.pts}>
                <abbr title="Points">Pts</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <Row key={row.teamId} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {anyAdjustment ? (
        <ul className={styles.adjustments}>
          {table.rows
            .filter((row) => row.adjustment !== null)
            .map((row) => (
              <li key={row.teamId}>
                {row.teamName}: {row.adjustment! > 0 ? '+' : ''}
                {row.adjustment} {Math.abs(row.adjustment!) === 1 ? 'point' : 'points'}, already
                included above.
              </li>
            ))}
        </ul>
      ) : null}

      <Legend table={table} />
    </section>
  )
}

function Row({ row }: { row: CompetitionTableRow }) {
  const boundary = row.boundary ? styles[row.boundary] : undefined
  return (
    <tr className={boundary}>
      <td className={styles.pos}>{row.position}</td>
      <th scope="row" className={styles.club}>
        {row.teamName}
        {row.adjustment !== null ? (
          // `abbr` rather than a span with an `aria-label`: a span naming itself
          // with no role is a name assistive technology may ignore, and the
          // footnote below is the real explanation either way.
          <abbr className={styles.adjusted} title="Points adjustment applied">
            *
          </abbr>
        ) : null}
      </th>
      <td>{row.played}</td>
      <td className={styles.wide}>{row.won}</td>
      <td className={styles.wide}>{row.drawn}</td>
      <td className={styles.wide}>{row.lost}</td>
      <td className={styles.wide}>{row.goalsFor}</td>
      <td className={styles.wide}>{row.goalsAgainst}</td>
      {/* Signed and explicit: "+12" and "-3" both read as goal difference,
          where a bare 12 could be anything. */}
      <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
      <td className={styles.pts}>{row.points}</td>
    </tr>
  )
}

function Legend({ table }: { table: CompetitionTable }) {
  const boundaries = new Set(table.rows.map((row) => row.boundary).filter(Boolean))
  const showBoundaries = boundaries.size > 0

  return (
    <div className={styles.legend}>
      {showBoundaries ? (
        <ul className={styles.keys}>
          {boundaries.has('promotion') ? (
            <li>
              <span className={`${styles.swatch} ${styles.promotion}`} aria-hidden="true" />
              Promotion
            </li>
          ) : null}
          {boundaries.has('playoff') ? (
            <li>
              <span className={`${styles.swatch} ${styles.playoff}`} aria-hidden="true" />
              Play-offs
            </li>
          ) : null}
          {boundaries.has('relegation') ? (
            <li>
              <span className={`${styles.swatch} ${styles.relegation}`} aria-hidden="true" />
              Relegation
            </li>
          ) : null}
        </ul>
      ) : null}

      {table.rules.tieBreakers.length > 0 ? (
        <p className={styles.note}>
          Level clubs are separated by {table.rules.tieBreakers.map(tieBreakerLabel).join(', then ')}
          {table.rules.configured ? '' : ' — this competition has not published its own rules, so the standard order is used'}
          .
        </p>
      ) : null}
    </div>
  )
}
