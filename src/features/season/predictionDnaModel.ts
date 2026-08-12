import type {
  DnaClub,
  SeasonPredictionDna,
} from '../../services/supabase/seasonPredictionDnaModel'

/**
 * `INNOV-002` — Prediction DNA, PRESENTED from contract 176.
 *
 * WHAT CHANGED. This module used to derive the whole profile in the browser
 * from contract 151's prediction history, because contract 176 was written and
 * not hosted. That history is keyed by fixture id and carries no clubs, no
 * field and no per-fixture results, so three of the things a DNA panel is for
 * were simply absent — agreement with the field, per-club tendency, and a
 * single denominator every share could be quoted against. It is hosted now, so
 * every count, rate and denominator below arrives from the server and this
 * module decides what to say about them.
 *
 * IT DESCRIBES BEHAVIOUR, NEVER A PERSON. Every label here is a statement about
 * scorelines a player typed — how many goals, how often a draw, which side they
 * back, how often they went against the field. None of them is a personality
 * claim, a psychological reading or a prediction about what they will do next.
 * "Predicts 3.1 goals a match" is a measurement; "you are an optimist" is not,
 * and the difference is the whole guardrail.
 *
 * IT IS PRESENTATION AND CHANGES NOTHING. No metric feeds points, rank,
 * matchmaking or eligibility, and no point value appears in this file or in the
 * contract behind it. Counting how often a prediction matched a result is a
 * fact about predictions; what a matchweek was WORTH stays
 * `season_matchweek_scores`.
 *
 * EVERY GROUP CARRIES ITS OWN DENOMINATOR AND THE SERVER'S OWN VERDICT ON IT.
 * Tendencies are measured over locked predictions, accuracy over PLAYED ones,
 * and agreement over the smaller set that cleared contract 61's cohort. Those
 * are three different populations and are never printed as one: a group whose
 * `sufficient` flag is false shows its counts and states the shortfall rather
 * than quoting a confident-looking rate.
 *
 * NOTHING IS ROUNDED INTO EXISTENCE. A rate the server sent as null renders no
 * metric at all, rather than a 0% that reads as a measured habit.
 *
 * PURE.
 */

export type DnaMetric = {
  key: string
  label: string
  /** The figure, already formatted — "3.1", "42%", "2 – 1". */
  value: string
  /** What the figure means, in football terms. Never a personality claim. */
  detail: string
}

export type DnaGroupKey = 'tendencies' | 'accuracy' | 'consensus'

export type DnaGroup = {
  key: DnaGroupKey
  title: string
  /** What everything in this group was measured over. */
  denominator: number
  /** The word for that denominator — "predictions", "settled predictions". */
  denominatorNoun: string
  /** The server's verdict against its one stated minimum. */
  sufficient: boolean
  metrics: readonly DnaMetric[]
  /** Stated when the group is short of the minimum. Null when it is not. */
  caution: string | null
}

export type DnaClubLine = {
  teamId: string
  name: string
  /** "Backed to win 7 of 9 times". */
  backing: string
  /** "3 exact, 6 right result of 9 settled", or null with nothing settled. */
  accuracy: string | null
  /** False where this club's settled sample is below the minimum. */
  sufficient: boolean
}

export type PredictionDna =
  | {
      available: false
      reason: 'not_entered' | 'no_locked_predictions'
      playerName: string
      isSelf: boolean
      /** How many predictions are counted so far. Zero when not entered. */
      predictions: number
      minimumSample: number
    }
  | {
      available: true
      playerName: string
      isSelf: boolean
      predictions: number
      settledPredictions: number
      minimumSample: number
      groups: readonly DnaGroup[]
      /** Bounded, most-predicted first, as the server ordered them. */
      clubs: readonly DnaClubLine[]
      /**
       * A short, literal descriptor derived from the tendency block — "Goals
       * optimist", "Draw backer". It is a NAME FOR A MEASUREMENT and is always
       * printed beside the measurement it came from. Null when the tendency
       * sample is too small to name anything.
       */
      signature: string | null
    }

const percent = (rate: number): string => `${Math.round(rate * 100)}%`

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? one : many

/**
 * A literal name for the strongest measured tendency.
 *
 * IT IS DERIVED FROM ONE NUMBER AND SAYS WHICH. Nothing here blends metrics
 * into a "type"; the first threshold a measurement crosses supplies the word,
 * and the surface prints the measurement beside it.
 */
