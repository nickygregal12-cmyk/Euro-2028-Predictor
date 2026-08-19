import type {
  CataloguePanel,
  DiscoverableSeason,
  DiscoveryPageModel,
  FollowKnowledge,
} from '../../models/discovery'
import type { DiscoverySource } from './discoverySource'

/**
 * `DiscoverySource` → `DiscoveryPageModel`. PURE.
 *
 * WHAT IT MUST NOT DO:
 *
 *   1. READ A FAILED PREFERENCES CALL AS "FOLLOWS NOTHING". That would offer
 *      Follow on every row, and a Follow against a competition the player
 *      already follows clears their favourite club — `set_competition_follow`
 *      is an upsert whose favourite argument defaults to null.
 *   2. BUILD A ROUTE. The slug is contract 147's, stored and never derived.
 *   3. REORDER THE CATALOGUE. The read orders its own seasons.
 */

function cataloguePanelOf(source: DiscoverySource): CataloguePanel {
  if (source.catalogue.kind !== 'ok') return { kind: 'unavailable' }

  const seasons = source.catalogue.seasons
  // A PLATFORM THAT PUBLISHES NOTHING is a real answer about the platform, and
  // a different one from a read that did not land.
  if (seasons.length === 0) return { kind: 'empty' }

  // The follow set, where it is known. A failed preferences read yields no set
  // at all rather than an empty one — see `followKnowledgeOf`.
  const followed =
    source.preferences.kind === 'ok'
      ? new Set(source.preferences.preferences.follows.map((follow) => follow.tournamentId))
      : null

  const rows: DiscoverableSeason[] = seasons.map((season) => ({
    tournamentId: season.seasonId,
    competitionName: season.competitionName,
    seasonName: season.seasonName,
    route: { competitionSlug: season.competitionSlug, seasonKey: season.seasonKey },
    status: season.status,
    // WITH THE SET UNKNOWN, EVERY ROW READS `not-following` — and the surface
    // is forbidden from acting on it by `followKnowledge`. The two together are
    // what stop an unknown state becoming an offer; neither is enough alone.
    follow: followed !== null && followed.has(season.seasonId) ? 'following' : 'not-following',
  }))

  return { kind: 'seasons', seasons: rows }
}

function followKnowledgeOf(source: DiscoverySource): FollowKnowledge {
  return source.preferences.kind === 'ok' ? 'known' : 'unknown'
}

export function buildDiscoveryModel(source: DiscoverySource): DiscoveryPageModel {
  return {
    generatedAt: source.generatedAt,
    catalogue: cataloguePanelOf(source),
    followKnowledge: followKnowledgeOf(source),
  }
}
