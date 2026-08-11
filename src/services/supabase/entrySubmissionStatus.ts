import { db } from './client'
import {
  mapEntrySubmissionStatus,
  type EntrySubmissionStatus,
} from './entrySubmissionStatusModel'

/**
 * Reads an existing entry and its server-owned submission outcome without
 * creating an entry as a side effect. Callers should wait for PredictionsProvider
 * to become ready first, which guarantees the normal entry bootstrap has settled.
 */
export async function fetchExistingEntrySubmissionStatus(
  userId: string,
  tournamentId: string,
): Promise<EntrySubmissionStatus | null> {
  const entry = await db
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()

  if (entry.error) throw entry.error
  if (!entry.data) return null

  const { data, error } = await db.rpc('get_entry_submission_status', {
    p_entry_id: entry.data.id,
  })
  if (error) throw error
  return mapEntrySubmissionStatus(data)
}
