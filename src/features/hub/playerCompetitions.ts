import type { CompetitionGame, CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import type { HubSeasonMembership } from '../../services/supabase/competitionGames'
import type { HubCompetition } from './competitionCatalogue'

/**
 * Which competitions matter to this player, and why.
 *
 * THE THREE CHOICES ARE SEPARATE AND STAY SEPARATE. The 10 August 2026
 * navigation authority makes this a binding constraint, so it is modelled in
 * the type system rather than promised in a comment:
 *
 * - **Follow** — "I want this competition's football, fixtures and context."
 *   Controls personalisation and what global surfaces default to. Joins nothing.
 * - **Join game** — "I play this game in this competition." Independent per
 *   game and per competition, and owned by the server.
 * - **Favourite** — presentation prominence only. Never touches membership,
 *   scoring, locks, permissions, ranking or urgency.
 *
 * No field here may be derived from another. `followed` is not "has a
 * membership" and `favourite` is not "followed"; collapsing any two would be
 * the exact simplification the authority forbids.
 *
 * FOLLOW IS NOT READ HERE YET, and this model says so rather than inventing an
 * answer. Contract 157 (`MIG-UI-10`) added the persistence on 11 August 2026 and
 * nothing consumes it, so `followed` is `'unknown'` for every competition today
 * and `relevanceSource` reports which question actually answered. The value is
 * `'unknown'` rather than `false` because "we have not asked" and "they have
 * not" would send a player to a different screen.
 *
 * WHAT THE UI USES IN THE MEANTIME is game membership, which IS a server
 * authority and IS durable: a player who has joined a game in a competition is
 * unarguably relevant to it. That is a **fallback for an absent Follow read**,
 * not a definition of Follow, and it is deliberately narrower — a player who
 * follows a competition without joining a game is invisible to it, which is a
 * missing feature rather than a wrong answer.
 *
 * IT IS BUILT FOR TWENTY COMPETITIONS, NOT TWO. The shortcut list is bounded
 * and the remainder is a count, so a platform holding twenty published
 * competitions where the player is relevant to three renders as a
 * three-competition product. Nothing here indexes, orders or special-cases the
 * two launch competitions.
 *
 * WHICH SEASONS EXIST IS THE SERVER'S ANSWER, IN FULL (contract 147, closing
 * `MIG-UI-12`). The catalogue handed in here is built by
 * `catalogueFromPublishedSeasons` from `get_published_weekly_seasons`, which
 * returns each season's ROUTE SLUG alongside its identity. There is no static
 * competition array left and therefore no such thing as a published season the
 * frontend can see and cannot open: the `unroutable` list this model used to
 * carry described exactly that gap and has been retired with it.
 *
 * PURE. Catalogue and membership in, presentation model out; no clock, no
 * network, no storage.
 */

export type CompetitionRelevance = {
  competition: HubCompetition
  /** The season row id every season read is addressed by, when resolved. */
  tournamentId: string | null
  /**
   * Whether the player has FOLLOWED this competition.
   *
   * `'unknown'` everywhere today: no persistence authority exists. It is not
   * `false`, because "we do not know" and "they have not" would send a
   * different player to a different screen.
   */
  followed: boolean | 'unknown'
  /** Presentation prominence only. `'unknown'` for the same reason. */
  favourite: boolean | 'unknown'
  /** The games the player has actually joined here. The server's answer. */
  joinedGames: readonly CompetitionGameKey[]
  /** Every game the competition runs, with its membership row. */
  games: readonly CompetitionGame[]
}

export type PlayerCompetitions = {
  /**
   * The competitions this player is relevant to, most relevant first. Global
   * surfaces default to these and never to the whole catalogue.
   */
  mine: readonly CompetitionRelevance[]
  /** The bounded few that appear as direct navigation shortcuts. */
  shortcuts: readonly CompetitionRelevance[]
  /** How many of `mine` the shortcut list did not show. */
  overflow: number
  /**
   * Every published season the frontend can open, for deliberate exploration.
   * Never navigation.
   */
  catalogue: readonly HubCompetition[]
  /**
   * Which question produced `mine`. `follow` once a Follow authority exists;
   * `game-membership` while it does not, so a surface can say what it is
   * showing instead of implying the player chose it.
   */
  relevanceSource: 'follow' | 'game-membership'
  /** True when the player is relevant to nothing — a real state, not a failure. */
  empty: boolean
}

/**
 * How many competition shortcuts the navigation rail may show at once.
 *
 * The authority says "roughly 4–6, then All competitions". Six, because the
 * cost of the sixth row is small and the cost of hiding a competition the
 * player plays in is a navigation dead end. The list is bounded at all is the
 * point; the exact number is a presentation decision recorded here once.
 */
export const COMPETITION_SHORTCUT_LIMIT = 6

function joinedKeysOf(games: readonly CompetitionGame[]): CompetitionGameKey[] {
  return games.filter((game) => isActiveMembership(game)).map((game) => game.gameKey)
}

/**
 * Order within `mine`. Deliberately NOT alphabetical and NOT the catalogue's
 * declaration order, both of which would make "your competitions" a function of
 * how the platform happens to list itself.
 *
 * Most joined games first, because a competition a player plays two games in is
 * more theirs than one they play a single game in; then the catalogue's order
 * as a stable tie-break, so the list does not reshuffle between renders.
 */
function byRelevance(
  left: CompetitionRelevance,
  right: CompetitionRelevance,
  order: ReadonlyMap<string, number>,
): number {
  if (left.joinedGames.length !== right.joinedGames.length) {
    return right.joinedGames.length - left.joinedGames.length
  }
  return (
    (order.get(left.competition.seasonRowName) ?? 0) -
    (order.get(right.competition.seasonRowName) ?? 0)
  )
}

export function presentPlayerCompetitions(
  /**
   * The published catalogue, built by `catalogueFromPublishedSeasons` from
   * contract 147's read. Every entry is routable by construction.
   */
  catalogue: readonly HubCompetition[],
  seasons: readonly HubSeasonMembership[],
  limit: number = COMPETITION_SHORTCUT_LIMIT,
): PlayerCompetitions {
  const bySeasonName = new Map(seasons.map((season) => [season.seasonName, season]))
  const order = new Map(catalogue.map((entry, index) => [entry.seasonRowName, index]))

  const relevance: CompetitionRelevance[] = []
  for (const competition of catalogue) {
    const season = bySeasonName.get(competition.seasonRowName)
    // A catalogue entry the database did not return is not relevant and is not
    // guessed at. It stays in `catalogue` for exploration.
    if (!season) continue
    const joinedGames = joinedKeysOf(season.seasonGames.games)
    if (joinedGames.length === 0) continue
    relevance.push({
      competition,
      tournamentId: season.tournamentId,
      // Not `true`. Holding a membership says the player joined a GAME; it says
      // nothing about whether they asked to follow the competition's football.
      followed: 'unknown',
      favourite: 'unknown',
      joinedGames,
      games: season.seasonGames.games,
    })
  }

  const mine = [...relevance].sort((left, right) => byRelevance(left, right, order))
  const shortcuts = mine.slice(0, Math.max(0, limit))

  return {
    mine,
    shortcuts,
    overflow: mine.length - shortcuts.length,
    catalogue,
    relevanceSource: 'game-membership',
    empty: mine.length === 0,
  }
}

/** The competitions in `mine` that run a given game and the player has joined. */
export function competitionsPlaying(
  player: PlayerCompetitions,
  gameKey: CompetitionGameKey,
): readonly CompetitionRelevance[] {
  return player.mine.filter((entry) => entry.joinedGames.includes(gameKey))
}
