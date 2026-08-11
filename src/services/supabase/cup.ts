import { db } from './client'
import { rpcArgs } from './rpcArguments'
import {
  mapCupPenaltySaveResponse,
  mapCupResponse,
  type CupPenaltySaveRead,
  type CupRead,
} from './cupModel'

/** Bounded Predictor Cup read: draw state, my group, ties, bracket and honours. */
export async function fetchMyCup(tournamentId: string): Promise<CupRead> {
  const { data, error } = await db.rpc('get_my_cup', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapCupResponse(data)
}

/**
 * Store my Penalty Number for a pending knockout round (§8.3): parity-laned
 * server-side, optimistic-versioned, locked at the round's first kickoff.
 */
export async function submitCupPenaltyNumber(
  competitionId: string,
  windowId: string,
  value: number,
  expectedVersion: number | null,
): Promise<CupPenaltySaveRead> {
  const { data, error } = await db.rpc(
    'submit_cup_penalty_number',
    rpcArgs('submit_cup_penalty_number', ['p_expected_version'], {
      p_competition_id: competitionId,
      p_window_id: windowId,
      p_value: value,
      p_expected_version: expectedVersion,
    }),
  )
  if (error) throw error
  return mapCupPenaltySaveResponse(data)
}
