// Contract 176's `get_season_prediction_dna` — how a player predicts, from the
// one place that defines it.
//
// THE DISCLOSURE BOUNDARY IS CONTRACT 151'S AND IT IS THE SERVER'S. Self,
// always; otherwise a shared PRIVATE LEAGUE on this season and nothing weaker.
// A browser must not pre-check that: a second boundary is a second thing that
// can disagree with the first, and the one that would be wrong is the one
// written in a component.
//
// A REFUSAL IS NOT AN EMPTY PROFILE. `42501` means the caller may not read this
// player, and the surface says so. It is a different sentence from "this player
// has not entered", which contract 176 answers as an ordinary payload with
// `entered: false` — a co-member who never played is a real answer.
//
// THE WINDOW IS THE SERVER'S TOO. Every metric is measured over matchweeks
// whose OWN lock has passed, applied uniformly to the caller and to a rival, so
// a player's own figure cannot disagree with the one their league-mates see of
// them. There is no client clock anywhere in this path.

import { db } from './client'
import { mapSeasonPredictionDna, type SeasonPredictionDna } from './seasonPredictionDnaModel'

export type {
  SeasonPredictionDna,
  DnaTendencies,
  DnaAccuracy,
  DnaConsensus,
  DnaClub,
  DnaScoreline,
} from './seasonPredictionDnaModel'

/** The caller may not read this player's DNA. Not the same as "no data". */
export class PredictionDnaRefusedError extends Error {
  constructor() {
    super('You do not share a private league with that player')
    this.name = 'PredictionDnaRefusedError'
  }
}

function isRefusal(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === '42501' || code === 'insufficient_privilege'
}

export async function fetchSeasonPredictionDna(
  tournamentId: string,
  playerId: string,
): Promise<SeasonPredictionDna> {
  const { data, error } = await db.rpc('get_season_prediction_dna', {
    p_tournament_id: tournamentId,
    p_player_id: playerId,
  })
  if (error) {
    if (isRefusal(error)) throw new PredictionDnaRefusedError()
    throw error
  }
  return mapSeasonPredictionDna(data)
}
