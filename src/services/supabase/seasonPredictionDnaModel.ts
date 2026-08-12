/**
 * Contract 176's Prediction DNA, decoded. Pure: no Supabase import, no network,
 * no clock — the configured wrapper is `seasonPredictionDna.ts`.
 *
 * THE DENOMINATORS ARE THE FEATURE. Every block the server sends carries the
 * number of observations it was measured over and its own `sufficient` verdict
 * against one stated minimum. This decoder keeps them attached: a rate that
 * arrives without its denominator is dropped rather than rendered, because a
 * percentage with no idea how many matches are behind it is exactly the
 * confident-looking figure contract 176 was written to prevent.
 *
 * NOTHING IS RECOMPUTED. The rates are the server's, to four decimal places,
 * and the counts are the server's. `INNOV-002` shipped as browser arithmetic
 * over contract 151's prediction history, which could only see fixture ids —
 * no clubs, no field, no results beyond the ones the profile already carried.
 * That is why it could not do agreement-with-the-field or per-club tendency at
 * all, and why the exact-score rate had a different denominator from the
 * tendency shares. One authority, one denominator each, is the whole point.
 *
 * A BLOCK THE SERVER SENT AS NULL IS ABSENT, NOT ZERO. A player who has not
 * entered gets `entered: false` and three null blocks; rendering those as
 * "0% draws over 0 predictions" would state a habit for somebody who has never
 * predicted.
 */

export type DnaScoreline = { home: number; away: number; count: number }

export type DnaTendencies = {
  denominator: number
  sufficient: boolean
  homeWins: number
  draws: number
  awayWins: number
  /** Shares of `denominator`, 0–1. Null when nothing was measured. */
  homeWinRate: number | null
  drawRate: number | null
  awayWinRate: number | null
  averagePredictedGoals: number | null
  averagePredictedMargin: number | null
  mostCommonScoreline: DnaScoreline | null
}

export type DnaAccuracy = {
  /** Settled predictions. Never the same number as the tendency denominator. */
  denominator: number
  sufficient: boolean
  exactScores: number
  correctOutcomes: number
  exactScoreRate: number | null
  correctOutcomeRate: number | null
}

export type DnaConsensus = {
  /** Contract 61's cohort, reused. A fixture below it does not count. */
  minimumCohort: number
  settledFixtures: number
  /** Fixtures that survived the cohort AND had a strict most-predicted outcome. */
  measured: number
  excludedSmallCohort: number
  excludedNoConsensus: number
  sufficient: boolean
  agreedWithField: number
  againstField: number
  againstFieldCorrect: number
  agreementRate: number | null
  againstFieldSuccessRate: number | null
}

export type DnaClub = {
  teamId: string
  name: string
  predictions: number
  settled: number
  exactScores: number
  correctOutcomes: number
  predictedToWin: number
  sufficient: boolean
}

