/**
 * Contract 185's private AI Lab admin payloads, decoded without a configured
 * Supabase client. The RPCs are deliberately JSON so the analytical schema
 * never becomes browser-readable; this is the typed edge of that boundary.
 */

export const AI_LAB_LEAGUES = [
  { key: 'EPL', name: 'Premier League' },
  { key: 'ECH', name: 'Championship' },
  { key: 'EL1', name: 'League One' },
  { key: 'EL2', name: 'League Two' },
  { key: 'ENL', name: 'National League' },
  { key: 'SPL', name: 'Scottish Premiership' },
  { key: 'SCH', name: 'Scottish Championship' },
  { key: 'SL1', name: 'Scottish League One' },
  { key: 'SL2', name: 'Scottish League Two' },
] as const

export type AiLabLeague = (typeof AI_LAB_LEAGUES)[number]['key']

export type AiModel = {
  id: string
  league: string
  version: string
  family: string
  status: string
  trainedAt: string | null
  trainingMatches: number
  validationAccuracy: number | null
  validationLogLoss: number | null
  baselineLogLoss: number | null
  marketLogLoss: number | null
}

export type AiPerformance = {
  graded: number
  resultCorrect: number
  accuracy: number | null
  exactScores: number
  meanLogLoss: number | null
  meanRps: number | null
  meanBrier: number | null
}

export type AiCalibrationPoint = {
  bucket: number
  observations: number
  meanPredicted: number
  actualRate: number
}

type AiJob = {
  name: string
  status: string
  startedAt: string | null
  finishedAt: string | null
  rowsWritten: number
  message: string | null
}

// Not exported: these are the building blocks of the aggregate reads below,
// which are what every surface imports. Exporting them added names nothing
// referenced, which the dead-code gate reports rather than forgives. They stay
// named so the aggregates read as composed shapes rather than inline ones.
type AiPrediction = {
  id: string
  league: string
  kickoffAt: string | null
  home: string
  away: string
  pHome: number
  pDraw: number
  pAway: number
  predictedResult: string
  predictedScore: string | null
  expectedHomeGoals: number | null
  expectedAwayGoals: number | null
  modelVersion: string
  fixtureStatus: string | null
}

type AiRecentResult = AiPrediction & {
  actualHomeGoals: number | null
  actualAwayGoals: number | null
  actualResult: string | null
  resultCorrect: boolean
  exactScoreCorrect: boolean
  logLoss: number | null
  rps: number | null
}

type AiMetricSlice = {
  observations: number
  accuracy: number | null
  logLoss: number | null
  rps: number | null
}

export type AiPerformanceBreakdown = {
  overall: AiMetricSlice
  byLeague: Readonly<Record<string, AiMetricSlice>>
  byHorizon: Readonly<Record<string, AiMetricSlice>>
  byPick: Readonly<Record<string, AiMetricSlice>>
  byEloGap: Readonly<Record<string, AiMetricSlice>>
  bySeasonStage: Readonly<Record<string, AiMetricSlice>>
  promotedClubs: Readonly<Record<string, AiMetricSlice>>
}

export type AiBetting = {
  clv: {
    observations: number
    mean: number
    ciLow: number | null
    ciHigh: number | null
    beatCloseRate: number | null
    significant: boolean
  }
  profit: {
    settledBets: number
    staked: number
    pnl: number
    roi: number
    hitRate: number
    meanOdds: number
    meanClaimedEdge: number
  }
  open: { bets: number; exposure: number }
  bookmakers: { total: number; licenceVerified: number; unverifiedRealBooks: readonly string[] }
  bettingPublicEnabled: boolean
}

export type AiGateCheck = {
  value: number | string | null
  required: number | string | null
  met: boolean
}

export type AiBettingGate = {
  settledBets: AiGateCheck
  meanClv: AiGateCheck
  clvCiAboveZero: AiGateCheck
  bookmakerLicences: AiGateCheck
  ageGate: AiGateCheck
  saferGamblingSignpost: AiGateCheck
  fullRecordPublished: AiGateCheck
  currentlyPublic: boolean
}

type AiMarketEvidence = {
  code: string
  name: string
  settledBets: number
  clvObservations: number
  meanClv: number
  clvCiLow: number | null
  flatUnitRoi: number
  stakeWeightedRoi: number | null
  requiredBets: number
  requiredClv: number
  trusted: boolean
  meetsEvidenceBar: boolean
  freeHistoricalOdds: boolean
  derivedFromScoreline: boolean
}

export type AiOddsStatus = {
  monthToDateCredits: number
  monthlyCredits: number
  softCap: number
  remainingToSoftCap: number
  costModelDrift: number
  coverage: Readonly<Record<string, readonly string[]>>
  eventMatching: { eventsSeen: number; matchedToFixture: number; unmatched: readonly string[] }
  recentCalls: readonly {
    endpoint: string
    sportKey: string | null
    estimatedCost: number
    reportedCost: number | null
    reportedRemaining: number | null
    rowsReturned: number
    calledAt: string | null
  }[]
}

