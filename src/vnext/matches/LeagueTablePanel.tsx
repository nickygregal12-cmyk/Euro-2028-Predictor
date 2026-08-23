import text from '../foundations/typography.module.css'
import styles from './LeagueTablePanel.module.css'

/**
 * THE TABLE MATCHES MAY SHOW, ALREADY DECIDED BY THE SERVER.
 *
 * This is deliberately a presentation shape rather than the Supabase table
 * model. `src/vnext` does not acquire data and it does not know an RPC exists;
 * the integration mapper below hands it exactly the authoritative fields the
 * page needs. No row is sorted, renumbered or recalculated here.
 */
export type MatchesLeagueTableState =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly retry: () => void }
  | {
      readonly kind: 'ready'
      readonly rows: readonly {
        readonly position: number
        readonly teamName: string
        readonly played: number
        readonly goalDifference: number
        readonly points: number
      }[]
      readonly statusLabel: string
      readonly provenanceLabel: string | null
      readonly seasonNotStarted: boolean
    }

export function LeagueTablePanel({ table }: { readonly table: MatchesLeagueTableState }) {
  if (table.kind === 'unavailable') return null

  return (
    <aside
      className={styles.tablePanel}
      aria-label="League table context"
      data-vnext-league-table={table.kind}
    >
      {/* Phone: table context is available without occupying the fixture-first
          default view. Native details gives keyboard activation and an honest
          expanded state without inventing a disclosure primitive. */}
      <details className={styles.tableDisclosure}>
        <summary className={styles.tableSummary}>League table</summary>
        <TableContents table={table} />
      </details>

      {/* Desktop: the shell already gives Matches a secondary column. Spending
          that otherwise-empty width on the same answer improves context without
          moving the table above the football. CSS shows exactly one copy. */}
      <section className={styles.tableDesktop} aria-labelledby="matches-league-table-title">
        <div className={styles.tableHeader}>
          <h2 id="matches-league-table-title" className={text.label}>League table</h2>
        </div>
        <TableContents table={table} />
      </section>
    </aside>
  )
}

function TableContents({ table }: { readonly table: MatchesLeagueTableState }) {
  if (table.kind === 'loading') {
    return <p className={`${styles.tableNotice} ${text.caption}`}>Loading league table…</p>
  }

  if (table.kind === 'failed') {
    return (
      <div className={styles.tableNotice}>
        <p className={text.caption}>League table could not be loaded.</p>
        <button type="button" className={styles.tableRetry} onClick={table.retry}>
          Try again
        </button>
      </div>
    )
  }

  if (table.kind !== 'ready') return null

  if (table.seasonNotStarted) {
    return (
      <div className={styles.tableNotice}>
        <p className={text.caption}>The league table will appear after the first settled result.</p>
        <p className={text.micro}>{table.statusLabel}</p>
      </div>
    )
  }

  return (
    <div className={styles.tableContent}>
      <div className={styles.tableScroll}>
        <table className={styles.leagueTable}>
          <thead>
            <tr>
              <th scope="col">Pos</th>
              <th scope="col">Club</th>
              <th scope="col" title="Played">P</th>
              <th scope="col" title="Goal difference">GD</th>
              <th scope="col" title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.position}-${row.teamName}`}>
                <td className={text.numeric}>{row.position}</td>
                <th scope="row">{row.teamName}</th>
                <td className={text.numeric}>{row.played}</td>
                <td className={text.numeric}>{signed(row.goalDifference)}</td>
                <td className={`${styles.tablePoints} ${text.numeric}`}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`${styles.tableStatus} ${text.micro}`}>{table.statusLabel}</p>
      {table.provenanceLabel ? (
        <p className={`${styles.tableProvenance} ${text.micro}`}>{table.provenanceLabel}</p>
      ) : null}
    </div>
  )
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
