import { supabase } from './client'
import {
  isEuroPublicationState,
  type EuroPublicationSnapshot,
  type EuroPublicationState,
} from './euroPublicationModel'

export {
  EURO_PUBLICATION_STATES,
  isEuroPublicationState,
  type EuroPublicationSnapshot,
  type EuroPublicationState,
} from './euroPublicationModel'

function decodeSnapshot(data: unknown): EuroPublicationSnapshot {
  const row = ((data ?? []) as unknown[])[0] as
    | { state?: unknown; changed_at?: unknown }
    | undefined
  if (!row || !isEuroPublicationState(row.state) || typeof row.changed_at !== 'string') {
    throw new Error('Euro publication state returned an invalid row.')
  }

  return {
    state: row.state,
    changedAt: row.changed_at,
  }
}

/**
 * Read Contract 143's single server-owned Euro publication state.
 *
 * The caller must fail closed if this read fails or returns an unknown shape;
 * no frontend constant is allowed to become a second publication authority.
 */
export async function fetchEuroPublicationState(): Promise<EuroPublicationSnapshot> {
  const { data, error } = await supabase.rpc('euro_publication_state')
  if (error) throw error
  return decodeSnapshot(data)
}

/**
 * Advance the publication state by one adjacent step.
 *
 * EVERY ARGUMENT IS SENT AS GIVEN, INCLUDING A REASON THE SERVER WILL REFUSE.
 * `admin_transition_euro_publication_state` owns who may act, which steps are
 * legal, that the expected state still holds under a row lock and that a reason
 * is present; it also writes the append-only history entry. This function adds
 * none of that and validates nothing beyond the shape of what came back.
 *
 * `p_expected_state` is the state this caller last READ, not the state it
 * wishes were true. That is what makes the write optimistic rather than
 * last-writer-wins: two operators acting on one stale page cannot both succeed.
 */
export async function transitionEuroPublicationState(input: {
  expectedState: EuroPublicationState
  nextState: EuroPublicationState
  reason: string
}): Promise<EuroPublicationSnapshot> {
  const { data, error } = await supabase.rpc('admin_transition_euro_publication_state', {
    p_expected_state: input.expectedState,
    p_next_state: input.nextState,
    p_reason: input.reason,
  })
  if (error) throw error
  return decodeSnapshot(data)
}
