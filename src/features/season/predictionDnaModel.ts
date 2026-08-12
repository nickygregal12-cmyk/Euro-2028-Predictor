import type { SeasonPlayerProfile } from '../../services/supabase/seasonPlayerProfileModel'

/**
 * `INNOV-002` — Prediction DNA: how this player predicts, from their own
 * recorded predictions and nothing else.
 *
 * IT DESCRIBES BEHAVIOUR, NEVER A PERSON. Every label here is a statement about
 * scorelines a player typed — how many goals, how often a draw, which side they
 * back — and none of them is a personality claim, a psychological reading or a
 * prediction about what they will do next. "Predicts 3.1 goals a match" is a
 * measurement; "you are an optimist" is not, and the difference is the whole
 * guardrail.
 *
 * IT IS PRESENTATION AND CHANGES NOTHING. No metric here feeds points, rank,
 * matchmaking or eligibility. It reads the same profile the page is already
 * showing.
 *
 * SAMPLE SIZE IS STATED RATHER THAN ASSUMED. Every metric carries the number of
 * predictions it was measured over, and below `MINIMUM_SAMPLE` the whole profile
 * reports itself as insufficient instead of quoting a percentage taken from
 * four matches. A confident figure over a tiny sample is worse than no figure,
 * because a reader cannot tell it apart from a real one.
 *
 * WHAT IT DELIBERATELY CANNOT MEASURE, AND WHY. Contract 151's history is keyed
 * by fixture id and carries no clubs, no results and no kickoff order, so:
 * favourite-backing and upset tendency have no favourite to compare against;
 * team-specific tendencies have no team; and exact-score RATE per prediction
 * type cannot be split by anything about the match. The season-wide exact and
 * correct counts come from the read's own accuracy block, which is the server's
 * derivation over settled matchweeks. The rest is recorded as a backend
 * dependency in `docs/product/innovation-lab.md` rather than approximated here.
 *
 * PURE.
 */

/**
 * Below this many predictions, the profile answers "not enough yet" instead of
 * quoting a share. Ten fixtures is roughly one matchweek: enough that a figure
 * is describing a habit rather than one afternoon.
 */
export const MINIMUM_SAMPLE = 10

export type DnaMetric = {
  key: string
  label: string
  /** The figure, already formatted — "3.1", "42%", "2 – 1". */
  value: string
  /** What the figure means, in football terms. Never a personality claim. */
  detail: string
}

export type PredictionDna =
  | { available: false; reason: 'not_entered' | 'insufficient_sample'; predictions: number }
  | {
      available: true
      /** How many scorelines every share below was measured over. */
      predictions: number
      /** Matchweeks the predictions came from. */
      matchweeks: number
      metrics: readonly DnaMetric[]
      /**
       * A short, literal descriptor derived from the metrics — "Goals
       * optimist", "Draw backer". It is a NAME FOR A MEASUREMENT and is always
       * printed beside the measurement it came from.
       */
      signature: string
    }

type Tally = {
  predictions: number
  homeWins: number
  draws: number
  awayWins: number
  goals: number
  scorelines: Map<string, number>
}

function tally(profile: SeasonPlayerProfile): { tally: Tally; matchweeks: number } {
  const counts: Tally = {
    predictions: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    goals: 0,
    scorelines: new Map(),
  }
  let matchweeks = 0

  for (const matchweek of profile.history) {
    const entries = Object.values(matchweek.predictions)
    if (entries.length > 0) matchweeks += 1
    for (const prediction of entries) {
      if (!Number.isInteger(prediction.home) || !Number.isInteger(prediction.away)) continue
      counts.predictions += 1
      counts.goals += prediction.home + prediction.away
      if (prediction.home > prediction.away) counts.homeWins += 1
      else if (prediction.home < prediction.away) counts.awayWins += 1
      else counts.draws += 1
      const key = `${prediction.home}-${prediction.away}`
      counts.scorelines.set(key, (counts.scorelines.get(key) ?? 0) + 1)
    }
  }

  return { tally: counts, matchweeks }
}

const share = (count: number, total: number): number =>
  total > 0 ? Math.round((count / total) * 100) : 0

function mostUsed(scorelines: Map<string, number>): { label: string; picks: number } | null {
  let best: { label: string; picks: number } | null = null
  for (const [key, picks] of scorelines) {
    // Ties break on the scoreline itself so two renders cannot disagree. It
    // ranks nothing competitive; it decides which of two equal counts prints.
    if (best === null || picks > best.picks || (picks === best.picks && key < best.label)) {
      best = { label: key, picks }
    }
  }
  if (!best) return null
  const [home, away] = best.label.split('-')
  return { label: `${home} – ${away}`, picks: best.picks }
}

/**
 * A literal name for the strongest measured tendency.
 *
 * IT IS DERIVED FROM ONE NUMBER AND SAYS WHICH. Nothing here blends metrics
 * into a "type"; the first threshold that a measurement crosses supplies the
 * word, and the surface prints the measurement beside it.
 */
