import type { AiResultsReview, CoverageFixture } from '../../services/supabase/aiLabCoverageModel'

type OutcomeKey = 'H' | 'D' | 'A'

export type ForecastVerdict = {
  readonly key: OutcomeKey
  readonly label: string
  readonly probability: number
}

export type ValueVerdict =
  | { readonly kind: 'awaiting'; readonly headline: string; readonly explanation: string }
  | { readonly kind: 'pass'; readonly headline: string; readonly explanation: string }
  | {
      readonly kind: 'bet'
      readonly headline: string
      readonly explanation: string
      readonly alignedWithForecast: boolean
      readonly selectionLabel: string
    }

function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

// Not exported: used only by the verdict helpers below. The Lab's rebuilt
// surfaces render their own labels, so exporting this left a name nothing
// imported while the function itself is still doing work here.
function outcomeLabel(key: string, fixture: Pick<CoverageFixture, 'home' | 'away'>): string {
  if (key === 'H') return fixture.home
  if (key === 'A') return fixture.away
  if (key === 'D') return 'Draw'
  return 'Unknown'
}

export function forecastVerdict(fixture: CoverageFixture): ForecastVerdict | null {
  const prediction = fixture.prediction
  if (!prediction) return null
  const candidates: readonly [OutcomeKey, number | null][] = [
    ['H', prediction.pHome],
    ['D', prediction.pDraw],
    ['A', prediction.pAway],
  ]
  const known = candidates.filter((entry): entry is [OutcomeKey, number] => entry[1] !== null)
  if (!known.length) return null
  const [key, probability] = known.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  )
  return { key, probability, label: outcomeLabel(key, fixture) }
}

export function valueVerdict(fixture: CoverageFixture): ValueVerdict {
  const forecast = forecastVerdict(fixture)
  const decision = fixture.decision

  if (!decision) {
    return {
      kind: 'awaiting',
      headline: 'Awaiting value refresh',
      explanation:
        'The current forecast does not yet have a current BET/PASS decision. Older advice is deliberately not reused across forecast versions.',
    }
  }

  if (decision.decision === 'PASS') {
    return {
      kind: 'pass',
      headline: 'No bet',
      explanation:
        decision.reasons[0]?.explanation ||
        'The current selection did not clear every price, evidence and uncertainty gate.',
    }
  }

  const selection = decision.selection ?? ''
  const selectionLabel = outcomeLabel(selection, fixture)
  const aligned = forecast?.key === selection
  const price = decision.oddsOffered === null ? 'the available price' : decision.oddsOffered.toFixed(2)
  const modelProbability = decision.modelProbability
  const marketProbability = decision.marketFairProbability

  let explanation: string
  if (forecast && modelProbability !== null && marketProbability !== null) {
    explanation = aligned
      ? `${forecast.label} is the most likely result at ${pct(forecast.probability)} and the price still looks generous: the model gives ${selectionLabel.toLowerCase()} ${pct(modelProbability)} versus the market's fair ${pct(marketProbability)}.`
      : `${forecast.label} remains the most likely result at ${pct(forecast.probability)}. ${selectionLabel} is the value call only because the model gives it ${pct(modelProbability)} versus the market's fair ${pct(marketProbability)} at ${price}.`
  } else if (modelProbability !== null) {
    explanation = `${selectionLabel} cleared the value gate at ${price} with a model probability of ${pct(modelProbability)}. This is a price decision, not a guarantee it is the most likely result.`
  } else {
    explanation = `${selectionLabel} cleared the server-owned value gate at ${price}.`
  }

  return {
    kind: 'bet',
    headline: aligned ? 'Forecast + value aligned' : 'Contrarian value',
    explanation,
    alignedWithForecast: aligned,
    selectionLabel,
  }
}

export type ScorelineHealth = {
  readonly sample: number
  readonly topScore: string | null
  readonly topCount: number
  readonly share: number
  readonly concerning: boolean
}

/**
 * Exact score is an auxiliary modal-scoreline output, not the 1X2 forecast.
 * Repetition is useful health evidence: a score head that says 1-1 for nearly
 * every fixture is not adding useful team-level discrimination even when the
 * underlying result probabilities remain healthy.
 */
export function scorelineHealth(fixtures: readonly CoverageFixture[]): ScorelineHealth {
  const scores = fixtures.flatMap((fixture) => {
    const score = fixture.prediction?.predictedScore
    return score ? [score.replace('–', '-')] : []
  })
  if (!scores.length) return { sample: 0, topScore: null, topCount: 0, share: 0, concerning: false }

  const counts = new Map<string, number>()
  for (const score of scores) counts.set(score, (counts.get(score) ?? 0) + 1)
  const top = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0] ?? null
  const topScore = top?.[0] ?? null
  const topCount = top?.[1] ?? 0
  const share = topCount / scores.length
  return {
    sample: scores.length,
    topScore,
    topCount,
    share,
    concerning: scores.length >= 10 && share >= 0.7,
  }
}

export type MarketComparison = {
  readonly model: number
  readonly market: number
  readonly gap: number
  readonly comparisons: number
  readonly ahead: boolean
}

export function marketComparison(review: AiResultsReview): MarketComparison | null {
  const model = review.totals.meanLogLoss
  const market = review.totals.meanMarketLogLoss
  if (model === null || market === null || review.totals.marketComparisons < 1) return null
  const gap = model - market
  return {
    model,
    market,
    gap,
    comparisons: review.totals.marketComparisons,
    ahead: gap < 0,
  }
}
