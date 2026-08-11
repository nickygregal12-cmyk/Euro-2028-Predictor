import { db } from './client'
import {
  mapAdminEntrantsPage,
  mapProviderProposalPage,
  type AdminEntrantsPage,
  type ProviderProposalPage,
} from './seasonAdminInspectionModel'

/**
 * Query wrappers for contract 168's administration inspection reads.
 *
 * THEY ARE READS. Neither approves, rejects nor disqualifies anything —
 * contract 132's decision writers and the existing membership authorities own
 * those, and this module deliberately does not wrap them, so a surface cannot
 * reach a decision through the thing that shows it the evidence.
 *
 * NO RAW PROVIDER PAYLOAD. The proposal read returns decoded facts and the id
 * of the retained response; nothing here fetches the body.
 */

export type {
  AdminEntrant,
  AdminEntrantsPage,
  ProviderProposal,
  ProviderProposalClub,
  ProviderProposalPage,
} from './seasonAdminInspectionModel'
export { blockerLabel } from './seasonAdminInspectionModel'

export async function fetchProviderProposals(
  tournamentId: string,
  options: { provider?: string; limit?: number; offset?: number } = {},
): Promise<ProviderProposalPage> {
  const { data, error } = await db.rpc('admin_provider_proposal_detail', {
    p_tournament_id: tournamentId,
    p_provider: options.provider,
    p_limit: options.limit,
    p_offset: options.offset,
  })
  if (error) throw error
  return mapProviderProposalPage(data)
}

/** Null when the payload named no competition — rendered as a refusal. */
export async function fetchAdminEntrants(
  competitionId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<AdminEntrantsPage | null> {
  const { data, error } = await db.rpc('admin_competition_entrants', {
    p_competition_id: competitionId,
    p_limit: options.limit,
    p_offset: options.offset,
  })
  if (error) throw error
  return mapAdminEntrantsPage(data)
}

/**
 * The two decision writers, beside the reads that show what they act on.
 *
 * APPROVAL IS WHOLE-CALENDAR, NOT PER PROPOSAL, and a surface must say so.
 * `admin_approve_initial_provider_fixtures` takes a season and a PROVIDER and
 * decides the whole staged calendar for it; there is no per-proposal accept.
 * Contract 168's read shows each proposal and its blockers so an administrator
 * can see what they are approving — which is a different thing from approving
 * them one at a time, and offering a per-row button would misrepresent what the
 * server does.
 *
 * A REASON IS REQUIRED BY BOTH, and neither wrapper supplies a default. A
 * decision with no recorded reason is one nobody can review afterwards.
 */
export async function approveInitialProviderFixtures(
  tournamentId: string,
  provider: string,
  reason: string,
): Promise<void> {
  const { error } = await db.rpc('admin_approve_initial_provider_fixtures', {
    p_tournament_id: tournamentId,
    p_provider: provider,
    p_reason: reason,
  })
  if (error) throw error
}

export async function rejectInitialProviderFixtures(
  tournamentId: string,
  provider: string,
  reason: string,
): Promise<void> {
  const { error } = await db.rpc('admin_reject_initial_provider_fixtures', {
    p_tournament_id: tournamentId,
    p_provider: provider,
    p_reason: reason,
  })
  if (error) throw error
}

/**
 * Disqualify one entrant from one competition.
 *
 * CONSEQUENTIAL AND IRREVERSIBLE FROM THE PLAYER'S SIDE: a disqualified entry
 * can never be rejoined, which the membership authority enforces. Every caller
 * must confirm first and must name the person, because the whole reason
 * contract 168's entrant read exists is that this control previously could not
 * say who it was about to remove.
 */
export async function disqualifyEntrant(
  gameCompetitionId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const { error } = await db.rpc('admin_disqualify_competition_game_entry', {
    p_game_competition_id: gameCompetitionId,
    p_user_id: userId,
    p_reason: reason,
  })
  if (error) throw error
}
