/**
 * Contract 201's three AI Lab reads, decoded without a configured client.
 *
 * The reads answer the question an empty Bet Builder cannot: is there no value
 * right now, or is the pipeline broken? Coverage lists every scheduled fixture
 * in the window with its canonical forecast, its price coverage and the current
 * recorded BET/PASS with each refusal explained; health says when each stage
 * last ran; the review says what happened, one row per fixture.
 *
 * NOTHING HERE DECIDES ANYTHING. The server reports the decisions `find_value`
 * already recorded, and this module reshapes them. No threshold is applied on
 * this side of the boundary, and a fixture with no current decision is carried
 * as `null` rather than defaulted to a PASS.
 */

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function obj(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

export type CoveragePrediction = {
  readonly predictionId: string
  readonly modelVersion: string | null
  readonly modelFamily: string | null
  readonly modelTrainedThrough: string | null
  readonly pHome: number | null
  readonly pDraw: number | null
  readonly pAway: number | null
  readonly predictedResult: string | null
  readonly predictedScore: string | null
  readonly expHomeGoals: number | null
  readonly expAwayGoals: number | null
  readonly horizon: string | null
  readonly dataSnapshotAt: string | null
  readonly forecastMadeAt: string | null
  /** How many forecasts of this fixture the canonical view collapsed. */
  readonly forecastsCollapsed: number | null
  readonly usesMarket: boolean
}

export type CoverageQuality = {
  readonly dataConfidence: number | null
  readonly dataConfidenceState: string | null
  readonly missingInputs: readonly string[]
  readonly agreement: number | null
  readonly uncertaintyWidth: number | null
}

export type CoverageMarket = {
  readonly realBooks: readonly string[]
  readonly realBookCount: number
  readonly latestRealCaptureAt: string | null
  readonly bestRealPrice: {
    readonly bookmaker: string
    readonly oddsHome: number | null
    readonly oddsDraw: number | null
    readonly oddsAway: number | null
    readonly capturedAt: string | null
  } | null
  readonly aggregateReferenceAvailable: boolean
}

export type CoverageReason = { readonly code: string; readonly explanation: string }

export type CoverageDecision = {
  readonly decision: 'BET' | 'PASS'
  readonly selection: string | null
  readonly market: string | null
  readonly reasons: readonly CoverageReason[]
  readonly bookmaker: string | null
  readonly oddsOffered: number | null
  readonly modelProbability: number | null
  readonly modelFairOdds: number | null
  readonly marketFairProbability: number | null
  readonly modelEdge: number | null
  readonly dataConfidence: number | null
  readonly dataConfidenceState: string | null
  readonly agreementScore: number | null
  readonly uncertaintyWidth: number | null
  readonly oddsCapturedAt: string | null
  readonly priceAgeSeconds: number | null
  readonly priceAgeLimitSeconds: number | null
  readonly decidedAt: string | null
}

export type CoverageFixture = {
  readonly fixtureId: string
  readonly league: string
  readonly kickoffAt: string
  readonly home: string
  readonly away: string
  readonly hoursToKickoff: number | null
  readonly prediction: CoveragePrediction | null
  readonly quality: CoverageQuality | null
  readonly market: CoverageMarket
  readonly decision: CoverageDecision | null
}

export type CoverageTotals = {
  readonly fixtures: number
  readonly withForecast: number
  readonly withoutForecast: number
  readonly withRealBookmakerPrice: number
  readonly withoutRealBookmakerPrice: number
  readonly withCurrentDecision: number
  readonly withoutCurrentDecision: number
  readonly actionableBets: number
  readonly passed: number
  readonly priceWithinFreshnessLimit: number
}

export type CoverageLeague = {
  readonly league: string
  readonly fixtures: number
  readonly withForecast: number
  readonly withRealBookmakerPrice: number
  readonly withCurrentDecision: number
  readonly actionableBets: number
  readonly passed: number
}

export type AiCoverage = {
  readonly window: { readonly from: string | null; readonly to: string | null }
  readonly totals: CoverageTotals
  readonly passReasonCounts: readonly { readonly code: string; readonly n: number }[]
  readonly byLeague: readonly CoverageLeague[]
  readonly fixtures: readonly CoverageFixture[]
  readonly generatedAt: string | null
}

function mapDecision(raw: unknown): CoverageDecision | null {
  if (raw === null || raw === undefined) return null
  const d = obj(raw)
  const decision = d.decision === 'BET' ? 'BET' : 'PASS'
  return {
    decision,
    selection: text(d.selection),
    market: text(d.market),
    reasons: list(d.reasons)
      .map((entry) => obj(entry))
      .flatMap((entry) => {
        const code = text(entry.code)
        return code ? [{ code, explanation: text(entry.explanation) ?? '' }] : []
      }),
    bookmaker: text(d.bookmaker),
    oddsOffered: num(d.odds_offered),
    modelProbability: num(d.model_probability),
    modelFairOdds: num(d.model_fair_odds),
    marketFairProbability: num(d.market_fair_probability),
    modelEdge: num(d.model_edge),
    dataConfidence: num(d.data_confidence),
    dataConfidenceState: text(d.data_confidence_state),
    agreementScore: num(d.agreement_score),
    uncertaintyWidth: num(d.uncertainty_width),
    oddsCapturedAt: text(d.odds_captured_at),
    priceAgeSeconds: num(d.price_age_seconds),
    priceAgeLimitSeconds: num(d.price_age_limit_seconds),
    decidedAt: text(d.decided_at),
  }
}

export function mapAiCoverage(payload: unknown): AiCoverage {
  const body = obj(payload)
  const totals = obj(body.totals)
  const win = obj(body.window)
  const counts = obj(body.pass_reason_counts)
  return {
    window: { from: text(win.from), to: text(win.to) },
    totals: {
      fixtures: num(totals.fixtures) ?? 0,
      withForecast: num(totals.with_forecast) ?? 0,
      withoutForecast: num(totals.without_forecast) ?? 0,
      withRealBookmakerPrice: num(totals.with_real_bookmaker_price) ?? 0,
      withoutRealBookmakerPrice: num(totals.without_real_bookmaker_price) ?? 0,
      withCurrentDecision: num(totals.with_current_decision) ?? 0,
      withoutCurrentDecision: num(totals.without_current_decision) ?? 0,
      actionableBets: num(totals.actionable_bets) ?? 0,
      passed: num(totals.passed) ?? 0,
      priceWithinFreshnessLimit: num(totals.price_within_freshness_limit) ?? 0,
    },
    passReasonCounts: Object.entries(counts)
      .map(([code, value]) => ({ code, n: num(value) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
    byLeague: list(body.by_league).map((entry) => {
      const l = obj(entry)
      return {
        league: text(l.league) ?? '',
        fixtures: num(l.fixtures) ?? 0,
        withForecast: num(l.with_forecast) ?? 0,
        withRealBookmakerPrice: num(l.with_real_bookmaker_price) ?? 0,
        withCurrentDecision: num(l.with_current_decision) ?? 0,
        actionableBets: num(l.actionable_bets) ?? 0,
        passed: num(l.passed) ?? 0,
      }
    }),
    fixtures: list(body.fixtures).flatMap((entry) => {
      const f = obj(entry)
      const fixtureId = text(f.fixture_id)
      if (!fixtureId) return []
      const p = obj(f.prediction)
      const q = obj(f.quality)
      const m = obj(f.market)
      const best = obj(m.best_real_price)
      const bestBook = text(best.bookmaker)
      // A fixture with no forecast carries no quality either, and both are null
      // rather than zeroed. A zero data-confidence would read as "measured and
      // bad" where the truth is "not forecast yet".
      const predictionId = text(p.prediction_id)
      return [{
        fixtureId,
        league: text(f.league) ?? '',
        kickoffAt: text(f.kickoff_at) ?? '',
        home: text(f.home) ?? '',
        away: text(f.away) ?? '',
        hoursToKickoff: num(f.hours_to_kickoff),
        prediction: predictionId
          ? {
              predictionId,
              modelVersion: text(p.model_version),
              modelFamily: text(p.model_family),
              modelTrainedThrough: text(p.model_trained_through),
              pHome: num(p.p_home),
              pDraw: num(p.p_draw),
              pAway: num(p.p_away),
              predictedResult: text(p.predicted_result),
              predictedScore: text(p.predicted_score),
              expHomeGoals: num(p.exp_home_goals),
              expAwayGoals: num(p.exp_away_goals),
              horizon: text(p.horizon),
              dataSnapshotAt: text(p.data_snapshot_at),
              forecastMadeAt: text(p.forecast_made_at),
              forecastsCollapsed: num(p.forecasts_collapsed),
              usesMarket: p.uses_market === true,
            }
          : null,
        quality: predictionId
          ? {
              dataConfidence: num(q.data_confidence),
              dataConfidenceState: text(q.data_confidence_state),
              missingInputs: list(q.missing_inputs).flatMap((v) => {
                const s = text(v)
                return s ? [s] : []
              }),
              agreement: num(q.agreement),
              uncertaintyWidth: num(q.uncertainty_width),
            }
          : null,
        market: {
          realBooks: list(m.real_books).flatMap((v) => {
            const s = text(v)
            return s ? [s] : []
          }),
          realBookCount: num(m.real_book_count) ?? 0,
          latestRealCaptureAt: text(m.latest_real_capture_at),
          bestRealPrice: bestBook
            ? {
                bookmaker: bestBook,
                oddsHome: num(best.odds_home),
                oddsDraw: num(best.odds_draw),
                oddsAway: num(best.odds_away),
                capturedAt: text(best.captured_at),
              }
            : null,
          aggregateReferenceAvailable: m.aggregate_reference_available === true,
        },
        decision: mapDecision(f.decision),
      }]
    }),
    generatedAt: text(body.generated_at),
  }
}

export type AiHealth = {
  readonly fixtures: {
    readonly upcoming7d: number
    readonly leaguesWithUpcoming: number
    readonly playedAwaitingResult: number
    readonly lastSyncAt: string | null
  }
  readonly predictions: {
    readonly upcomingFixtures: number
    readonly withCurrentForecast: number
    readonly withoutForecast: number
    readonly oldestForecastAt: string | null
    readonly lastPredictAt: string | null
  }
  readonly prices: {
    readonly lastRealCaptureAt: string | null
    readonly lastReferenceCaptureAt: string | null
    readonly realBooksSeen7d: readonly string[]
  }
  readonly valueLoop: {
    readonly lastRunAt: string | null
    readonly currentBets: number
    readonly currentPasses: number
  }
  readonly settlement: {
    readonly advised: number
    readonly settled: number
    readonly playedAndUnsettled: number
    readonly awaitingClosingBenchmark: number
    readonly lastRunAt: string | null
  }
  readonly oddsApi: {
    readonly collectionEnabled: boolean
    readonly monthlyCredits: number | null
    readonly softCap: number | null
    readonly creditsUsedThisMonth: number | null
    readonly lastDispatchAt: string | null
    readonly lastSuccessfulCallAt: string | null
    readonly lastCallStatus: number | null
    readonly eventsSeen: number
    readonly eventsMatchedToFixture: number
  }
  readonly models: {
    readonly current: number
    readonly expected: number
    readonly versions: readonly string[]
    readonly oldestTrainedThrough: string | null
    readonly newestTrainedThrough: string | null
    readonly lastTrainAt: string | null
  }
  readonly generatedAt: string | null
}

export function mapAiHealth(payload: unknown): AiHealth {
  const body = obj(payload)
  const f = obj(body.fixtures)
  const p = obj(body.predictions)
  const pr = obj(body.prices)
  const v = obj(body.value_loop)
  const s = obj(body.settlement)
  const o = obj(body.odds_api)
  const m = obj(body.models)
  return {
    fixtures: {
      upcoming7d: num(f.upcoming_7d) ?? 0,
      leaguesWithUpcoming: num(f.leagues_with_upcoming) ?? 0,
      playedAwaitingResult: num(f.played_awaiting_result) ?? 0,
      lastSyncAt: text(f.last_sync_at),
    },
    predictions: {
      upcomingFixtures: num(p.upcoming_fixtures) ?? 0,
      withCurrentForecast: num(p.with_current_forecast) ?? 0,
      withoutForecast: num(p.without_forecast) ?? 0,
      oldestForecastAt: text(p.oldest_forecast_at),
      lastPredictAt: text(p.last_predict_at),
    },
    prices: {
      lastRealCaptureAt: text(pr.last_real_capture_at),
      lastReferenceCaptureAt: text(pr.last_reference_capture_at),
      realBooksSeen7d: list(pr.real_books_seen_7d).flatMap((entry) => {
        const code = text(entry)
        return code ? [code] : []
      }),
    },
    valueLoop: {
      lastRunAt: text(v.last_run_at),
      currentBets: num(v.current_bets) ?? 0,
      currentPasses: num(v.current_passes) ?? 0,
    },
    settlement: {
      advised: num(s.advised) ?? 0,
      settled: num(s.settled) ?? 0,
      playedAndUnsettled: num(s.played_and_unsettled) ?? 0,
      awaitingClosingBenchmark: num(s.awaiting_closing_benchmark) ?? 0,
      lastRunAt: text(s.last_run_at),
    },
    oddsApi: {
      collectionEnabled: o.collection_enabled === true,
      monthlyCredits: num(o.monthly_credits),
      softCap: num(o.soft_cap),
      creditsUsedThisMonth: num(o.credits_used_this_month),
      lastDispatchAt: text(o.last_dispatch_at),
      lastSuccessfulCallAt: text(o.last_successful_call_at),
      lastCallStatus: num(o.last_call_status),
      eventsSeen: num(o.events_seen) ?? 0,
      eventsMatchedToFixture: num(o.events_matched_to_fixture) ?? 0,
    },
    models: {
      current: num(m.current) ?? 0,
      expected: num(m.expected) ?? 9,
      versions: list(m.versions).flatMap((entry) => {
        const version = text(entry)
        return version ? [version] : []
      }),
      oldestTrainedThrough: text(m.oldest_trained_through),
      newestTrainedThrough: text(m.newest_trained_through),
      lastTrainAt: text(m.last_train_at),
    },
    generatedAt: text(body.generated_at),
  }
}

export type ReviewFixture = {
  readonly fixtureId: string
  readonly league: string
  readonly kickoffAt: string
  readonly home: string
  readonly away: string
  readonly homeGoals: number | null
  readonly awayGoals: number | null
  readonly actualResult: string | null
  readonly predictedResult: string | null
  readonly predictedScore: string | null
  readonly pHome: number | null
  readonly pDraw: number | null
  readonly pAway: number | null
  readonly resultCorrect: boolean
  readonly exactScoreCorrect: boolean
  /**
   * True when the modal SCORELINE was right and the modal OUTCOME was not.
   * The two are different statistics over the same joint grid, and a reader who
   * does not know that reports the pair as data corruption. One already did.
   */
  readonly modalScorelineBeatModalOutcome: boolean
  readonly logLoss: number | null
  readonly rps: number | null
  readonly brier: number | null
  readonly marketLogLoss: number | null
  readonly logLossVsMarket: number | null
  readonly diagnosis: string | null
  readonly modelVersion: string | null
  readonly horizon: string | null
  readonly dataConfidenceState: string | null
  readonly forecastsCollapsed: number | null
}

export type ReviewSlice = {
  readonly label: string
  readonly gradedFixtures: number
  readonly resultCorrect: number
  readonly exactScores: number | null
  readonly meanLogLoss: number | null
  readonly meanRps: number | null
  readonly meanBrier: number | null
}

export type SampleSufficiency = 'NO_SAMPLE' | 'EARLY_SAMPLE' | 'INDICATIVE_ONLY' | 'USABLE'

export type AiResultsReview = {
  readonly window: { readonly from: string | null; readonly to: string | null }
  readonly totals: {
    readonly gradedFixtures: number
    readonly resultCorrect: number
    readonly resultAccuracy: number | null
    readonly exactScores: number
    readonly meanLogLoss: number | null
    readonly meanRps: number | null
    readonly meanBrier: number | null
    readonly meanMarketLogLoss: number | null
    readonly marketComparisons: number
  }
  readonly byLeague: readonly ReviewSlice[]
  readonly byPredictedResult: readonly ReviewSlice[]
  readonly byDataConfidence: readonly ReviewSlice[]
  readonly fixtures: readonly ReviewFixture[]
  readonly duplicateGradedRowsExcluded: number
  readonly sampleSufficiency: SampleSufficiency
  readonly sampleNote: string
  readonly generatedAt: string | null
}

function mapSlice(entry: unknown, labelKey: string): ReviewSlice {
  const s = obj(entry)
  return {
    label: text(s[labelKey]) ?? 'Unknown',
    gradedFixtures: num(s.graded_fixtures) ?? 0,
    resultCorrect: num(s.result_correct) ?? 0,
    exactScores: num(s.exact_scores),
    meanLogLoss: num(s.mean_log_loss),
    meanRps: num(s.mean_rps),
    meanBrier: num(s.mean_brier),
  }
}

const SUFFICIENCY: readonly SampleSufficiency[] = [
  'NO_SAMPLE', 'EARLY_SAMPLE', 'INDICATIVE_ONLY', 'USABLE',
]

export function mapAiResultsReview(payload: unknown): AiResultsReview {
  const body = obj(payload)
  const t = obj(body.totals)
  const win = obj(body.window)
  const sufficiency = text(body.sample_sufficiency)
  return {
    window: { from: text(win.from), to: text(win.to) },
    totals: {
      gradedFixtures: num(t.graded_fixtures) ?? 0,
      resultCorrect: num(t.result_correct) ?? 0,
      resultAccuracy: num(t.result_accuracy),
      exactScores: num(t.exact_scores) ?? 0,
      meanLogLoss: num(t.mean_log_loss),
      meanRps: num(t.mean_rps),
      meanBrier: num(t.mean_brier),
      meanMarketLogLoss: num(t.mean_market_log_loss),
      marketComparisons: num(t.market_comparisons) ?? 0,
    },
    byLeague: list(body.by_league).map((entry) => mapSlice(entry, 'league')),
    byPredictedResult: list(body.by_predicted_result).map((entry) =>
      mapSlice(entry, 'predicted_result')),
    byDataConfidence: list(body.by_data_confidence).map((entry) =>
      mapSlice(entry, 'data_confidence_state')),
    fixtures: list(body.fixtures).flatMap((entry) => {
      const f = obj(entry)
      const fixtureId = text(f.fixture_id)
      if (!fixtureId) return []
      return [{
        fixtureId,
        league: text(f.league) ?? '',
        kickoffAt: text(f.kickoff_at) ?? '',
        home: text(f.home) ?? '',
        away: text(f.away) ?? '',
        homeGoals: num(f.home_goals),
        awayGoals: num(f.away_goals),
        actualResult: text(f.actual_result),
        predictedResult: text(f.predicted_result),
        predictedScore: text(f.predicted_score),
        pHome: num(f.p_home),
        pDraw: num(f.p_draw),
        pAway: num(f.p_away),
        resultCorrect: f.result_correct === true,
        exactScoreCorrect: f.exact_score_correct === true,
        modalScorelineBeatModalOutcome: f.modal_scoreline_beat_modal_outcome === true,
        logLoss: num(f.log_loss),
        rps: num(f.rps),
        brier: num(f.brier),
        marketLogLoss: num(f.market_log_loss),
        logLossVsMarket: num(f.log_loss_vs_market),
        diagnosis: text(f.diagnosis),
        modelVersion: text(f.model_version),
        horizon: text(f.horizon),
        dataConfidenceState: text(f.data_confidence_state),
        forecastsCollapsed: num(f.forecasts_collapsed),
      }]
    }),
    duplicateGradedRowsExcluded: num(body.duplicate_graded_rows_excluded) ?? 0,
    sampleSufficiency: SUFFICIENCY.includes(sufficiency as SampleSufficiency)
      ? (sufficiency as SampleSufficiency)
      : 'NO_SAMPLE',
    sampleNote: text(body.sample_note) ?? '',
    generatedAt: text(body.generated_at),
  }
}
