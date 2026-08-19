// Hub membership read over the C1b game catalogue.
//
// Identity resolution is deliberately exact: the catalogue names the season
// rows the C1b migration itself created (`Premier League 2026/27`,
// `Scottish Premiership 2026/27`, plus the original `UEFA Euro 2028` row), so
// resolution is a lookup against migration-owned values, not a slug guess.
// `competitions.slug` is not browser-readable, and deriving it client-side
// from the season name would silently disagree with the server's rule.
//
// A season name the database does not hold resolves to nothing and is
// reported as such — the caller decides how to present an unresolved entry.
// A failed read throws; it must never be mistaken for "no memberships".

import { db } from './client'
import { decodeSeasonGames, type SeasonGames } from './competitionGamesModel'

export type HubSeasonStatus = 'draft' | 'scheduled' | 'active' | 'complete' | 'archived'

export type HubSeasonMembership = {
  seasonName: string
  tournamentId: string
  seasonStatus: HubSeasonStatus | null
  seasonGames: SeasonGames
}

const SEASON_STATUSES: readonly string[] = [
  'draft',
  'scheduled',
  'active',
  'complete',
  'archived',
]

type SeasonRow = { id: string; name: string; status: string | null }

/**
 * ONE SEASON'S GAME CATALOGUE, and the caller's membership in each.
 *
 * `fetchHubMembership` answers the same question for MANY seasons and is keyed
 * on season NAMES, because the Hub knows names and not ids. A surface already
 * holding a tournament id needs neither the name lookup nor the fan-out, and
 * running the many-season path for one season would issue a `tournaments` query
 * to rediscover an id it was handed.
 *
 * The decoder is the same one, so the shape rules cannot drift between them.
 */
export async function fetchSeasonGames(tournamentId: string): Promise<SeasonGames> {
  const { data, error } = await db.rpc('get_competition_games', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return decodeSeasonGames(data)
}

/**
 * Fetch the caller's real game membership for the named seasons.
 *
 * Returns one entry per season the database actually holds; names it does not
 * hold are simply absent from the result. Any query or RPC failure throws for
 * the whole read — partial truth dressed as the full picture is the exact
 * defect this read exists to remove.
 */
export async function fetchHubMembership(
  seasonNames: readonly string[],
): Promise<HubSeasonMembership[]> {
  if (seasonNames.length === 0) return []

  const { data, error } = await db
    .from('tournaments')
    .select('id, name, status')
    .in('name', [...seasonNames])
  if (error) throw error

  const rows = (data ?? []) as SeasonRow[]
  return Promise.all(
    rows.map(async (row) => {
      const result = await db.rpc('get_competition_games', {
        p_tournament_id: row.id,
      })
      if (result.error) throw result.error
      return {
        seasonName: row.name,
        tournamentId: row.id,
        seasonStatus: SEASON_STATUSES.includes(row.status ?? '')
          ? (row.status as HubSeasonStatus)
          : null,
        seasonGames: decodeSeasonGames(result.data),
      }
    }),
  )
}
