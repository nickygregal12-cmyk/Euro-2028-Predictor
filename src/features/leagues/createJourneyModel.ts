import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import type { PlayerCompetitions } from '../hub/playerCompetitions'

/**
 * What a player can create for their own friends, in all three weekly games.
 *
 * WHAT THIS MODEL USED TO SAY, AND WHY IT WAS RIGHT AT THE TIME. Until 11 August
 * 2026 it offered Match Predictor and refused the other two with one sentence —
 * "there is no private version of this game to create" — because there genuinely
 * was not: `bonus_competitions` permitted `visibility_kind = 'private'` and had
 * no name, no owner and no invite code, so a private competition could not be
 * called anything, belonged to nobody, and could only be joined by being
 * inserted by hand. Contracts 152, 153 and 154 built all of it. The refusal is
 * gone because the reason for it is.
 *
 * THE TWO SHAPES ARE GENUINELY DIFFERENT, AND THE MODEL KEEPS THEM APART.
 *
 *   - A private MATCH PREDICTOR container is a LEAGUE: a table on top of the one
 *     public game, created with `create_game_league` against a
 *     `game_competition_id`. It ranks points the player is already scoring, so
 *     the server requires an active membership in that game — which is why its
 *     hosts are the competitions the player PLAYS, and why the invite warns that
 *     a friend must join the game first.
 *   - A private LAST MAN STANDING or PREDICTOR CHAMPIONSHIP is a COMPETITION of
 *     its own, created against a season with `create_private_season_lms` or
 *     `create_private_season_cup`. It has its own entrants, its own rules and
 *     its own calendar, so there is no game to join first: joining the container
 *     IS the entry. Its hosts are the published seasons, whether or not the
 *     player plays anything in them.
 *
 * Collapsing those into one "host" would produce exactly one of two defects: a
 * Match Predictor league created against a season id the function cannot use, or
 * a Last Man Standing offered only in competitions the player already plays,
 * which is not a rule the server has.
 *
 * IT IS NOT A SECOND VALIDATOR. Nothing here re-checks a name, a capacity, the
 * lives range or a lock; those are the functions' and their messages come back
 * from them. This decides only what to OFFER, which the browser has to decide in
 * order to draw anything at all.
 *
 * PURE. Membership and catalogue in, presentation out; no clock, no network, no
 * storage.
 */

export type CreateJourneyHost = {
  /**
   * The `game_competition_id` `create_game_league` is addressed by. Null for a
   * season container, which is created against the season instead.
   */
  gameCompetitionId: string | null
  /** The season row id the two private-competition creators are addressed by. */
  tournamentId: string
  competitionName: string
  seasonLabel: string
}

/** Which server call creates this game's private container. */
export type CreateJourneySetup = 'league' | 'lms' | 'cup'

export type CreateJourneyGame = {
  gameKey: CompetitionGameKey
  name: string
  /** One line on what the container would be. */
  description: string
  setup: CreateJourneySetup
  /** Where the player could create one. Empty whenever `refusal` is set. */
  hosts: readonly CreateJourneyHost[]
  /** Null when one can be created; a sentence when it cannot. */
  refusal: string | null
}

export type CreateJourney = {
  games: readonly CreateJourneyGame[]
  /** True when no game can be created in any competition. */
  blocked: boolean
}

const MATCH_PREDICTOR_DESCRIPTION =
  'A table of your friends, ranked on the Match Predictor points you are already scoring.'

export function presentCreateJourney(player: PlayerCompetitions | null): CreateJourney {
  // Match Predictor: the competitions the player holds an ACTIVE membership in,
  // because a league ranks points that are already being scored.
  const leagueHosts: CreateJourneyHost[] = []
  for (const entry of player?.mine ?? []) {
    for (const game of entry.games) {
      if (game.gameKey !== 'main_predictor') continue
      if (!isActiveMembership(game)) continue
      leagueHosts.push({
        gameCompetitionId: game.id,
        tournamentId: entry.tournamentId ?? '',
        competitionName: entry.competition.name,
        seasonLabel: entry.competition.seasonLabel,
      })
    }
  }

  // The two season containers: every published season the catalogue carries,
  // which contract 147 already limits to league seasons and excludes drafts
  // from. A finished season is left out because both creators would produce a
  // competition with no round left to play — the server says so honestly, and
  // offering it anyway would be offering a dead end.
  const seasonHosts: CreateJourneyHost[] = (player?.catalogue ?? [])
    .filter((competition) => competition.status !== 'ended')
    .map((competition) => ({
      gameCompetitionId: null,
      tournamentId: competition.tournamentId,
      competitionName: competition.name,
      seasonLabel: competition.seasonLabel,
    }))

  const noSeason =
    'No competition season is open to build one on. One will appear here as soon as a league season is published.'

  const games: CreateJourneyGame[] = [
    {
      gameKey: 'main_predictor',
      name: 'Match Predictor',
      description: MATCH_PREDICTOR_DESCRIPTION,
      setup: 'league',
      hosts: leagueHosts,
      refusal:
        leagueHosts.length > 0
          ? null
          : // The server's own precondition, in words: a league ranks one game
            // in one competition, so there has to be one to rank.
            'Join Match Predictor in a competition first — a private league ranks the points you score there.',
    },
    {
      gameKey: 'last_man_standing',
      name: 'Last Man Standing',
      description:
        'Your own survival competition: everyone picks one club a round, and you set the rules.',
      setup: 'lms',
      hosts: seasonHosts,
      refusal: seasonHosts.length > 0 ? null : noSeason,
    },
    {
      gameKey: 'predictor_cup',
      name: 'Predictor Championship',
      description:
        'Your own knockout-style championship: a head-to-head tie each matchweek, decided by Match Predictor points.',
      setup: 'cup',
      hosts: seasonHosts,
      refusal: seasonHosts.length > 0 ? null : noSeason,
    },
  ]

  return { games, blocked: games.every((game) => game.refusal !== null) }
}
