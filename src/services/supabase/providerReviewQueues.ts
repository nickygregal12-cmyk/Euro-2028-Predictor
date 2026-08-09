// Provider review queues (contract 138's `get_provider_review_queues` and
// `acknowledge_provider_review_items`).
//
// WHAT THEY ARE FOR. Five things the ingestion path records and then does
// nothing further with, because doing something further would mean a provider
// deciding a result: a result the platform DECLINED to apply (contract 135), a
// status token it has no mapping for (135), a response it could not consume
// (135), a kickoff a provider moved automatically (117), and a round-window
// refresh it refused rather than applied (123). Each is written append-only and
// each has, until now, been visible only to somebody with database access.
//
// `/admin/season` already names this gap in its own interface — a button to
// approve a list nobody can read is worse than no button. This is the read.
//
// ACKNOWLEDGING IS NOT FIXING, and the naming matters. Marking an item reviewed
// records that a person has seen it; it corrects no fixture, applies no result
// and changes no window. The corrections live in the administrator write paths
// that already own them, and nothing here shortcuts one.

import { supabase } from './client'
import {
  mapProviderReviewQueues,
  type ProviderReviewQueues,
  type ReviewQueueKind,
} from './providerReviewQueuesModel'

export type {
  ProviderReviewQueues,
  ReviewQueue,
  ReviewQueueItem,
  ReviewQueueKind,
} from './providerReviewQueuesModel'

export async function fetchProviderReviewQueues(
  tournamentId: string,
  limit = 20,
): Promise<ProviderReviewQueues> {
  const { data, error } = await supabase.rpc('get_provider_review_queues', {
    p_tournament_id: tournamentId,
    p_limit: limit,
  })
  if (error) throw error
  return mapProviderReviewQueues(data)
}

/**
 * Mark items reviewed.
 *
 * The server bounds the batch at 200 and refuses an unknown queue; neither is
 * re-checked here. It returns how many it actually marked, which can be fewer
 * than were sent — another administrator may have got there first — and the
 * caller reloads rather than assuming its own count.
 */
export async function acknowledgeReviewItems(
  kind: ReviewQueueKind,
  ids: readonly string[],
  note?: string | null,
): Promise<{ marked: number }> {
  const { data, error } = await supabase.rpc('acknowledge_provider_review_items', {
    p_kind: kind,
    p_ids: [...ids],
    p_note: note?.trim() ? note.trim() : null,
  })
  if (error) throw error

  const marked = (data as { marked?: unknown } | null)?.marked
  return { marked: typeof marked === 'number' ? marked : 0 }
}
