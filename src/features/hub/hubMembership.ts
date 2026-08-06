import type {
  HubSeasonMembership,
  HubSeasonStatus,
} from '../../services/supabase/competitionGames'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import type { HubCompetition, HubGame } from './competitionCatalogue'

/**
 * Overlay the server's membership truth onto the presentation catalogue.
 *
 * Pure so the rules are testable: given the catalogue and the C1b read's
 * result, produce the competitions the Hub may claim. A catalogue entry whose
 * season row the database did not return keeps its presentation copy and is
 * named in `unresolved` — the caller decides how loudly to say so. A game the
 * server did not list keeps its catalogue status and claims no membership.
 */
export function applyHubMembership(
  catalogue: readonly HubCompetition[],
  seasons: readonly HubSeasonMembership[],
): { competitions: HubCompetition[]; unresolved: string[] } {
  const bySeasonName = new Map(seasons.map((season) => [season.seasonName, season]))
  const unresolved: string[] = []

  const competitions = catalogue.map((entry) => {
    const season = bySeasonName.get(entry.seasonRowName)
    if (!season) {
      unresolved.push(entry.seasonRowName)
      return entry
    }

    return {
      ...entry,
      status: overlayStatus(entry.status, season.seasonStatus),
      games: entry.games.map((game) => overlayGame(game, season)),
    }
  })

  return { competitions, unresolved }
}

/**
 * `parked` is a product label (Euro returns in January 2028), not a lifecycle
 * read, so the database status never overrides it. Everything else follows the
 * season row: a season the server calls active is live regardless of what the
 * catalogue was written to expect.
 */
function overlayStatus(
  presentation: HubCompetition['status'],
  seasonStatus: HubSeasonStatus | null,
): HubCompetition['status'] {
  if (presentation === 'parked' || seasonStatus === null) return presentation
  switch (seasonStatus) {
    case 'active':
      return 'live'
    case 'complete':
    case 'archived':
      return 'ended'
    case 'draft':
    case 'scheduled':
      return 'upcoming'
  }
}

function overlayGame(game: HubGame, season: HubSeasonMembership): HubGame {
  const served = season.seasonGames.games.find((entry) => entry.gameKey === game.gameKey)
  if (!served) return { ...game, joined: false, status: game.status }

  const joined = isActiveMembership(served)
  return {
    ...game,
    joined,
    status: joined ? 'joined' : served.active ? 'available' : 'coming-soon',
  }
}
