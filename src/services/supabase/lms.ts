import { db } from './client'
import { rpcArgs } from './rpcArguments'
import { mapLmsResponse, type LmsRead } from './lmsModel'

/** Bounded Last Man Standing read: rounds, own picks, survivor counts. */
export async function fetchMyLms(tournamentId: string): Promise<LmsRead> {
  const { data, error } = await db.rpc('get_my_lms', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapLmsResponse(data)
}

/**
 * Version-guarded pick, changeable until the round deadline. The database
 * owns every boundary: entrant status, round deadline, team-in-round and the
 * once-per-competition team rule.
 */
export async function saveLmsSelection(
  windowId: string,
  teamId: string,
  expectedVersion: number | null,
): Promise<number> {
  const { data, error } = await db.rpc(
    'save_lms_selection',
    rpcArgs('save_lms_selection', ['p_expected_version'], {
      p_window_id: windowId,
      p_team_id: teamId,
      p_expected_version: expectedVersion,
    }),
  )
  if (error) throw error

  const version = (data as Record<string, unknown> | null)?.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new Error('Last Man Standing pick returned an invalid version.')
  }
  return version
}
