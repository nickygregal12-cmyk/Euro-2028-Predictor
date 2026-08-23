import { db } from './client'

export type SeasonTeamId = {
  readonly teamId: string
  readonly name: string
}

/**
 * Canonical club ids for one league season.
 *
 * `public.teams` is intentionally browser-readable under its reviewed RLS
 * policy; contract 183 already uses this exact-name authority when a write needs
 * a team id. No identity/colour harvest is needed on this mutation path.
 */
export async function fetchSeasonTeamIds(tournamentId: string): Promise<SeasonTeamId[]> {
  const { data, error } = await db
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name')
  if (error) throw error
  return (data ?? []).flatMap((row) =>
    typeof row.id === 'string' && typeof row.name === 'string'
      ? [{ teamId: row.id, name: row.name }]
      : [],
  )
}
