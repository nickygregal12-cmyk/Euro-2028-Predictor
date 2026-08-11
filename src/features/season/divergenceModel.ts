import type { SeasonConsensusFixture } from '../../services/supabase/seasonConsensusModel'

/**
 * `INNOV-011` — how unusual the player's own pick was, against the anonymous
 * community consensus.
 *
 * IT ADDS NO READ AND NO AUTHORITY. Contract 130 already returns the three-way
 * outcome counts and the most-predicted scorelines for a matchweek, and enforces
 * its own reveal rule and its own minimum cohort of ten. This module compares
 * the player's prediction with numbers that were already on the page. It cannot
 * be reached before the lock because the read it consumes raises until then.
 *
 * IT NAMES NOBODY AND INFERS NOBODY. Every input is a count over a cohort. It
 * produces shares and words; it never divides a cohort small enough to identify
 * a person, because it never divides the cohort at all.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. "Your prediction was more aggressive than
 * 86% of players" needs the distribution of predicted goals across the whole
 * cohort, and contract 130 returns at most five scorelines. Ranking the player
 * against a five-row sample would be a confident sentence about a number nobody
 * measured, so the goals comparison is absent rather than approximated. The
 * backend dependency is recorded in `docs/product/innovation-lab.md`.
 *
 * A CONTRARIAN WIN IS ONLY EVER CLAIMED FROM A CONFIRMED RESULT. The consensus
 * read carries the result only once the fixture is played, and this module says
 * nothing about outcomes until it does — a low-consensus pick that is currently
 * winning is not a win.
 *
 * PURE.
 */

export type DivergenceOutcome = 'home' | 'draw' | 'away'

/** Where the pick sits against the field. Bands are stated, not felt. */
export type DivergenceBand = 'with_the_field' | 'split' | 'against_the_field'

/**
 * At or below this share, a pick is "against the field". Chosen to sit below a
 * three-way even split (33%) by a clear margin so an ordinary spread of
 * opinions is not reported as bravery.
 */
export const CONTRARIAN_SHARE_CEILING = 25

/** Above this share, the pick is what nearly everybody did. */
export const CONSENSUS_SHARE_FLOOR = 60

export type DivergenceView = {
  /** The outcome the player predicted. */
  outcome: DivergenceOutcome
  /** "a Chelsea win", "a draw" — the outcome named in football terms. */
  outcomeLabel: string
  /** Percentage of the cohort that predicted the same outcome. */
  outcomeShare: number
  /** How many predicted this fixture at all. The denominator, stated. */
  cohort: number
  band: DivergenceBand
  /** One sentence about the outcome. Always present. */
  headline: string
  /**
   * How many players picked the identical scoreline, when it appears among the
   * server's most-predicted list. Null means "not in the top few", which is a
   * different statement from zero and is worded as such.
   */
  scorelinePicks: number | null
  scorelineLine: string
  /** True only for a confirmed result the player got right from a low share. */
  contrarianWin: boolean
  /** Present only once the fixture is confirmed. */
  resultLine: string | null
}

function outcomeOf(score: { home: number; away: number }): DivergenceOutcome {
  if (score.home > score.away) return 'home'
  if (score.home < score.away) return 'away'
  return 'draw'
}

function labelFor(
  outcome: DivergenceOutcome,
  homeName: string,
  awayName: string,
): string {
  if (outcome === 'draw') return 'a draw'
  return outcome === 'home' ? `a ${homeName} win` : `a ${awayName} win`
}

function bandFor(share: number): DivergenceBand {
  if (share <= CONTRARIAN_SHARE_CEILING) return 'against_the_field'
  if (share >= CONSENSUS_SHARE_FLOOR) return 'with_the_field'
  return 'split'
}

/**
 * Null when there is nothing meaningful to say: no prediction, or a consensus
 * row whose cohort is empty. Both render nothing rather than a sentence about
 * an absent denominator.
 */
export function presentDivergence(
  fixture: SeasonConsensusFixture,
  prediction: { home: number; away: number } | null,
): DivergenceView | null {
  if (!prediction) return null
  if (!Number.isInteger(prediction.home) || !Number.isInteger(prediction.away)) return null
  if (fixture.predicted <= 0) return null

  const outcome = outcomeOf(prediction)
  const outcomeShare =
    outcome === 'home'
      ? fixture.shares.homeWin
      : outcome === 'away'
        ? fixture.shares.awayWin
        : fixture.shares.draw
  const outcomeLabel = labelFor(outcome, fixture.homeName, fixture.awayName)
  const band = bandFor(outcomeShare)

  const sameScoreline =
    fixture.topScores.find(
      (score) => score.home === prediction.home && score.away === prediction.away,
    ) ?? null

  const result =
    fixture.resultHome !== null && fixture.resultAway !== null
      ? { home: fixture.resultHome, away: fixture.resultAway }
      : null
  const resultOutcome = result ? outcomeOf(result) : null
  const gotItRight = resultOutcome !== null && resultOutcome === outcome
  const contrarianWin = gotItRight && band === 'against_the_field'

  return {
    outcome,
    outcomeLabel,
    outcomeShare,
    cohort: fixture.predicted,
    band,
    headline:
      band === 'against_the_field'
        ? `Only ${outcomeShare}% backed ${outcomeLabel}, and you were one of them.`
        : band === 'with_the_field'
          ? `${outcomeShare}% backed ${outcomeLabel}, and so did you.`
          : `${outcomeShare}% backed ${outcomeLabel}. Opinion was split.`,
    scorelinePicks: sameScoreline?.picks ?? null,
    scorelineLine: sameScoreline
      ? sameScoreline.picks === 1
        ? `${prediction.home} – ${prediction.away} was yours alone among the most-predicted scores.`
        : `${sameScoreline.picks} players predicted ${prediction.home} – ${prediction.away}, same as you.`
      : `${prediction.home} – ${prediction.away} was outside the most-predicted scores.`,
    contrarianWin,
    resultLine:
      result === null
        ? null
        : contrarianWin
          ? `Contrarian win — it finished ${result.home} – ${result.away}.`
          : gotItRight
            ? `You called it — it finished ${result.home} – ${result.away}.`
            : `It finished ${result.home} – ${result.away}.`,
  }
}
