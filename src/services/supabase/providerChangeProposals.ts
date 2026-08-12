// Contract 174's staged provider calendar changes, and the one function in the
// repository that may act on them.
//
// `admin_decide_provider_change_proposal` IS THE ONLY THING THAT MAY CHANGE A
// FIXTURE HERE. Approving a discovered proposal creates the fixture; approving
// a postponement, abandonment, cancellation or withdrawal sets its status. It
// re-checks under the row lock that the fixture still has no result, because
// one can be confirmed between detection and approval, and approving then
// would rescore a settled matchweek. Nothing in this module writes
// `season_fixtures` and nothing may be added that does.
//
// A REJECTION NEEDS A REASON AND AN APPROVAL DOES NOT. That asymmetry is
// contract 125's, kept: by the time you are refusing something a provider
// measured, why is the only useful record. The server enforces it; this
// wrapper does not pre-check it, because a browser that decided the rule could
// disagree with the one that applies it.
//
// REPEATING A DECISION IS ANSWERED, NOT REFUSED. A retried request comes back
// with `repeated: true` rather than looking like a failure. A DIFFERENT
// decision is refused, because the first one's calendar change has happened.

import { db } from './client'
import {
  mapProviderChangeDecision,
  mapProviderChangeProposals,
  type ProviderChangeDecision,
  type ProviderChangeProposalPage,
} from './providerChangeProposalsModel'

export type {
  ProviderChangeProposal,
  ProviderChangeProposalPage,
  ProviderChangeDecision,
  ProviderChangeState,
} from './providerChangeProposalsModel'

export async function fetchProviderChangeProposals(
  tournamentId: string,
  options: { state?: 'pending' | 'approved' | 'rejected'; limit?: number; offset?: number } = {},
): Promise<ProviderChangeProposalPage> {
  const { data, error } = await db.rpc('admin_provider_change_proposals', {
    p_tournament_id: tournamentId,
    ...(options.state === undefined ? {} : { p_state: options.state }),
    ...(options.limit === undefined ? {} : { p_limit: options.limit }),
    ...(options.offset === undefined ? {} : { p_offset: options.offset }),
  })
  if (error) throw error
  return mapProviderChangeProposals(data)
}

export async function decideProviderChangeProposal(
  proposalId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<ProviderChangeDecision> {
  const { data, error } = await db.rpc('admin_decide_provider_change_proposal', {
    p_proposal_id: proposalId,
    p_decision: decision,
    ...(reason === undefined ? {} : { p_reason: reason }),
  })
  if (error) throw error
  return mapProviderChangeDecision(data)
}
