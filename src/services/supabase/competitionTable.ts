import { db } from './client'
import { mapCompetitionTable, type CompetitionTable } from './competitionTableModel'

/**
 * Query wrapper for contract 160's `get_competition_table`.
 *
 * THE ONLY LEAGUE TABLE IN THE PRODUCT, AND IT COMES FROM HERE. `MIG-UI-13`
 * recorded that a table is "not approximable in the browser" and why: it
 * carries the competition's own rules — points values, tie-break order,
 * deductions and published boundaries — and those belong to the competition
 * rather than to whoever is drawing it. Contract 160 stores them and applies
 * them; this module carries the call and the decode and nothing else.
 *
 * IT IS NOT `seasonClubForm`. Contract 141's derivation is capped at twenty
 * matches and knows no rules, which is why the Matches section shipped Recent
 * form and no Table control at all rather than a table that would have been
 * wrong in a way nobody could see.
 *
 * THE RPC REFUSES ANY COMPETITION THAT IS NOT A LEAGUE SEASON, by raising. That
 * is not re-checked here: a browser holding its own copy of which competitions
 * have a table is one that will disagree with the server the first time either
 * changes.
 */

export type {
  CompetitionTable,
  CompetitionTableBoundary,
  CompetitionTableProvenance,
  CompetitionTableRow,
  CompetitionTableRules,
  CompetitionTableSeason,
} from './competitionTableModel'
export { isProvisional, tieBreakerLabel } from './competitionTableModel'

export async function fetchCompetitionTable(tournamentId: string): Promise<CompetitionTable> {
  const { data, error } = await db.rpc('get_competition_table', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapCompetitionTable(data)
}
