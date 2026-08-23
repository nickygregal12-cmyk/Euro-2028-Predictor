import type { CompetitionTableAnswer } from '../../../features/season/useCompetitionTable'
import { formatCalendarDate } from '../../../shared/time/kickoff'
import type { MatchesLeagueTableState } from '../../matches/LeagueTablePanel'

/**
 * THE EXISTING COMPETITION TABLE, REDUCED FOR MATCHES.
 *
 * No football arithmetic occurs here. Position, played, goal difference and
 * points are all the server's values from `get_competition_table`; array order
 * is retained and no row is renumbered. Provenance is also the server's, which
 * lets Matches say that a table is provisional without guessing from the date.
 */
export function buildMatchesLeagueTable(
  answer: CompetitionTableAnswer,
): MatchesLeagueTableState {
  switch (answer.status) {
    case 'unavailable':
      return { kind: 'unavailable' }
    case 'loading':
      return { kind: 'loading' }
    case 'failed':
      return { kind: 'failed', retry: answer.retry }
    default: {
      const { table } = answer
      const counted = table.provenance.fixturesCounted
      const outstanding = table.provenance.fixturesOutstanding
      const seasonNotStarted = counted === 0 && table.rows.length === 0
      const statusLabel = seasonNotStarted
        ? outstanding > 0
          ? `${outstanding} fixtures scheduled · season not started`
          : 'Season has no settled league results yet'
        : outstanding > 0
          ? `Provisional · ${counted} results counted · ${outstanding} fixtures still to play`
          : `${counted} results counted · final table`
      const latestSettledDate = formatCalendarDate(table.provenance.lastResultAt)
      const provenanceLabel = latestSettledDate
        ? `Latest settled result: ${latestSettledDate}`
        : null

      return {
        kind: 'ready',
        rows: table.rows.map((row) => ({
          position: row.position,
          teamName: row.teamName,
          played: row.played,
          goalDifference: row.goalDifference,
          points: row.points,
        })),
        statusLabel,
        provenanceLabel,
        seasonNotStarted,
      }
    }
  }
}
