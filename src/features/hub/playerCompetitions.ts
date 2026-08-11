import type { CompetitionGame, CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import type { HubSeasonMembership } from '../../services/supabase/competitionGames'
import type { PlayerPreferences } from '../../services/supabase/playerPreferencesModel'
import {
  favouriteTeamFor,
  isFollowing,
} from '../../services/supabase/playerPreferencesModel'
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
 * FOLLOW IS NOW READ (contract 157, `MIG-UI-10`, consumed 11 August 2026).
 * `get_my_preferences` answers it, so `followed` and `favourite` are booleans
 * whenever the preference read landed. They stay `'unknown'` — not `false` —
 * when it did not, because "we have not asked" and "they have not" would send a
 * player to a different screen, and a rail that silently reported "you follow
 * nothing" after a failed read would be asserting a choice the player never
 * made.
 *
 * A FOLLOWED COMPETITION IS RELEVANT WITHOUT A GAME. That is the whole reason
 * Follow is a separate field: a player who wants the Premier League's fixtures
 * and context, and has joined nothing, is in `mine` with an empty
 * `joinedGames`. Before contract 157 that player was invisible, and the model
 * recorded it as a missing feature rather than pretending otherwise.
 *
 * GAME MEMBERSHIP STILL COUNTS, AND IS NOT SUBORDINATE TO FOLLOW. A player who
 * joined a game and never pressed Follow is unarguably relevant to that
 * competition, so membership remains sufficient on its own. The two questions
 * are unioned, never intersected: neither one may hide a competition the other
 * one includes.
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
   * Whether the player has FOLLOWED this competition (contract 157).
   *
   * `'unknown'` only when the preference read did not land. It is not `false`
   * there, because "we do not know" and "they have not" would send a different
   * player to a different screen.
   */
  followed: boolean | 'unknown'
  /**
   * Whether the player named a favourite club in THIS competition.
   *
   * Presentation prominence only — never membership, scoring, locks,
   * permissions, ranking or urgency. A favourite is per competition because the
   * server constrains it to a team that plays in the competition followed.
   */
  favourite: boolean | 'unknown'
  /** The canonical team id, when there is one. Null otherwise. */
  favouriteTeamId: string | null
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
   * Which question produced `mine`. `follow` once the preference read has
   * landed — meaning the list reflects what the player chose as well as what
   * they joined; `game-membership` when it has not, so a surface can say what
   * it is showing instead of implying the player chose it.
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
 * more theirs than one they play a single game in; then a followed competition
 * ahead of an unfollowed one on the same number of games, which only ever
 * separates the zero-game entries Follow itself put in the list; then the
 * catalogue's order as a stable tie-break, so the list does not reshuffle
 * between renders.
 *
 * A FAVOURITE CLUB IS NOT IN THIS COMPARISON. Favourite is presentation
 * prominence, and letting it reorder "your competitions" would make it a
 * ranking input — which the navigation authority forbids in exactly those
 * words.
 */
function byRelevance(
  left: CompetitionRelevance,
  right: CompetitionRelevance,
  order: ReadonlyMap<string, number>,
): number {
  if (left.joinedGames.length !== right.joinedGames.length) {
    return right.joinedGames.length - left.joinedGames.length
  }
  if (left.followed !== right.followed) {
    if (left.followed === true) return -1
    if (right.followed === true) return 1
  }
  return (
    (order.get(left.competition.seasonRowName) ?? 0) -
    (order.get(right.competition.seasonRowName) ?? 0)
  )
}

export type PresentPlayerCompetitionsOptions = {
  /**
   * Contract 157's answer, or null when the read has not landed or failed.
   * Null is not an empty preference set: it produces `'unknown'` rather than
   * `false`.
   */
  preferences?: PlayerPreferences | null
  limit?: number
}

export function presentPlayerCompetitions(
  /**
   * The published catalogue, built by `catalogueFromPublishedSeasons` from
   * contract 147's read. Every entry is routable by construction.
   */
  catalogue: readonly HubCompetition[],
  seasons: readonly HubSeasonMembership[],
  options: PresentPlayerCompetitionsOptions = {},
): PlayerCompetitions {
  const { preferences = null, limit = COMPETITION_SHORTCUT_LIMIT } = options
  const bySeasonName = new Map(seasons.map((season) => [season.seasonName, season]))
  const order = new Map(catalogue.map((entry, index) => [entry.seasonRowName, index]))

  const relevance: CompetitionRelevance[] = []
  for (const competition of catalogue) {
    const season = bySeasonName.get(competition.seasonRowName)
    // A catalogue entry the database did not return is not relevant and is not
    // guessed at. It stays in `catalogue` for exploration.
    if (!season) continue

    const joinedGames = joinedKeysOf(season.seasonGames.games)
    const followed = preferences ? isFollowing(preferences, season.tournamentId) : 'unknown'
    const favouriteTeamId = preferences
      ? favouriteTeamFor(preferences, season.tournamentId)
      : null

    // The union, not the intersection. Either answer alone makes a competition
    // the player's, and a competition only Follow put here carries an empty
    // `joinedGames` rather than an invented membership.
    if (joinedGames.length === 0 && followed !== true) continue

    relevance.push({
      competition,
      tournamentId: season.tournamentId,
      followed,
      favourite: preferences ? favouriteTeamId !== null : 'unknown',
      favouriteTeamId,
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
    relevanceSource: preferences ? 'follow' : 'game-membership',
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
