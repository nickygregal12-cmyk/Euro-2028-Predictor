import type { Bookmaker, Leg } from '../../domain/ai/betBuilder'
import { AI_LAB_LEAGUES } from './aiLabModel'
import { db } from './client'

/**
 * Bet Builder reads only bounded competition-admin RPCs; the browser never
 * queries schema `ai` directly.
 *
 * `admin_ai_bet_builder_candidates` is intentionally conservative but its SQL
 * selects from historical rows where decision=BET. That means an older BET can
 * still be returned after a newer price pass has changed the fixture to PASS.
 * Recommendations are append-only audit evidence, so mutating the old row would
 * be worse. We therefore intersect the candidate RPC with the existing bounded
 * recommendation log: only the newest decision for a fixture/market may feed
 * Bet Builder, and that newest decision must still be BET.
 */

type RawBook = {
  code: string
  name: string
  kind: string
  is_real_price: boolean
  exchange_commission: number | string | null
  legs: number | string | null
  last_decided_at: string | null
}

type RawLeg = {
  recommendation_id: string
  league: string
  market: string
  selection: string
  bookmaker: string
  odds: number | string | null
  calibrated_prob: number | string | null
  fair_odds: number | string | null
  model_edge: number | string | null
  data_confidence: number | string | null
  data_confidence_state: string | null
  agreement_score: number | string | null
  uncertainty_width: number | string | null
  odds_captured_at: string | null
  price_age_seconds: number | string | null
  price_age_limit_seconds: number | string | null
  kickoff_at: string
  fixture_id: string
  home_canonical: string
  away_canonical: string
  horizon: string | null
  uses_market: boolean | null
}

type RawDecision = {
  id: string
  league: string
  market: string
  decision: string
  decided_at: string
  kickoff_at: string
  bookmaker: string | null
  home_canonical: string
  away_canonical: string
  prediction_quarantined: boolean
}

type DecisionSnapshot = {
  readonly currentBetRecommendationIds: ReadonlySet<string>
  readonly currentBetCountsByBook: ReadonlyMap<string, number>
}

type RecommendationLogRpcResult = {
  readonly data: unknown
  readonly error: unknown
}

type RecommendationLogRpc = (
  fn: 'admin_ai_recommendation_log',
  args: { p_league: string; p_limit: number },
) => PromiseLike<RecommendationLogRpcResult>

export type BookmakerSummary = Bookmaker & {
  readonly legs: number
  readonly lastDecidedAt: string | null
}

export type BetBuilderCandidates = {
  readonly bookmaker: Bookmaker
  readonly legs: readonly Leg[]
  readonly legCount: number
  readonly truncatedAt: number
  readonly window: { from: string; to: string }
  readonly generatedAt: string
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function kind(value: string): Bookmaker['kind'] {
  return value === 'bookmaker' || value === 'exchange' || value === 'aggregate'
    ? value
    : 'unknown'
}

function decisionKey(row: RawDecision): string {
  return [row.league, row.market, row.kickoff_at, row.home_canonical, row.away_canonical].join('\u001f')
}

/**
 * `admin_ai_recommendation_log` returns newest rows first. Keep exactly the
 * first row per fixture/market and admit its id only when it is a future,
 * non-quarantined BET. A newer PASS therefore supersedes an older BET without
 * deleting or rewriting either audit row.
 */
export function currentBetDecisionSnapshot(
  payload: unknown,
  nowMs: number = Date.now(),
): DecisionSnapshot {
  const body = (payload ?? {}) as { recommendations?: RawDecision[] }
  const seen = new Set<string>()
  const ids = new Set<string>()
  const counts = new Map<string, number>()

  for (const row of body.recommendations ?? []) {
    const key = decisionKey(row)
    if (seen.has(key)) continue
    seen.add(key)

    const kickoffMs = Date.parse(row.kickoff_at)
    if (!Number.isFinite(kickoffMs) || kickoffMs <= nowMs) continue
    if (row.prediction_quarantined || row.decision !== 'BET' || !row.bookmaker) continue

    ids.add(row.id)
    const code = row.bookmaker.toUpperCase()
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return { currentBetRecommendationIds: ids, currentBetCountsByBook: counts }
}

export function mapBookmakers(
  payload: unknown,
  currentCounts?: ReadonlyMap<string, number>,
): readonly BookmakerSummary[] {
  const body = (payload ?? {}) as { bookmakers?: RawBook[] }
  return (body.bookmakers ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    kind: kind(row.kind),
    isRealPrice: Boolean(row.is_real_price),
    exchangeCommission: num(row.exchange_commission),
    legs: currentCounts?.get(row.code.toUpperCase()) ?? num(row.legs) ?? 0,
    lastDecidedAt: row.last_decided_at,
  }))
}

