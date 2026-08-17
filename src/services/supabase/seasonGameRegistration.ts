import { registerBonusCompetition } from './bonusGames'
import { fetchHubMembership } from './competitionGames'
import type { CompetitionGameKey } from './competitionGamesModel'
import type {
  LmsRegistrationFacts,
  SeasonLmsRegistrationGateway,
} from '../../features/season/lmsRegistrationModel'

/**
 * Registration for a season game the caller can only name by KEY, over the
 * competition-games read rather than the Games hub read.
 *
 * WHY NOT `seasonLmsRegistration.ts`, WHICH ANSWERS THE SAME QUESTION. That
 * gateway reads `get_bonus_games`, whose payload is typed by `BonusGameKey` —
 * `ko_predictor`, `last_man_standing`, `predictor_cup`. `main_predictor` is not
 * in that union and, since the fix that stopped one unmodelled game taking the
 * whole hub read down, `bonusGamesModel` deliberately SKIPS a key it does not
 * model. So asking the Games hub about the Main Predictor returns nothing, and
 * a registration panel built on it would tell an eligible player their game is
 * not listed. `get_competition_games` is the catalogue read that does model it,
 * and its decoder already carries the registration instants, `completed_at`,
 * the caller's membership and the server's own clock — every field the
 * registration model takes.
 *
 * Extending `BonusGameKey` would have been the shorter fix and is not this
 * session's to make: `competitionModel.ts` says the architecture document is
 * the authority for that union and the type is its transcription.
 *
 * IT REFUSES AN AMBIGUOUS KEY RATHER THAN PICKING ONE. The by-id gateway
 * matches exactly because a season can hold more than one competition for a
 * game key — contract 107 mints a fresh Last Man Standing successor on every
 * wipeout restart — and choosing between them is a question the server already
 * owns. Nothing weakens that here: more than one match raises instead of
 * guessing. It is safe for `main_predictor` today because a season has exactly
 * one, and it will say so loudly on the day that stops being true rather than
 * quietly registering somebody into a dead predecessor.
 *
 * THE SEASON IS NAMED BY ITS CATALOGUE ROW NAME, not by a slug. `competitions`
 * is revoked from every browser role, so a slug cannot be turned into a season
 * client-side; the caller supplies the exact `tournaments.name` the catalogue
 * holds, which is the same resolution every other season route makes.
 */

export function createSeasonGameRegistrationRpcGateway(options: {
  /** The exact `tournaments.name` from the hub catalogue. */
  seasonRowName: string
  gameKey: CompetitionGameKey
}): SeasonLmsRegistrationGateway {
  async function resolve() {
    const seasons = await fetchHubMembership([options.seasonRowName])
    const season = seasons.find((entry) => entry.seasonName === options.seasonRowName)
    if (!season) {
      throw new Error('That competition season is no longer listed.')
    }

    const matches = season.seasonGames.games.filter(
      (game) => game.gameKey === options.gameKey,
    )
    if (matches.length === 0) {
      throw new Error('That game is not listed for this season.')
    }
    if (matches.length > 1) {
      throw new Error(
        'This season lists more than one competition for that game, so which one to join is not this surface to decide.',
      )
    }

    const [game] = matches
    if (game === undefined) {
      throw new Error('That game is not listed for this season.')
    }

    return { season, game }
  }

  return {
    async load(): Promise<LmsRegistrationFacts> {
      const { season, game } = await resolve()

      // The server's own instant, so registration windows do not resolve
      // against a device clock that may be wrong. The read supplies one; if it
      // ever does not, an absent instant makes both windows fail closed in the
      // model rather than opening a join that would be refused.
      const serverNow = season.seasonGames.serverNow ?? ''

      return {
        competitionId: game.id,
        entered: game.membership?.status === 'active',
        joinedAt: game.membership?.joinedAt ?? null,
        registrationOpensAt: game.registrationOpensAt,
        registrationClosesAt: game.registrationClosesAt,
        completedAt: game.completedAt,
        serverNow,
      }
    },

    async join(): Promise<void> {
      // Resolved again rather than remembered from the load: the panel reloads
      // after every attempt, so an id held from an earlier read would outlive
      // the facts it was read with.
      const { game } = await resolve()
      await registerBonusCompetition(game.id)
    },
  }
}