export type AiLabSnapshot = {
  asOf: string | null
  models: readonly AiModel[]
  performance: AiPerformance
  calibration: readonly AiCalibrationPoint[]
  jobs: readonly AiJob[]
  publicationPublicEnabled: boolean
  upcoming: readonly AiPrediction[]
  recent: readonly AiRecentResult[]
  breakdown: AiPerformanceBreakdown
  betting: AiBetting
  bettingGate: AiBettingGate
  markets: readonly AiMarketEvidence[]
  odds: AiOddsStatus
}

type RawSnapshot = {
  dashboard: unknown
  upcoming: unknown
  recent: unknown
  breakdown: unknown
  betting: unknown
  bettingGate: unknown
  markets: unknown
  odds: unknown
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function stringOf(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function numberOf(value: unknown): number {
  return numberOrNull(value) ?? 0
}

function countOf(value: unknown): number {
  const count = numberOf(value)
  return Number.isInteger(count) && count >= 0 ? count : 0
}

function stringList(value: unknown): readonly string[] {
  return arrayOf(value).filter((entry): entry is string => typeof entry === 'string')
}

function metric(value: unknown): AiMetricSlice {
  const row = objectOf(value)
  return {
    observations: countOf(row.n),
    accuracy: numberOrNull(row.accuracy),
    logLoss: numberOrNull(row.log_loss),
    rps: numberOrNull(row.rps),
  }
}

function metricMap(value: unknown): Readonly<Record<string, AiMetricSlice>> {
  return Object.fromEntries(Object.entries(objectOf(value)).map(([key, row]) => [key, metric(row)]))
}

function gateCheck(value: unknown): AiGateCheck {
  const row = objectOf(value)
  const rawValue = row.value
  const rawRequired = row.required
  return {
    value:
      typeof rawValue === 'string' ? rawValue : numberOrNull(rawValue),
    required:
      typeof rawRequired === 'string' ? rawRequired : numberOrNull(rawRequired),
    met: row.met === true,
  }
}

function prediction(value: unknown): AiPrediction {
  const row = objectOf(value)
  return {
    id: stringOf(row.id),
    league: stringOf(row.league),
    kickoffAt: stringOrNull(row.kickoff_at),
    home: stringOf(row.home, 'Unknown home team'),
    away: stringOf(row.away, 'Unknown away team'),
    pHome: numberOf(row.p_home),
    pDraw: numberOf(row.p_draw),
    pAway: numberOf(row.p_away),
    predictedResult: stringOf(row.predicted_result, '—'),
    predictedScore: stringOrNull(row.predicted_score),
    expectedHomeGoals: numberOrNull(row.exp_home_goals),
    expectedAwayGoals: numberOrNull(row.exp_away_goals),
    modelVersion: stringOf(row.model_version, '—'),
    fixtureStatus: stringOrNull(row.fixture_status),
  }
}

export function mapAiLabSnapshot(raw: RawSnapshot): AiLabSnapshot {
  const dashboard = objectOf(raw.dashboard)
  const performance = objectOf(dashboard.performance)
  const gate = objectOf(dashboard.gate)
  const jobs = objectOf(dashboard.jobs)
  const breakdown = objectOf(raw.breakdown)
  const betting = objectOf(raw.betting)
  const clv = objectOf(betting.clv)
  const profit = objectOf(betting.profit)
  const open = objectOf(betting.open)
  const books = objectOf(betting.bookmakers)
  const bettingPublication = objectOf(betting.gate)
  const bettingGate = objectOf(raw.bettingGate)
  const odds = objectOf(raw.odds)
  const matching = objectOf(odds.event_matching)

  return {
    asOf: stringOrNull(dashboard.as_of),
    models: arrayOf(dashboard.models).map((value) => {
      const row = objectOf(value)
      return {
        id: stringOf(row.id),
        league: stringOf(row.league),
        version: stringOf(row.version),
        family: stringOf(row.model_family ?? row.family),
        status: stringOf(row.status),
        trainedAt: stringOrNull(row.trained_at),
        trainingMatches: countOf(row.training_matches),
        validationAccuracy: numberOrNull(row.val_accuracy),
        validationLogLoss: numberOrNull(row.val_log_loss),
        baselineLogLoss: numberOrNull(row.baseline_log_loss),
        marketLogLoss: numberOrNull(row.market_log_loss),
      }
    }),
    performance: {
      graded: countOf(performance.graded),
      resultCorrect: countOf(performance.result_correct),
      accuracy: numberOrNull(performance.accuracy),
      exactScores: countOf(performance.exact_scores),
      meanLogLoss: numberOrNull(performance.mean_log_loss),
      meanRps: numberOrNull(performance.mean_rps),
      meanBrier: numberOrNull(performance.mean_brier),
    },
    calibration: arrayOf(dashboard.calibration).map((value) => {
      const row = objectOf(value)
      return {
        bucket: countOf(row.bucket),
        observations: countOf(row.n),
        meanPredicted: numberOf(row.mean_predicted),
        actualRate: numberOf(row.actual_rate),
      }
    }),
    jobs: Object.entries(jobs).map(([name, value]) => {
      const row = objectOf(value)
      return {
        name,
        status: stringOf(row.status, 'unknown'),
        startedAt: stringOrNull(row.started_at),
        finishedAt: stringOrNull(row.finished_at),
        rowsWritten: countOf(row.rows_written),
        message: stringOrNull(row.message),
      }
    }),
    publicationPublicEnabled: gate.public_enabled === true,
    upcoming: arrayOf(raw.upcoming).map(prediction),
    recent: arrayOf(raw.recent).map((value) => {
      const row = objectOf(value)
      return {
        ...prediction(value),
        actualHomeGoals: numberOrNull(row.actual_home_goals),
        actualAwayGoals: numberOrNull(row.actual_away_goals),
        actualResult: stringOrNull(row.actual_result),
        resultCorrect: row.result_correct === true,
        exactScoreCorrect: row.exact_score_correct === true,
        logLoss: numberOrNull(row.log_loss),
        rps: numberOrNull(row.rps),
      }
    }),
    breakdown: {
      overall: metric(breakdown.overall),
      byLeague: metricMap(breakdown.by_league),
      byHorizon: metricMap(breakdown.by_horizon),
      byPick: metricMap(breakdown.by_pick),
      byEloGap: metricMap(breakdown.by_elo_gap),
      bySeasonStage: metricMap(breakdown.by_season_stage),
      promotedClubs: metricMap(breakdown.promoted_clubs),
    },
    betting: {
      clv: {
        observations: countOf(clv.n),
        mean: numberOf(clv.mean_clv),
        ciLow: numberOrNull(clv.ci_low),
        ciHigh: numberOrNull(clv.ci_high),
        beatCloseRate: numberOrNull(clv.beat_close_rate),
        significant: clv.significant === true,
      },
      profit: {
        settledBets: countOf(profit.settled_bets),
        staked: numberOf(profit.staked),
        pnl: numberOf(profit.pnl),
        roi: numberOf(profit.roi),
        hitRate: numberOf(profit.hit_rate),
        meanOdds: numberOf(profit.mean_odds),
        meanClaimedEdge: numberOf(profit.mean_claimed_edge),
      },
      open: { bets: countOf(open.open_bets), exposure: numberOf(open.exposure) },
      bookmakers: {
        total: countOf(books.total),
        licenceVerified: countOf(books.licence_verified),
        unverifiedRealBooks: stringList(books.unverified_real_books),
      },
      bettingPublicEnabled: bettingPublication.betting_public_enabled === true,
    },
    bettingGate: {
      settledBets: gateCheck(bettingGate.settled_bets),
      meanClv: gateCheck(bettingGate.mean_clv),
      clvCiAboveZero: gateCheck(bettingGate.clv_ci_above_zero),
      bookmakerLicences: gateCheck(bettingGate.bookmaker_licences),
      ageGate: gateCheck(bettingGate.age_gate),
      saferGamblingSignpost: gateCheck(bettingGate.safer_gambling_signpost),
      fullRecordPublished: gateCheck(bettingGate.full_record_published),
      currentlyPublic: bettingGate.currently_public === true,
    },
    markets: Object.entries(objectOf(raw.markets)).map(([code, value]) => {
      const row = objectOf(value)
      return {
        code,
        name: stringOf(row.name, code),
        settledBets: countOf(row.settled_bets),
        clvObservations: countOf(row.clv_observations),
        meanClv: numberOf(row.mean_clv),
        clvCiLow: numberOrNull(row.clv_ci_low),
        flatUnitRoi: numberOf(row.flat_unit_roi),
        stakeWeightedRoi: numberOrNull(row.stake_weighted_roi),
        requiredBets: countOf(row.required_bets),
        requiredClv: numberOf(row.required_clv),
        trusted: row.trusted === true,
        meetsEvidenceBar: row.meets_evidence_bar === true,
        freeHistoricalOdds: row.free_historical_odds === true,
        derivedFromScoreline: row.derived_from_scoreline === true,
      }
    }),
    odds: {
      monthToDateCredits: countOf(odds.month_to_date_credits),
      monthlyCredits: countOf(odds.monthly_credits),
      softCap: countOf(odds.soft_cap),
      remainingToSoftCap: countOf(odds.remaining_to_soft_cap),
      costModelDrift: numberOf(odds.cost_model_drift),
      coverage: Object.fromEntries(
        Object.entries(objectOf(odds.coverage)).map(([key, value]) => [key, stringList(value)]),
      ),
      eventMatching: {
        eventsSeen: countOf(matching.events_seen),
        matchedToFixture: countOf(matching.matched_to_fixture),
        unmatched: stringList(matching.unmatched),
      },
      recentCalls: arrayOf(odds.recent_calls).map((value) => {
        const row = objectOf(value)
        return {
          endpoint: stringOf(row.endpoint, 'Unknown endpoint'),
          sportKey: stringOrNull(row.sport_key),
          estimatedCost: countOf(row.estimated_cost),
          reportedCost: numberOrNull(row.reported_cost),
          reportedRemaining: numberOrNull(row.reported_remaining),
          rowsReturned: countOf(row.rows_returned),
          calledAt: stringOrNull(row.called_at),
        }
      }),
    },
  }
}
