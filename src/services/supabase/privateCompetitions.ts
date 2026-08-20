import { db } from './client'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../observability/operationFailure'
import {
  mapCreatedPrivateCompetition,
  mapCupLaunchResult,
  type CreatedPrivateCompetition,
  type CupLaunchResult,
  type PrivateLmsSetup,
} from './privateCompetitionsModel'

/**
 * Query wrappers for contracts 153 and 154 — a private competition a player
 * makes for their own friends.
 *
 * NO FORMAT OPINION LIVES HERE. `launch_private_season_cup` delegates to
 * contract 111, which owns the format, the seeding, the draw and the schedule
 * and is idempotent. This module carries the call and decodes the answer; a
 * second opinion in the browser about what a six-entrant field looks like is
 * exactly the second authority the repository keeps refusing to create.
 *
 * A PRIVATE MATCH PREDICTOR LEAGUE IS NOT HERE, AND THAT IS CORRECT. The
 * weekly Match Predictor's private container has always been a LEAGUE
 * (`create_game_league`), which is a table on top of the one public game rather
 * than a competition of its own. The unified creation journey dispatches to
 * that existing call for Match Predictor and to these two for the other games.
 */

export type {
  CreatedPrivateCompetition,
  CupLaunchResult,
  LmsDrawsRule,
  LmsWipeoutRule,
  PrivateLmsSetup,
} from './privateCompetitionsModel'
export {
  DEFAULT_LMS_SETUP,
  LMS_LIVES_OPTIONS,
  LMS_SAVES_OPTIONS,
} from './privateCompetitionsModel'

/**
 * Create a private Last Man Standing on a published league season.
 *
 * It opens for play immediately: the calendar comes from
 * `predictor_internal.generate_lms_first_windows`, the same generator the
 * public competition uses, so both agree about when a round locks.
 */
export async function createPrivateSeasonLms(
  tournamentId: string,
  name: string,
  setup: PrivateLmsSetup,
): Promise<CreatedPrivateCompetition> {
  const { data, error } = await db.rpc('create_private_season_lms', {
    p_tournament_id: tournamentId,
    p_name: name,
    p_lives: setup.lives,
    p_saves: setup.saves,
    p_draws_rule: setup.drawsRule,
    p_endgame_on_wipeout: setup.endgameOnWipeout,
  })
  if (error) throw error
  return mapCreatedPrivateCompetition(data)
}

/**
 * Create a private Predictor Championship.
 *
 * Nothing is drawn yet, and the server says so in the payload it returns. The
 * organiser gathers a field first and launches when it is complete.
 */
export async function createPrivateSeasonCup(
  tournamentId: string,
  name: string,
): Promise<CreatedPrivateCompetition> {
  const { data, error } = await db.rpc('create_private_season_cup', {
    p_tournament_id: tournamentId,
    p_name: name,
  })
  // `C1`. The name is player-authored free text and is not reported.
  if (error) {
    reportOperationFailure('championship.action', {
      outcome: 'failed',
      serverCode: serverCodeOf(error),
      seasonId: tournamentId,
    })
    throw error
  }
  return mapCreatedPrivateCompetition(data)
}

/**
 * The organiser says the field is complete.
 *
 * IRREVERSIBLE, AND THE INTERFACE MUST SAY SO BEFORE CALLING THIS. The draw is
 * fixed at the field size found, and launching closes registration so a later
 * joiner cannot hold a membership into a fixture list without them.
 */
export async function launchPrivateSeasonCup(
  competitionId: string,
): Promise<CupLaunchResult> {
  const { data, error } = await db.rpc('launch_private_season_cup', {
    p_competition_id: competitionId,
  })
  // `C1`, and this is the one of these that is IRREVERSIBLE: the draw is fixed
  // at the field size found and registration closes. A launch that failed
  // halfway is the failure most worth seeing.
  if (error) {
    reportOperationFailure('championship.action', {
      outcome: 'failed',
      serverCode: serverCodeOf(error),
      competitionId,
    })
    throw error
  }
  return mapCupLaunchResult(data)
}
