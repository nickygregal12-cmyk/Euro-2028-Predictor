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
