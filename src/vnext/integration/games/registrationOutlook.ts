import {
  presentLmsRegistration,
  MAIN_PREDICTOR_REGISTRATION_COPY,
} from '../../../features/season/lmsRegistrationModel'
import type { CompetitionGame } from '../../../services/supabase/competitionGamesModel'
import type { RegistrationOutlook } from '../../models/games'

/**
 * WHERE REGISTRATION STANDS FOR ONE GAME — resolved ONCE, for the whole lane.
 *
 * ============================ WHY IT IS ITS OWN MODULE ==================
 *
 * The games hub had this and the onboarding games step did not, and the two
 * surfaces disagreed as a result: the hub refused to offer a game whose
 * registration had closed, while onboarding drew a tick box for it and told the
 * player Finish would enter them — which `enter_competition_game` rejects with
 * "Registration has closed". Two Stage 13 surfaces contradicting each other
 * about one server rule is exactly what a shared authority prevents, so there
 * is one function and both mappers call it.
 *
 * ============================ IT DECIDES NOTHING ITSELF =================
 *
 * `lmsRegistrationModel.ts` owns the rule and is game-neutral by design — its
 * own words: *"`join_competition_game` governs entry for every game key, so a
 * second copy of this logic per game would be three chances to disagree about
 * one rule."* This maps its four states into the lane's vocabulary and stops.
 *
 * ============================ THE CLOCK IS THE SERVER'S =================
 *
 * `serverNow` comes from the read. A device clock would offer a registration
 * that has closed, or hide one that has opened, on a player whose laptop is
 * wrong — and both windows fail CLOSED on an absent or unreadable instant,
 * which is the authority's behaviour and not a choice made here.
 */
export function registrationOutlookOf(
  game: Pick<
    CompetitionGame,
    'id' | 'registrationOpensAt' | 'registrationClosesAt' | 'completedAt'
  >,
  serverNow: string,
): RegistrationOutlook {
  const presented = presentLmsRegistration(
    {
      competitionId: game.id,
      // `entered` is false unconditionally: every caller asks this only for a
      // player with no membership row, and passing a real membership would ask
      // the authority a question the caller has already answered.
      entered: false,
      joinedAt: null,
      registrationOpensAt: game.registrationOpensAt,
      registrationClosesAt: game.registrationClosesAt,
      completedAt: game.completedAt,
      serverNow,
    },
    MAIN_PREDICTOR_REGISTRATION_COPY,
  )

  switch (presented.state) {
    case 'finished':
      return 'finished'
    case 'not_open':
      return 'not-open'
    case 'closed':
      return 'closed'
    default:
      // `entered` is false above, so `entered` is unreachable and `open` is the
      // only state left. Named rather than defaulted silently.
      return 'open'
  }
}
