import { db } from './client'
import {
  mapPrivateCompetitionWorkspace,
  type PrivateCompetitionWorkspace,
} from './privateCompetitionWorkspaceModel'

// Only the aggregate is re-exported. The member and round shapes reach callers
// inside it, and re-exporting them added two names nothing imported.
export type { PrivateCompetitionWorkspace } from './privateCompetitionWorkspaceModel'

/**
 * Read one private LMS/Championship container the caller owns or participates in.
 * Contract 179 intentionally refuses an unknown id and somebody else's id in the
 * same way; this wrapper passes that refusal through unchanged.
 */
export async function fetchPrivateCompetitionWorkspace(
  competitionId: string,
): Promise<PrivateCompetitionWorkspace> {
  const { data, error } = await db.rpc('get_private_competition_workspace', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return mapPrivateCompetitionWorkspace(data)
}
