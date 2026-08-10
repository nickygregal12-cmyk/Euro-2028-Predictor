import { supabase } from './client'

export const EURO_PUBLICATION_STATES = [
  'hidden',
  'prelaunch',
  'registration-open',
  'live',
  'completed',
  'archived',
] as const

export type EuroPublicationState = (typeof EURO_PUBLICATION_STATES)[number]

export type EuroPublicationSnapshot = {
  state: EuroPublicationState
  changedAt: string
}

function isEuroPublicationState(value: unknown): value is EuroPublicationState {
  return (
    typeof value === 'string' &&
    (EURO_PUBLICATION_STATES as readonly string[]).includes(value)
  )
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

  const row = (data ?? [])[0] as { state?: unknown; changed_at?: unknown } | undefined
  if (!row || !isEuroPublicationState(row.state) || typeof row.changed_at !== 'string') {
    throw new Error('Euro publication state returned an invalid row.')
  }

  return {
    state: row.state,
    changedAt: row.changed_at,
  }
}