export type SeasonPredictionDna = {
  player: { userId: string; displayName: string; isSelf: boolean }
  entered: boolean
  serverNow: string | null
  /** The one minimum every `sufficient` flag was measured against. */
  minimumSample: number
  predictionsCounted: number
  settledPredictions: number
  tendencies: DnaTendencies | null
  accuracy: DnaAccuracy | null
  consensus: DnaConsensus | null
  clubs: readonly DnaClub[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

/**
 * A rate or an average. `numeric` reaches the browser as a JSON number, and a
 * value that is not a finite number is treated as absent rather than as zero —
 * "0% draws" and "we did not measure draws" are different statements.
 */
function rateOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function mapTendencies(value: unknown): DnaTendencies | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const denominator = integerOr(row.denominator, null)
  if (denominator === null) return null

  const top = objectOf(row.most_common_scoreline)
  const topHome = integerOr(top.home, null)
  const topAway = integerOr(top.away, null)
  const topCount = integerOr(top.count, null)

  return {
    denominator,
    sufficient: row.sufficient === true,
    homeWins: integerOr(row.home_wins, 0) ?? 0,
    draws: integerOr(row.draws, 0) ?? 0,
    awayWins: integerOr(row.away_wins, 0) ?? 0,
    homeWinRate: rateOrNull(row.home_win_rate),
    drawRate: rateOrNull(row.draw_rate),
    awayWinRate: rateOrNull(row.away_win_rate),
    averagePredictedGoals: rateOrNull(row.average_predicted_goals),
    averagePredictedMargin: rateOrNull(row.average_predicted_margin),
    mostCommonScoreline:
      topHome !== null && topAway !== null && topCount !== null
        ? { home: topHome, away: topAway, count: topCount }
        : null,
  }
}

function mapAccuracy(value: unknown): DnaAccuracy | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const denominator = integerOr(row.denominator, null)
  if (denominator === null) return null
  return {
    denominator,
    sufficient: row.sufficient === true,
    exactScores: integerOr(row.exact_scores, 0) ?? 0,
    correctOutcomes: integerOr(row.correct_outcomes, 0) ?? 0,
    exactScoreRate: rateOrNull(row.exact_score_rate),
    correctOutcomeRate: rateOrNull(row.correct_outcome_rate),
  }
}

function mapConsensus(value: unknown): DnaConsensus | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const measured = integerOr(row.measured, null)
  const minimumCohort = integerOr(row.minimum_cohort, null)
  if (measured === null || minimumCohort === null) return null
  return {
    minimumCohort,
    settledFixtures: integerOr(row.settled_fixtures, 0) ?? 0,
    measured,
    excludedSmallCohort: integerOr(row.excluded_small_cohort, 0) ?? 0,
    excludedNoConsensus: integerOr(row.excluded_no_consensus, 0) ?? 0,
    sufficient: row.sufficient === true,
    agreedWithField: integerOr(row.agreed_with_field, 0) ?? 0,
    againstField: integerOr(row.against_field, 0) ?? 0,
    againstFieldCorrect: integerOr(row.against_field_correct, 0) ?? 0,
    agreementRate: rateOrNull(row.agreement_rate),
    againstFieldSuccessRate: rateOrNull(row.against_field_success_rate),
  }
}

function mapClub(value: unknown): DnaClub | null {
  const row = objectOf(value)
  const teamId = stringOrNull(row.team_id)
  const name = stringOrNull(row.name)
  const predictions = integerOr(row.predictions, null)
  if (teamId === null || name === null || predictions === null) return null
  return {
    teamId,
    name,
    predictions,
    settled: integerOr(row.settled, 0) ?? 0,
    exactScores: integerOr(row.exact_scores, 0) ?? 0,
    correctOutcomes: integerOr(row.correct_outcomes, 0) ?? 0,
    predictedToWin: integerOr(row.predicted_to_win, 0) ?? 0,
    sufficient: row.sufficient === true,
  }
}

export function mapSeasonPredictionDna(value: unknown): SeasonPredictionDna {
  const payload = objectOf(value)
  const player = objectOf(payload.player)
  const userId = stringOrNull(player.user_id)
  const displayName = stringOrNull(player.display_name)
  const minimumSample = integerOr(payload.minimum_sample, null)

  if (userId === null || displayName === null || minimumSample === null) {
    throw new Error('The prediction DNA response was not in the expected shape.')
  }

  const clubs = Array.isArray(payload.clubs) ? payload.clubs : []

  return {
    player: { userId, displayName, isSelf: player.is_self === true },
    entered: payload.entered === true,
    serverNow: stringOrNull(payload.server_now),
    minimumSample,
    predictionsCounted: integerOr(payload.predictions_counted, 0) ?? 0,
    settledPredictions: integerOr(payload.settled_predictions, 0) ?? 0,
    tendencies: mapTendencies(payload.tendencies),
    accuracy: mapAccuracy(payload.accuracy),
    consensus: mapConsensus(payload.consensus),
    clubs: clubs.map(mapClub).filter((club): club is DnaClub => club !== null),
  }
}