function signatureOf(
  goalsPerMatch: number | null,
  drawRate: number | null,
  homeRate: number | null,
): string | null {
  if (goalsPerMatch !== null && goalsPerMatch >= 3) return 'Goals optimist'
  if (goalsPerMatch !== null && goalsPerMatch <= 2) return 'Low-scoring caller'
  if (drawRate !== null && drawRate >= 0.25) return 'Draw backer'
  if (homeRate !== null && homeRate >= 0.6) return 'Home backer'
  if (homeRate !== null && homeRate <= 0.3) return 'Away backer'
  // Every threshold needs a number to compare against. With none of them
  // measured there is nothing to name, and inventing "Balanced" would be a
  // description of a missing measurement.
  return goalsPerMatch === null && drawRate === null && homeRate === null
    ? null
    : 'Balanced predictor'
}

function tendencyGroup(dna: SeasonPredictionDna): DnaGroup | null {
  const block = dna.tendencies
  if (block === null || block.denominator === 0) return null

  const metrics: DnaMetric[] = []

  if (block.averagePredictedGoals !== null) {
    metrics.push({
      key: 'goals',
      label: 'Goals predicted',
      value: block.averagePredictedGoals.toFixed(1),
      detail: `per match, across ${block.denominator} ${plural(block.denominator, 'prediction', 'predictions')}`,
    })
  }
  if (block.homeWinRate !== null) {
    metrics.push({
      key: 'home',
      label: 'Home wins backed',
      value: percent(block.homeWinRate),
      detail: `${block.homeWins} of ${block.denominator}`,
    })
  }
  if (block.drawRate !== null) {
    metrics.push({
      key: 'draw',
      label: 'Draws backed',
      value: percent(block.drawRate),
      detail: `${block.draws} of ${block.denominator}`,
    })
  }
  if (block.awayWinRate !== null) {
    metrics.push({
      key: 'away',
      label: 'Away wins backed',
      value: percent(block.awayWinRate),
      detail: `${block.awayWins} of ${block.denominator}`,
    })
  }
  if (block.mostCommonScoreline) {
    const top = block.mostCommonScoreline
    metrics.push({
      key: 'scoreline',
      label: 'Most-used scoreline',
      value: `${top.home} – ${top.away}`,
      detail: `used ${top.count} ${plural(top.count, 'time', 'times')}`,
    })
  }

  if (metrics.length === 0) return null

  return {
    key: 'tendencies',
    title: 'How they predict',
    denominator: block.denominator,
    denominatorNoun: plural(block.denominator, 'locked prediction', 'locked predictions'),
    sufficient: block.sufficient,
    metrics,
    caution: block.sufficient
      ? null
      : `Measured over ${block.denominator} ${plural(block.denominator, 'prediction', 'predictions')}. Habits settle after ${dna.minimumSample}.`,
  }
}

function accuracyGroup(dna: SeasonPredictionDna): DnaGroup | null {
  const block = dna.accuracy
  if (block === null || block.denominator === 0) return null

  const metrics: DnaMetric[] = []
  if (block.exactScoreRate !== null) {
    metrics.push({
      key: 'exact',
      label: 'Exact scores',
      value: percent(block.exactScoreRate),
      detail: `${block.exactScores} of ${block.denominator} settled`,
    })
  }
  if (block.correctOutcomeRate !== null) {
    metrics.push({
      key: 'correct',
      label: 'Right result',
      value: percent(block.correctOutcomeRate),
      detail: `${block.correctOutcomes} of ${block.denominator} settled`,
    })
  }
  if (metrics.length === 0) return null

  return {
    key: 'accuracy',
    title: 'How often they are right',
    denominator: block.denominator,
    denominatorNoun: plural(block.denominator, 'settled prediction', 'settled predictions'),
    sufficient: block.sufficient,
    metrics,
    caution: block.sufficient
      ? null
      : `Only ${block.denominator} ${plural(block.denominator, 'prediction has', 'predictions have')} been settled. Rates settle after ${dna.minimumSample}.`,
  }
}

