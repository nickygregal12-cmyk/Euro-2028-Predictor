import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import type { PlayerCompetitions } from '../hub/playerCompetitions'

/**
 * What a player can actually create a private league in, right now.
 *
 * DERIVED FROM THE SERVER'S OWN REFUSALS, not from a guess. `create_game_league`
 * takes a `game_competition_id` and refuses unless (a) the game requires a
 * prediction entry and (b) the caller holds an ACTIVE membership in it. Only
 * the predictor games satisfy (a), so the honest offer is Match Predictor in
 * the competitions the player already plays — and every other combination is a
 * refusal with a reason rather than a control that fails on press.
 *
 * IT IS NOT A SECOND VALIDATOR. Nothing here re-checks a name, a capacity or a
 * lock; those are the function's and their messages come back from it. This
 * decides only what to OFFER, which the browser has to decide in order to draw
 * anything at all.
 *
 * NO DEAD BRANCHES. Last Man Standing and the Championship are listed and
 * explained rather than rendered as forms that would submit into a refusal —
 * a wizard whose second and third options cannot complete is worse than one
 * that says so on the first screen.
 *
 * PURE. Membership in, presentation out; no clock, no network, no storage.
 */

export type CreateJourneyHost = {
  /** The `game_competition_id` `create_game_league` is addressed by. */
  gameCompetitionId: string
  competitionName: string
  seasonLabel: string
}

export type CreateJourneyGame = {
  gameKey: CompetitionGameKey
  name: string
  /** One line on what the league would rank. */
  description: string
  /** Where the player could create one. Empty whenever `refusal` is set. */
  hosts: readonly CreateJourneyHost[]
  /** Null when a league can be created; a sentence when it cannot. */
  refusal: string | null
}

export type CreateJourney = {
  games: readonly CreateJourneyGame[]
  /** True when no game can be created in any competition. */
  blocked: boolean
}

const MATCH_PREDICTOR_DESCRIPTION =
  'A table of your friends, ranked on the Match Predictor points you are already scoring.'

/**
 * Said once, in the player's terms. The underlying fact is that
 * `create_game_league` only accepts a game that requires a prediction entry;
 * the sentence states the consequence rather than the mechanism, and claims
 * nothing about how those two games are set up.
 */
const NOT_A_PRIVATE_GAME =
  'Private leagues rank prediction points. There is no private version of this game to create.'

export function presentCreateJourney(player: PlayerCompetitions | null): CreateJourney {
  const hosts: CreateJourneyHost[] = []
  for (const entry of player?.mine ?? []) {
    for (const game of entry.games) {
      if (game.gameKey !== 'main_predictor') continue
      if (!isActiveMembership(game)) continue
      hosts.push({
        gameCompetitionId: game.id,
        competitionName: entry.competition.name,
        seasonLabel: entry.competition.seasonLabel,
      })
    }
  }

  const games: CreateJourneyGame[] = [
    {
      gameKey: 'main_predictor',
      name: 'Match Predictor',
      description: MATCH_PREDICTOR_DESCRIPTION,
      hosts,
      refusal:
        hosts.length > 0
          ? null
          : // The server's own precondition, in words: a league ranks one game
            // in one competition, so there has to be one to rank.
            'Join Match Predictor in a competition first — a private league ranks the points you score there.',
    },
    {
      gameKey: 'last_man_standing',
      name: 'Last Man Standing',
      description: 'Survive the round. Played as a competition in its own right.',
      hosts: [],
      refusal: NOT_A_PRIVATE_GAME,
    },
    {
      gameKey: 'predictor_cup',
      name: 'Predictor Championship',
      description: 'A head-to-head tie each matchweek, decided by your Match Predictor points.',
      hosts: [],
      refusal: NOT_A_PRIVATE_GAME,
    },
  ]

  return { games, blocked: games.every((game) => game.refusal !== null) }
}
