import { fetchBonusGames, registerBonusCompetition } from './bonusGames'
import type {
  LmsRegistrationFacts,
  SeasonLmsRegistrationGateway,
} from '../../features/season/lmsRegistrationModel'

/**
 * The real season Last Man Standing registration gateway.
 *
 * IT ADDS NO RPC. `register_bonus_competition` resolves a competition by id and
 * delegates every rule to `join_competition_game` — it holds no tournament-only
 * join and no reference to `public.matches`, so it already serves a season
 * competition. The facts come from the games hub read, which contract 118
 * widened to see a season's fixtures. This module is the seam between them, not
 * new authority.
 *
 * THE COMPETITION IS SUPPLIED BY THE CALLER AND MATCHED BY EXACT ID. It is
 * never searched for by game key, and that restraint is the important part: a
 * season can hold more than one Last Man Standing competition — contract 107
 * creates a fresh successor whenever a wipeout restarts one — so "the season's
 * LMS competition" is a resolution question that contracts 103 and 104 already
 * own server-side through `current_public_competition_id`. Answering it here
 * would put a second answer in the repository, and it would be the answer that
 * quietly picks a dead predecessor.
 *
 * A COMPETITION THAT IS NOT IN THE LISTING IS AN ERROR, NOT AN EMPTY PANEL.
 * The hub returns published competitions; one the caller named and the server
 * did not list means the two disagree, and rendering that as "registration
 * closed" would be the empty-versus-failed defect this repository keeps
 * finding.
 */

export function createSeasonLmsRegistrationRpcGateway(options: {
  tournamentId: string
  competitionId: string
  userId: string
}): SeasonLmsRegistrationGateway {
  return {
    async load(): Promise<LmsRegistrationFacts> {
      const read = await fetchBonusGames(options.tournamentId, options.userId)
      const game = read.games.find(
        (entry) => entry.competition.id === options.competitionId,
      )
      if (!game) {
        throw new Error('That Last Man Standing competition is no longer listed.')
      }

      return {
        competitionId: game.competition.id,
        entered: game.entrant !== null,
        joinedAt: game.entrant?.joinedAt ?? null,
        registrationOpensAt: game.competition.registrationOpensAt,
        registrationClosesAt: game.competition.registrationClosesAt,
        completedAt: game.competition.completedAt,
        // The server's own instant, so registration windows do not resolve
        // against a device clock that may be wrong.
        serverNow: read.serverNow,
      }
    },

    async join(): Promise<void> {
      await registerBonusCompetition(options.competitionId)
    },
  }
}
