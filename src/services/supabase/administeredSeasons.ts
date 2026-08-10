import { db } from './client'

/**
 * Every weekly season an administrator may work on — **including drafts**.
 *
 * WHY THIS IS NOT THE PUBLISHED CATALOGUE. Contract 147's
 * `get_published_weekly_seasons` excludes `draft` seasons, correctly: a draft
 * is set up and not open, and a player must not be able to walk into one. But
 * administration is precisely where a draft belongs — opening it is the
 * operator action contract 127 exists for — so an administration surface built
 * on the published catalogue can never show the season it is meant to open.
 * Measured: the C1b migration creates both league seasons as `draft` and
 * nothing in the repository moves them out, so that surface would have been
 * empty on a fresh database and on Production.
 *
 * IT NEEDS NO MIGRATION AND NO SLUG. `public.tournaments` is readable to
 * `authenticated` (`tournaments readable`, select `true`), which is enough for
 * everything an administrator addresses: the season id, its stored name, its
 * season key and its lifecycle. It deliberately does NOT carry a route slug,
 * because this list is not used to navigate anywhere — `competitions.slug`
 * stays revoked and contract 147 stays the only way a browser learns a URL.
 *
 * `kind = 'league_season'` is the whole filter, as everywhere else: Euro is
 * `kind = 'tournament'` and is excluded by its own stored kind, so the weekly
 * administration surface cannot reach it by accident.
 *
 * THE PAGE STILL CANNOT DO ANYTHING THE SERVER WOULD REFUSE. Every write on it
 * is a protected RPC that checks the caller itself; listing a season here
 * grants nothing.
 */

export type AdministeredSeason = {
  /** The season row id every season read and write is addressed by. */
  id: string
  /** "Premier League 2026/27", as stored. */
  name: string
  seasonKey: string
  /** Including `draft`, which is the point of this read. */
  status: 'draft' | 'scheduled' | 'active' | 'complete' | 'archived' | null
}

const STATUSES: readonly string[] = ['draft', 'scheduled', 'active', 'complete', 'archived']

type Row = {
  id: string
  name: string
  season_key: string | null
  status: string | null
}

export async function fetchAdministeredSeasons(): Promise<AdministeredSeason[]> {
  const { data, error } = await db
    .from('tournaments')
    .select('id, name, season_key, status')
    .eq('kind', 'league_season')
    .order('name')
  if (error) throw error

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    seasonKey: row.season_key ?? '',
    status: STATUSES.includes(row.status ?? '')
      ? (row.status as AdministeredSeason['status'])
      : null,
  }))
}