function consensusGroup(dna: SeasonPredictionDna): DnaGroup | null {
  const block = dna.consensus
  if (block === null || block.measured === 0) return null

  const metrics: DnaMetric[] = []
  if (block.agreementRate !== null) {
    metrics.push({
      key: 'agreement',
      label: 'Went with the field',
      value: percent(block.agreementRate),
      detail: `${block.agreedWithField} of ${block.measured} comparable fixtures`,
    })
  }
  if (block.againstFieldSuccessRate !== null) {
    metrics.push({
      key: 'against',
      label: 'Right when going against it',
      value: percent(block.againstFieldSuccessRate),
      detail: `${block.againstFieldCorrect} of ${block.againstField} times`,
    })
  }
  if (metrics.length === 0) return null

  // What was left out, and why. A fixture the field split evenly on has no
  // consensus to agree or disagree with, and one below the cohort is protected
  // rather than measured — both are excluded, and a rate quoted without saying
  // so reads as though it covered the whole season.
  const excluded = block.excludedSmallCohort + block.excludedNoConsensus

  return {
    key: 'consensus',
    title: 'With the crowd, or against it',
    denominator: block.measured,
    denominatorNoun: plural(block.measured, 'comparable fixture', 'comparable fixtures'),
    sufficient: block.sufficient,
    metrics,
    caution:
      !block.sufficient || excluded > 0
        ? [
            block.sufficient
              ? null
              : `Measured over ${block.measured} ${plural(block.measured, 'fixture', 'fixtures')}; ${dna.minimumSample} are needed.`,
            excluded > 0
              ? `${excluded} ${plural(excluded, 'fixture is', 'fixtures are')} not comparable — fewer than ${block.minimumCohort} players predicted it, or the field was split evenly.`
              : null,
          ]
            .filter((line): line is string => line !== null)
            .join(' ')
        : null,
  }
}

function clubLine(club: DnaClub): DnaClubLine {
  return {
    teamId: club.teamId,
    name: club.name,
    backing: `Backed to win ${club.predictedToWin} of ${club.predictions} ${plural(club.predictions, 'time', 'times')}`,
    accuracy:
      club.settled === 0
        ? null
        : `${club.exactScores} exact, ${club.correctOutcomes} right result of ${club.settled} settled`,
    sufficient: club.sufficient,
  }
}

export function presentPredictionDna(dna: SeasonPredictionDna): PredictionDna {
  const playerName = dna.player.displayName
  const isSelf = dna.player.isSelf

  if (!dna.entered) {
    return {
      available: false,
      reason: 'not_entered',
      playerName,
      isSelf,
      predictions: 0,
      minimumSample: dna.minimumSample,
    }
  }

  const groups = [tendencyGroup(dna), accuracyGroup(dna), consensusGroup(dna)].filter(
    (group): group is DnaGroup => group !== null,
  )

  // Entered, but nothing has locked yet. That is a real state and a different
  // sentence from "not entered": the player has predicted and the window has
  // not opened on any of it.
  if (groups.length === 0) {
    return {
      available: false,
      reason: 'no_locked_predictions',
      playerName,
      isSelf,
      predictions: dna.predictionsCounted,
      minimumSample: dna.minimumSample,
    }
  }

  const tendencies = dna.tendencies

  return {
    available: true,
    playerName,
    isSelf,
    predictions: dna.predictionsCounted,
    settledPredictions: dna.settledPredictions,
    minimumSample: dna.minimumSample,
    groups,
    clubs: dna.clubs.map(clubLine),
    // Named only when the tendency block cleared its own minimum. A one-word
    // label over four predictions is the confident-looking claim the sample
    // rules exist to stop, and it is the part a player would repeat.
    signature:
      tendencies && tendencies.sufficient
        ? signatureOf(
            tendencies.averagePredictedGoals,
            tendencies.drawRate,
            tendencies.homeWinRate,
          )
        : null,
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
 * a group either side reported as insufficient contributes no lines — comparing
 * a settled habit with a four-match sample is the same false confidence with an
 * extra column.
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

  const sufficientMetrics = (dna: Extract<PredictionDna, { available: true }>) =>
    new Map(
      dna.groups
        .filter((group) => group.sufficient)
        .flatMap((group) => group.metrics.map((metric) => [metric.key, metric] as const)),
    )

  const theirMetrics = sufficientMetrics(theirs)

  return [...sufficientMetrics(mine).values()].flatMap((metric) => {
    const other = theirMetrics.get(metric.key)
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
    const share = Math.round(((a - b) / b) * 100)
    if (share === 0) return `The same as ${theirName}.`
    return share > 0
      ? `${share}% more goals than ${theirName}.`
      : `${Math.abs(share)}% fewer goals than ${theirName}.`
  }

  const points = Math.round(a - b)
  if (points === 0) return `The same as ${theirName}.`
  return points > 0
    ? `${points} points higher than ${theirName}.`
    : `${Math.abs(points)} points lower than ${theirName}.`
}
