import {
  competitionChampionshipInstanceRoute,
  competitionGameRoute,
  type CompetitionRouteRef,
} from '../weeklyRoutes'

/**
 * A private LMS is an INSTANCE of the season game, not the public season game.
 * The existing LMS path therefore carries the private container identity in a
 * query rather than pretending the public `get_season_lms_round` can resolve it.
 */
export function competitionPrivateLmsRoute(
  ref: CompetitionRouteRef,
  competitionId: string,
): string {
  const id = competitionId.trim()
  if (!id) throw new Error('A private Last Man Standing competition id is required.')
  return `${competitionGameRoute(ref, 'lms')}?competition=${encodeURIComponent(id)}`
}

/**
 * Resolve a just-joined private competition through caller-addressed discovery
 * and the published season catalogue. No route slug is derived from a name.
 *
 * Returns null when the caller cannot rediscover the container or the season is
 * not currently published; callers then keep their existing conservative
 * fallback instead of inventing an address.
 */
export async function resolvePrivateCompetitionHref(
  competitionId: string,
): Promise<string | null> {
  const [{ fetchMyPrivateCompetitions }, { fetchPublishedWeeklySeasons }] = await Promise.all([
    import('../../services/supabase/privateCompetitionDiscovery'),
    import('../../services/supabase/weeklyCatalogue'),
  ])

  const [mine, seasons] = await Promise.all([
    fetchMyPrivateCompetitions(),
    fetchPublishedWeeklySeasons(),
  ])
  const container = mine.competitions.find((entry) => entry.competitionId === competitionId)
  if (!container) return null
  const season = seasons.find((entry) => entry.seasonId === container.tournamentId)
  if (!season) return null

  const ref = {
    competitionSlug: season.competitionSlug,
    seasonSlug: season.seasonKey,
  }

  return container.gameKey === 'last_man_standing'
    ? competitionPrivateLmsRoute(ref, competitionId)
    : competitionChampionshipInstanceRoute(ref, competitionId)
}