export function filterCandidatePayloadToCurrentDecisions(
  payload: unknown,
  currentBetRecommendationIds: ReadonlySet<string>,
): unknown {
  const body = (payload ?? {}) as {
    legs?: RawLeg[]
    leg_count?: number
    [key: string]: unknown
  }
  const legs = (body.legs ?? []).filter((row) => currentBetRecommendationIds.has(row.recommendation_id))
  return { ...body, legs, leg_count: legs.length }
}

export function mapCandidates(payload: unknown): BetBuilderCandidates {
  const body = (payload ?? {}) as {
    bookmaker?: RawBook
    legs?: RawLeg[]
    leg_count?: number
    truncated_at?: number
    window?: { from: string; to: string }
    generated_at?: string
  }
  const book = body.bookmaker
  return {
    bookmaker: {
      code: book?.code ?? '',
      name: book?.name ?? '',
      kind: kind(book?.kind ?? ''),
      isRealPrice: Boolean(book?.is_real_price),
      exchangeCommission: num(book?.exchange_commission ?? null),
    },
    legs: (body.legs ?? []).map((row) => ({
      fixtureId: row.fixture_id,
      league: row.league,
      home: row.home_canonical,
      away: row.away_canonical,
      kickoffAt: row.kickoff_at,
      selection: (row.selection === 'D' || row.selection === 'A'
        ? row.selection
        : 'H') as Leg['selection'],
      odds: num(row.odds) ?? 0,
      probability: num(row.calibrated_prob) ?? 0,
      bookmaker: row.bookmaker,
      dataConfidence: num(row.data_confidence),
      dataConfidenceState: row.data_confidence_state,
      agreement: num(row.agreement_score),
      uncertaintyWidth: num(row.uncertainty_width),
      capturedAt: row.odds_captured_at,
      priceAgeSeconds: num(row.price_age_seconds),
      priceAgeLimitSeconds: num(row.price_age_limit_seconds),
      usesMarket: Boolean(row.uses_market),
    })),
    legCount: body.leg_count ?? 0,
    truncatedAt: body.truncated_at ?? 0,
    window: body.window ?? { from: '', to: '' },
    generatedAt: body.generated_at ?? '',
  }
}

/**
 * Hosted Development and Production both expose this Contract-190 RPC, but the
 * generated Database type file still predates the function. Keep that known
 * generator lag behind one narrow, named adapter rather than spreading `any`
 * or raw REST calls through the UI. Once generated types catch up, this cast can
 * disappear without changing callers.
 */
const recommendationLogRpc = db.rpc.bind(db) as unknown as RecommendationLogRpc

async function fetchCurrentDecisionSnapshot(): Promise<DecisionSnapshot> {
  // Fetch per league rather than using one global 500-row page. The value loop
  // can refresh frequently near kickoff; a global page could otherwise be
  // consumed by newer rows from other leagues and hide an upcoming fixture's
  // latest decision. Each per-league response remains newest-first.
  const responses = await Promise.all(
    AI_LAB_LEAGUES.map(({ key }) => recommendationLogRpc('admin_ai_recommendation_log', {
      p_league: key,
      p_limit: 500,
    })),
  )

  const recommendations: RawDecision[] = []
  for (const { data, error } of responses) {
    if (error) throw error
    const body = (data ?? {}) as { recommendations?: RawDecision[] }
    recommendations.push(...(body.recommendations ?? []))
  }
  return currentBetDecisionSnapshot({ recommendations })
}

export async function fetchBetBuilderBookmakers(): Promise<readonly BookmakerSummary[]> {
  const [{ data, error }, decisions] = await Promise.all([
    db.rpc('admin_ai_bet_builder_books'),
    fetchCurrentDecisionSnapshot(),
  ])
  if (error) throw error
  return mapBookmakers(data, decisions.currentBetCountsByBook)
}

export async function fetchBetBuilderCandidates(options: {
  bookmaker: string
  leagues: readonly string[] | null
  from: Date
  to: Date
}): Promise<BetBuilderCandidates> {
  const [{ data, error }, decisions] = await Promise.all([
    db.rpc('admin_ai_bet_builder_candidates', {
      p_bookmaker: options.bookmaker,
      p_leagues: options.leagues && options.leagues.length ? [...options.leagues] : undefined,
      p_from: options.from.toISOString(),
      p_to: options.to.toISOString(),
      p_limit: 200,
    }),
    fetchCurrentDecisionSnapshot(),
  ])
  if (error) throw error
  const current = filterCandidatePayloadToCurrentDecisions(
    data,
    decisions.currentBetRecommendationIds,
  )
  return mapCandidates(current)
}
