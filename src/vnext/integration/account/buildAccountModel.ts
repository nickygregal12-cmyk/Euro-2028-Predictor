import type {
  AccountPageModel,
  FavouriteClub,
  FollowIdentity,
  FollowsPanel,
  HistoryPanel,
  PlayedSeason,
  SeasonResult,
} from '../../models/account'
import type { AccountSource } from './accountSource'

/**
 * `AccountSource` → `AccountPageModel`. PURE.
 *
 * WHAT IT MUST NOT DO, and each has a test that fails if it starts:
 *
 *   1. NAME A FOLLOW IT CANNOT NAME. Two reads can supply a name and neither
 *      is guaranteed to hold one. The uuid is never shown and never guessed
 *      from.
 *   2. BUILD A ROUTE. A slug is a server-owned identifier; contract 161 states
 *      its absence explicitly and contract 147 stores it. Nothing here derives
 *      one from a name.
 *   3. COMPUTE A RESULT. Points, rank and field size are contract 156's stored
 *      snapshot.
 *   4. REORDER ANYTHING. Both list reads order their own rows.
 */

/**
 * A NAME FOR A FOLLOW, from whichever read has one.
 *
 * The catalogue is preferred over the history for one reason: it is the read
 * that also carries a ROUTE. A season the player played but which is no longer
 * published can still be named from the history, and correctly arrives with no
 * route — which is the honest pairing, not a degraded one.
 */
function followIdentity(
  tournamentId: string,
  source: AccountSource,
): FollowIdentity {
  if (source.catalogue.kind === 'ok') {
    const listed = source.catalogue.seasons.find((season) => season.seasonId === tournamentId)
    if (listed !== undefined) {
      return {
        kind: 'named',
        competitionName: listed.competitionName,
        seasonName: listed.seasonName,
        route: { competitionSlug: listed.competitionSlug, seasonKey: listed.seasonKey },
      }
    }
  }

  if (source.history.kind === 'ok') {
    const played = source.history.history.seasons.find(
      (season) => season.tournamentId === tournamentId,
    )
    if (played !== undefined) {
      return {
        kind: 'named',
        // The history names the competition separately from the season, and
        // either can be absent. A season name always exists; a competition name
        // may not, and the season's own name is the better fallback than a uuid.
        competitionName: played.competitionName ?? played.seasonName,
        seasonName: played.seasonName,
        route: routeOf(played.competitionSlug, played.seasonKey),
      }
    }
  }

  // FOLLOWED, REAL, AND UNNAMEABLE. Neither read holds it. See the model.
  return { kind: 'unnamed' }
}

/**
 * BOTH HALVES OR NEITHER. An address needs a slug AND a season key, and a route
 * built from one of them would resolve to nothing. Contract 161 can supply
 * either as null.
 */
function routeOf(
  competitionSlug: string | null,
  seasonKey: string | null,
): { competitionSlug: string; seasonKey: string } | null {
  if (competitionSlug === null || seasonKey === null) return null
  return { competitionSlug, seasonKey }
}

function favouriteOf(favouriteTeamId: string | null): FavouriteClub {
  // THE FACT, NOT THE CLUB. Naming it is one read per follow; see the model.
  return favouriteTeamId === null ? { kind: 'none' } : { kind: 'set' }
}

function followsPanelOf(source: AccountSource): FollowsPanel {
  if (source.preferences.kind !== 'ok') return { kind: 'unavailable' }

  const follows = source.preferences.preferences.follows
  // EMPTY IS AN ANSWER. Contract 157's own decoder insists on the distinction
  // between following nothing and not having found out.
  if (follows.length === 0) return { kind: 'empty' }

  return {
    kind: 'follows',
    competitions: follows.map((follow) => ({
      tournamentId: follow.tournamentId,
      identity: followIdentity(follow.tournamentId, source),
      favourite: favouriteOf(follow.favouriteTeamId),
    })),
  }
}

function resultOf(
  final: { points: number; rank: number | null; fieldSize: number | null; matchweeksPlayed: number } | null,
): SeasonResult | null {
  if (final === null) return null
  return {
    points: final.points,
    rank: final.rank,
    fieldSize: final.fieldSize,
    matchweeksPlayed: final.matchweeksPlayed,
  }
}

function historyPanelOf(source: AccountSource): HistoryPanel {
  if (source.history.kind !== 'ok') return { kind: 'unavailable' }

  const page = source.history.history
  if (page.seasons.length === 0) return { kind: 'empty' }

  const seasons: PlayedSeason[] = page.seasons.map((season) => ({
    tournamentId: season.tournamentId,
    seasonName: season.seasonName,
    competitionName: season.competitionName,
    route: routeOf(season.competitionSlug, season.seasonKey),
    inPublishedCatalogue: season.inPublishedCatalogue,
    complete: season.complete,
    result: resultOf(season.final),
    // A GAME WITH NO NAME IS DROPPED, not rendered as a blank row. The read
    // allows a null name and a row saying nothing is worse than one row fewer.
    games: season.games.flatMap((game) =>
      game.gameName === null ? [] : [{ gameName: game.gameName, outcome: game.outcome }],
    ),
  }))

  return {
    kind: 'seasons',
    seasons,
    // THE SERVER'S OWN PAGING FACTS, carried rather than inferred from the
    // length of the array in hand.
    total: page.total,
    hasMore: page.hasMore,
  }
}

export function buildAccountModel(source: AccountSource): AccountPageModel {
  return {
    generatedAt: source.generatedAt,
    context: { displayName: source.displayName },
    follows: followsPanelOf(source),
    history: historyPanelOf(source),
  }
}
