import type { Bookmaker, Leg } from '../../domain/ai/betBuilder'
import { db } from './client'

/**
 * The Bet Builder's two bounded reads.
 *
 * The browser never queries schema `ai`. Both RPCs are `security definer` on
 * `require_competition_admin`, and `admin_ai_bet_builder_candidates` returns
 * rows of `ai.recommendations` where `decision = 'BET'` joined through
 * `ai.valid_predictions` — so a PASS is absent rather than filtered, and a
 * quarantined forecast is absent rather than flagged. The presentation layer
 * cannot reach either.
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

export function mapBookmakers(payload: unknown): readonly BookmakerSummary[] {
  const body = (payload ?? {}) as { bookmakers?: RawBook[] }
  return (body.bookmakers ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    kind: kind(row.kind),
    isRealPrice: Boolean(row.is_real_price),
    exchangeCommission: num(row.exchange_commission),
    legs: num(row.legs) ?? 0,
    lastDecidedAt: row.last_decided_at,
  }))
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

export async function fetchBetBuilderBookmakers(): Promise<readonly BookmakerSummary[]> {
  const { data, error } = await db.rpc('admin_ai_bet_builder_books')
  if (error) throw error
  return mapBookmakers(data)
}

export async function fetchBetBuilderCandidates(options: {
  bookmaker: string
  leagues: readonly string[] | null
  from: Date
  to: Date
}): Promise<BetBuilderCandidates> {
  const { data, error } = await db.rpc('admin_ai_bet_builder_candidates', {
    p_bookmaker: options.bookmaker,
    p_leagues: options.leagues && options.leagues.length ? [...options.leagues] : null,
    p_from: options.from.toISOString(),
    p_to: options.to.toISOString(),
    p_limit: 200,
  })
  if (error) throw error
  return mapCandidates(data)
}
