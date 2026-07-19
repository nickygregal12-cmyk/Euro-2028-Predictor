// Derives the Predict-hub stage statuses from the tournament data + the user's
// predictions + their manual tie-resolutions, via the domain layer. The
// third-place stage (and its tie count) comes from the shared third-place
// pipeline, so the hub, Home and Review all agree on how many ties are pending.
// Presentational components render these; they don't compute them (CLAUDE.md
// architecture rule 2).

import { buildThirdPlacePipeline } from './thirdPlacePipeline'
import { buildBracketPipeline } from '../bracket/bracketPipeline'
import type { TieResolution } from '../../domain/tournament/tieResolutions'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'

const BRACKET_TOTAL = 15 // R16 (8) + QF (4) + SF (2) + Final (1)
const JOKERS_TOTAL = 5

export type HubStatus = {
  groups: { predicted: number; total: number; complete: boolean }
  // 'blocked' = groups not yet all predicted; then 'ties' or 'settled'.
  thirdPlace: { state: 'blocked' | 'ties' | 'settled'; tieCount: number }
  bracket: { picked: number; total: number }
  jokers: { placed: number; total: number }
  reviewUnlocked: boolean
  overallPercent: number
}

export function computeHubStatus(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  jokerCount: number,
  resolutions: TieResolution[] = [],
  progression: Record<string, ProgressionStage> = {},
): HubStatus {
  const groupMatches = data.matches.filter((m) => m.round === 'group')
  const total = groupMatches.length
  let predicted = 0
  for (const m of groupMatches) {
    const p = getPrediction(m.id)
    if (p.homeScore !== null && p.awayScore !== null) predicted += 1
  }
  const groupsComplete = total > 0 && predicted === total

  // Ties come from the whole third-place pipeline (in-group blocks + the
  // cross-group third ranking), so the hub reflects unresolved ties anywhere in
  // the pipeline — not just the third ranking.
  const pipeline = buildThirdPlacePipeline(data, getPrediction, resolutions)
  const tieCount = pipeline.pendingCount
  const state: HubStatus['thirdPlace']['state'] = !groupsComplete
    ? 'blocked'
    : tieCount > 0
      ? 'ties'
      : 'settled'

  // Bracket winner-picks come from the same pipeline the bracket screen uses, so
  // the hub's "N of 15" and the screen always agree.
  const bracketPicked = buildBracketPipeline(
    data,
    getPrediction,
    resolutions,
    progression,
  ).pickedCount
  const reviewUnlocked = groupsComplete && state === 'settled' && bracketPicked === BRACKET_TOTAL

  return {
    groups: { predicted, total, complete: groupsComplete },
    thirdPlace: { state, tieCount },
    bracket: { picked: bracketPicked, total: BRACKET_TOTAL },
    jokers: { placed: jokerCount, total: JOKERS_TOTAL },
    reviewUnlocked,
    overallPercent: total > 0 ? Math.round((predicted / total) * 100) : 0,
  }
}
