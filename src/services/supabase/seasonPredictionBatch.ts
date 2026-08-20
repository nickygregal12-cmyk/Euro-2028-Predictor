// Contract 177's `save_season_predictions_batch` — reconciling a phone that was
// offline, in one call with per-fixture answers.
//
// IT IS NOT A SECOND WRITE PATH AND MUST NEVER BECOME ONE. Contract 177 routes
// every draft through `save_season_prediction` unchanged, one subtransaction
// each, so the lock, the version check, the Joker allowance and the card's
// provisional status are enforced by the triggers that already own them. A
// source assertion in the migration refuses any redefinition that writes
// `season_predictions` directly or grows a timestamp parameter.
//
// NO CLIENT INSTANT LEAVES THIS MODULE. The payload carries a fixture, two
// scores and a version; the lock a draft is measured against is derived
// server-side. A device that has been offline for two days cannot backdate
// anything, because there is nothing to backdate with.
//
// A REFUSAL TO AUTHORISE IS ONE FACT ABOUT THE CALL, NOT EIGHT ABOUT THE
// DRAFTS. Contract 177 re-raises `42501` rather than reporting it per item, and
// this wrapper lets it through as a thrown error: eight ordinary rejections and
// one broken session look nothing alike to a player.

import { db } from './client'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../observability/operationFailure'
import type { Json } from './database.types'
import {
  mapPredictionBatchResult,
  type PredictionBatchResult,
} from './seasonPredictionBatchModel'

export type {
  PredictionBatchResult,
  PredictionBatchResultRow,
  PredictionBatchOutcome,
  PredictionBatchScore,
} from './seasonPredictionBatchModel'

/** One draft as contract 177 reads it. `home`/`away` null CLEARS a prediction. */
export type PredictionBatchDraft = {
  fixture_id: string
  home: number | null
  away: number | null
  version: number
}

export async function submitSeasonPredictionBatch(
  tournamentId: string,
  drafts: readonly PredictionBatchDraft[],
): Promise<PredictionBatchResult> {
  const { data, error } = await db.rpc('save_season_predictions_batch', {
    p_tournament_id: tournamentId,
    // Rebuilt as a plain mutable array of plain objects rather than cast.
    // `p_drafts` is generated as `Json`, and a `readonly` array of a named type
    // is not assignable to `Json[]` — asserting past that would be exactly the
    // on-the-way-IN suppression `typedDatabaseClient.test.ts` exists to stop.
    // The server refuses a batch naming one fixture twice, so the caller must
    // have de-duplicated already, which it has: a draft store is keyed by
    // fixture.
    p_drafts: drafts.map((draft) => ({
      fixture_id: draft.fixture_id,
      home: draft.home,
      away: draft.away,
      version: draft.version,
    })) satisfies Json,
  })
  // `C1`. This is the offline reconciliation, so a failure here is a batch of
  // work the device is still holding and the server has not taken. The DRAFTS
  // are not reported — they are predictions — only how many there were.
  if (error) {
    reportOperationFailure('prediction.save', {
      outcome: 'failed',
      serverCode: serverCodeOf(error),
      seasonId: tournamentId,
    })
    throw error
  }
  return mapPredictionBatchResult(data)
}
