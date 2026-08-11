import { explainFixtureScore, type FixtureScoreReason } from '../../domain/season/scoring'
import type { MatchPredictorPage } from '../season/matchPredictorModel'

/**
 * Why a player received the points a settled matchweek gave them.
 *
 * WHAT WAS MISSING. A settled matchweek printed one number — `28 pts` in the
 * status strip — and nothing anywhere said where it came from. The Match Centre
 * could explain ONE fixture, because `explainFixtureScore` was written for
 * exactly that and `matchCentreModel` is its only caller; a player asking "why
 * 28" had to open eleven fixtures one at a time and add up. This is the other
 * half of that authority: the same explanation, for a whole card, once.
 *
 * THE NUMBERS ARE THE SERVER'S. Every row prints `fixture.points`, which
 * contract 114's matchweek card supplies alongside the settled result, and the
 * total is `settledPoints`, which is what the season, the leagues and the
 * standings all agree on. Nothing here adds up a total and shows it: the total
 * on screen is the one the server banked, or there is no total on screen.
 *
 * THE REASONS ARE THE AUTHORITY'S. "Exact score" and "right result, wrong
 * score" come from `explainFixtureScore`, the shared rule with a parity test
 * against the database behind it — never from a comparison written again here.
 *
 * AND WHEN THE TWO DISAGREE, IT SAYS SO RATHER THAN CHOOSING. If the rows do
 * not reconcile with the banked total — a rescored fixture, a correction, a
 * rule the browser is behind on — `reconciles` is false, and the surface prints
 * the banked total with the itemisation marked incomplete. The alternative is a
 * breakdown that quietly contradicts the player's own standing, which is worse
 * than an admission.
 *
 * THE JOKER IS A LINE, NOT A MULTIPLIER APPLIED PER ROW. ADR 0012 doubles the
 * WHOLE matchweek, so it appears once, after the fixtures, exactly where the
 * rule applies it. Doubling each row would produce the same total by a route
 * the rule does not take, and would teach the player the wrong rule.
 *
 * PURE. The card is the only input; no clock, no storage, no network.
 */

export type MatchweekPointsRow = {
  fixtureId: string
  home: string
  away: string
  /** "2 - 1", or null where the player left the fixture blank. */
  prediction: string | null
  /** "2 - 1". Present on every row, because unsettled fixtures are excluded. */
  result: string
  /** The server's points for this fixture. */
  points: number
  reason: FixtureScoreReason
  /** The reason in the player's words. */
  explanation: string
}

export type MatchweekPointsView =
  /** The matchweek has not settled. Nothing is said about what it might be worth. */
  | { kind: 'unsettled' }
  /** Settled, but the player banked nothing, so no fixture scored. */
  | { kind: 'unbanked'; total: number }
  | {
      kind: 'itemised'
      rows: readonly MatchweekPointsRow[]
      /** Sum of the rows, before the Joker. Never shown as the answer. */
      subtotal: number
      /** Present only where the player's Joker is on this matchweek. */
      joker: { doubled: number } | null
      /** The banked total. Always the server's. */
      total: number
      /** Whether the rows account for the banked total. */
      reconciles: boolean
      /** Fixtures on the card that have not settled, and so are not rows. */
      unsettled: number
      exact: number
      correctResult: number
      missed: number
      blank: number
    }

const scoreline = (score: { home: number; away: number } | null): string | null =>
  score ? `${score.home} - ${score.away}` : null

const REASON_COPY: Record<FixtureScoreReason, string> = {
  exact_score: 'Exact score',
  correct_result: 'Right result, wrong score',
  wrong: 'Wrong result',
  unscored: 'No prediction',
}

export function presentMatchweekPoints(card: MatchPredictorPage): MatchweekPointsView {
  if (card.settledPoints === null) return { kind: 'unsettled' }

  const total = card.settledPoints

  // Unbanked is not "every fixture scored zero". The player never entered the
  // matchweek, so the card banked nothing at the lock, and itemising eleven
  // zeros against predictions they never made would be a breakdown of a thing
  // that did not happen.
  if (card.cardStatus === 'no_submission') return { kind: 'unbanked', total }

  const rows: MatchweekPointsRow[] = []
  let unsettled = 0

  for (const fixture of card.fixtures) {
    if (fixture.result === null || fixture.points === null) {
      unsettled += 1
      continue
    }
    const explained = explainFixtureScore(fixture.prediction, fixture.result)
    rows.push({
      fixtureId: fixture.fixtureId,
      home: fixture.home.name,
      away: fixture.away.name,
      prediction: scoreline(fixture.prediction),
      result: `${fixture.result.home} - ${fixture.result.away}`,
      // The server's number, not `explained.points`. Where the two differ the
      // player's standing follows the server, so the breakdown does too.
      points: fixture.points,
      reason: explained.reason,
      explanation: REASON_COPY[explained.reason],
    })
  }

  const subtotal = rows.reduce((sum, row) => sum + row.points, 0)
  const joker = card.joker.playedHere ? { doubled: subtotal } : null
  const accounted = joker ? subtotal * 2 : subtotal

  return {
    kind: 'itemised',
    rows,
    subtotal,
    joker,
    total,
    // Only a card with nothing outstanding can be expected to reconcile: a
    // matchweek that settled with a postponed fixture still open has banked a
    // total the visible rows genuinely do not account for, and that is correct
    // rather than a discrepancy.
    reconciles: unsettled === 0 && accounted === total,
    unsettled,
    exact: rows.filter((row) => row.reason === 'exact_score').length,
    correctResult: rows.filter((row) => row.reason === 'correct_result').length,
    missed: rows.filter((row) => row.reason === 'wrong').length,
    blank: rows.filter((row) => row.reason === 'unscored').length,
  }
}