function signatureOf(goalsPerMatch: number, drawShare: number, homeShare: number): string {
  if (goalsPerMatch >= 3) return 'Goals optimist'
  if (goalsPerMatch <= 2) return 'Low-scoring caller'
  if (drawShare >= 25) return 'Draw backer'
  if (homeShare >= 60) return 'Home backer'
  if (homeShare <= 30) return 'Away backer'
  return 'Balanced predictor'
}

export function presentPredictionDna(profile: SeasonPlayerProfile): PredictionDna {
  if (!profile.entered) {
    return { available: false, reason: 'not_entered', predictions: 0 }
  }

  const { tally: counts, matchweeks } = tally(profile)
  if (counts.predictions < MINIMUM_SAMPLE) {
    return {
      available: false,
      reason: 'insufficient_sample',
      predictions: counts.predictions,
    }
  }

  const goalsPerMatch = counts.goals / counts.predictions
  const homeShare = share(counts.homeWins, counts.predictions)
  const drawShare = share(counts.draws, counts.predictions)
  const awayShare = share(counts.awayWins, counts.predictions)
  const favourite = mostUsed(counts.scorelines)
  const accuracy = profile.accuracy

  const metrics: DnaMetric[] = [
    {
      key: 'goals',
      label: 'Goals predicted',
      value: goalsPerMatch.toFixed(1),
      detail: `per match, across ${counts.predictions} predictions`,
    },
    {
      key: 'home',
      label: 'Home wins backed',
      value: `${homeShare}%`,
      detail: `${counts.homeWins} of ${counts.predictions} predictions`,
    },
    {
      key: 'draw',
      label: 'Draws backed',
      value: `${drawShare}%`,
      detail: `${counts.draws} of ${counts.predictions} predictions`,
    },
    {
      key: 'away',
      label: 'Away wins backed',
      value: `${awayShare}%`,
      detail: `${counts.awayWins} of ${counts.predictions} predictions`,
    },
  ]

  if (favourite) {
    metrics.push({
      key: 'scoreline',
      label: 'Most-used scoreline',
      value: favourite.label,
      detail: `used ${favourite.picks} ${favourite.picks === 1 ? 'time' : 'times'}`,
    })
  }

  // The accuracy block is the SERVER's derivation over settled matchweeks, and
  // its denominator is settled predictions rather than the predictions counted
  // above — which include matchweeks that have not settled. Printing them as
  // one rate would divide two different populations.
  if (accuracy && accuracy.fixturesPredicted > 0) {
    metrics.push(
      {
        key: 'exact',
        label: 'Exact scores',
        value: `${share(accuracy.exactScores, accuracy.fixturesPredicted)}%`,
        detail: `${accuracy.exactScores} of ${accuracy.fixturesPredicted} settled predictions`,
      },
      {
        key: 'correct',
        label: 'Correct results',
        value: `${share(accuracy.correctOutcomes, accuracy.fixturesPredicted)}%`,
        detail: `${accuracy.correctOutcomes} of ${accuracy.fixturesPredicted} settled predictions`,
      },
    )
  }

  return {
    available: true,
    predictions: counts.predictions,
    matchweeks,
    metrics,
    signature: signatureOf(goalsPerMatch, drawShare, homeShare),
  }
}

export type DnaComparisonLine = {
  key: string
  label: string
  mine: string
  theirs: string
  /** One sentence about the difference, or null where there is nothing to say. */
  difference: string | null
}

/**
 * Two players' DNA side by side.
 *
 * IT COMPARES ONLY WHAT BOTH SIDES MEASURED. A metric present for one player
 * and absent for the other is dropped rather than compared against nothing, and
 * a pair where either side has too small a sample produces no comparison at
 * all — the caller renders the insufficient-sample state instead.
 *
 * THE DIFFERENCE SENTENCE IS ABOUT THE NUMBERS AND NOTHING ELSE: "18% more
 * goals" is arithmetic; "bolder than Craig" is a judgement and is not made.
 */
export function compareDna(
  mine: PredictionDna,
  theirs: PredictionDna,
  theirName: string,
): readonly DnaComparisonLine[] {
  if (!mine.available || !theirs.available) return []
  const byKey = new Map(theirs.metrics.map((metric) => [metric.key, metric]))

  return mine.metrics.flatMap((metric) => {
    const other = byKey.get(metric.key)
    if (!other) return []
    return [
      {
        key: metric.key,
        label: metric.label,
        mine: metric.value,
        theirs: other.value,
        difference: differenceOf(metric, other, theirName),
      },
    ]
  })
}

function differenceOf(mine: DnaMetric, theirs: DnaMetric, theirName: string): string | null {
  const a = Number.parseFloat(mine.value)
  const b = Number.parseFloat(theirs.value)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null

  if (mine.key === 'goals') {
    const percent = Math.round(((a - b) / b) * 100)
    if (percent === 0) return `The same as ${theirName}.`
    return percent > 0
      ? `${percent}% more goals than ${theirName}.`
      : `${Math.abs(percent)}% fewer goals than ${theirName}.`
  }

  const points = Math.round(a - b)
  if (points === 0) return `The same as ${theirName}.`
  return points > 0
    ? `${points} points higher than ${theirName}.`
    : `${Math.abs(points)} points lower than ${theirName}.`
}
