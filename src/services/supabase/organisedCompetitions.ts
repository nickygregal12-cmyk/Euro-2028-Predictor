import { db } from './client'
import {
  mapOrganisedCompetition,
  mapOrganisedCompetitions,
  type OrganisedCompetition,
  type OrganisedCompetitionSummary,
} from './organisedCompetitionsModel'

/**
 * Query wrappers for contract 165's organiser reads.
 *
 * OWNER-SCOPED, NOT ADMINISTRATOR-SCOPED. Both functions answer about
 * competitions the CALLER owns, and the list is filtered server-side to private
 * competitions with `owner_id = auth.uid()`. Nothing here takes a player
 * argument, so neither can be turned into a directory.
 *
 * THEY CARRY NO COMMAND. Contract 165 adds none, deliberately, because no
 * accepted authority grants an organiser power over another entrant — and that
 * power is the power to eliminate somebody. `organiserCommandsAvailable` comes
 * back empty and is carried rather than assumed away, so a command arriving
 * later shows up in the data instead of in a component.
 */

export type {
  OrganisedCompetition,
  OrganisedCompetitionSummary,
  OrganisedCounts,
  OrganisedEntrant,
  OrganisedRound,
  OrganisedSetup,
} from './organisedCompetitionsModel'

/** Every private competition the caller organises, newest first. */
export async function fetchMyOrganisedCompetitions(
  limit?: number,
  offset?: number,
): Promise<readonly OrganisedCompetitionSummary[]> {
  const { data, error } = await db.rpc('get_my_organised_competitions', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return mapOrganisedCompetitions(data)
}

/**
 * One organised competition, with its field.
 *
 * Null when the payload named no competition — which is what a caller who does
 * not own it gets, and is rendered as a refusal rather than as an empty
 * management screen.
 */
export async function fetchMyOrganisedCompetition(
  competitionId: string,
): Promise<OrganisedCompetition | null> {
  const { data, error } = await db.rpc('get_my_organised_competition', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return mapOrganisedCompetition(data)
}
