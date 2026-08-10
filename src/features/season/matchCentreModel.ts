import { explainFixtureScore } from '../../domain/season/scoring'
import type { FixtureListRow } from './fixtureListModel'
import type { MatchPredictorPage } from './matchPredictorModel'

/**
 * One fixture, and what it means for the player looking at it (Alpha item 14).
 *
 * The Matches list answers "what is on"; this answers "and what does it do to
 * me". It joins two reads that already exist and adds no third: contract 139's
 * fixture facts, which are the same for everybody, and contract 114's matchweek
 * card, which is the caller's own entry for the round that fixture belongs to.
 *
 * PROVISIONAL NEVER BECOMES OFFICIAL, and this is the surface where that rule
 * is under the most pressure. A live 2-1 against a predicted 2-1 is a very
 * tempting five points to print, and printing it would be wrong: the platform
 * has not settled the fixture, a provider's score can move or be withdrawn, and
 * a number shown once is remembered whatever a later correction says. So points
 * are derived ONLY from `result`, the settled score, and never from `live`. The
 * two remain two fields all the way to the screen.
 *
 * THE POINTS ARE THE SHARED AUTHORITY'S, NOT A SECOND ENGINE. `scoreFixture` is
 * ADR 0012's rule and is parity-checked against the database in
 * `tests/database-parity/seasonScoringParity.test.ts`; calling it is presenting
 * the authority rather than re-implementing it. What it must NOT be used for is
 * a total: the Joker doubles a whole matchweek, so a matchweek's points come
 * from the server's `settledPoints` and this module only ever speaks about one
 * fixture.
 *
 * AN UNBANKED CARD SCORES NOTHING, however good the prediction looks. A player
 * who never engaged the matchweek is unbanked at lock — `cardStatus` is
 * `no_submission` — and showing "5 pts" beside a prediction that banked nothing
 * would be the cruellest possible lie for this surface to tell.
 *
 * PURE. Both reads are inputs; no clock, no storage, no network.
 */

export type MatchCentreOutcome =
  /** Settled, and the player's card counted. `points` is this fixture's. */
  | { kind: 'scored'; points: number; exact: boolean }
  /** Settled, but the player banked nothing for the matchweek. */
  | { kind: 'unbanked' }
  /** Settled, the card counted, and this fixture was left blank. */
  | { kind: 'blank' }
  /** Not settled. Deliberately says nothing about what it might be worth. */
  | { kind: 'pending' }

export type MatchCentreView = {
  /** "2 - 1", the player's own prediction for this fixture. */
  prediction: string | null
  /** "2 - 1", the settled result. Never a provider's score. */
  result: string | null
  /** A provider's current score and when it was seen. Never a result. */
  provisional: { score: string; at: string | null } | null
  outcome: MatchCentreOutcome
  /** The matchweek's own settled total, from the server. Null until settled. */
  matchweekPoints: number | null
  /** Said only where it changes what a number means. */
  jokerNote: string | null
  /** One sentence explaining the outcome above, in the player's terms. */
  explanation: string
}

const scoreline = (score: { home: number; away: number } | null): string | null =>
  score ? `${score.home} - ${score.away}` : null

export function presentMatchCentre(
  fixture: FixtureListRow,
  card: MatchPredictorPage,
): MatchCentreView {
  const mine = card.fixtures.find((entry) => entry.fixtureId === fixture.id) ?? null
  const prediction = mine?.prediction ?? null
  const result = mine?.result ?? null
  const banked = card.cardStatus !== 'no_submission'

  const provisional =
    fixture.provisional && !result
      ? { score: fixture.provisional, at: fixture.provisionalAt }
      : null

  const outcome: MatchCentreOutcome = !result
    ? { kind: 'pending' }
    : !banked
      ? { kind: 'unbanked' }
      : !prediction
        ? { kind: 'blank' }
        : scoredOutcome(prediction, result)

  return {
    prediction: scoreline(prediction),
    result: scoreline(result),
    provisional,
    outcome,
    matchweekPoints: card.settledPoints,
    // Only where it changes what a number means. The Joker doubles the
    // MATCHWEEK, so it explains the total and never this fixture's points —
    // saying "doubled" beside a fixture would invite the player to double it
    // themselves and get a different answer from the server's.
    jokerNote:
      card.joker.playedHere && card.settledPoints !== null
        ? 'Your Joker is on this matchweek, so the matchweek total is doubled. It doubles the whole card, never one fixture.'
        : card.joker.playedHere
          ? 'Your Joker is on this matchweek. It doubles the whole card once the matchweek settles, never one fixture.'
          : null,
    explanation: explain(outcome, prediction !== null, provisional !== null),
  }
}

/**
 * The one comparison, asked once.
 *
 * `explainFixtureScore` returns the reason and the points together from the
 * canonical authority, so this file no longer re-derives "was it exact" beside
 * a number it did not derive. A parity test pins the two to `scoreFixture`.
 */
function scoredOutcome(
  prediction: { home: number; away: number },
  result: { home: number; away: number },
): MatchCentreOutcome {
  const explained = explainFixtureScore(prediction, result)
  return {
    kind: 'scored',
    points: explained.points,
    exact: explained.reason === 'exact_score',
  }
}

function explain(
  outcome: MatchCentreOutcome,
  predicted: boolean,
  hasProvisional: boolean,
): string {
  switch (outcome.kind) {
    case 'scored':
      return outcome.exact
        ? `Exact score. ${outcome.points} points from this fixture.`
        : outcome.points > 0
          ? `Right result, wrong score. ${outcome.points} points from this fixture.`
          : 'Wrong result. No points from this fixture.'
    case 'blank':
      return 'You left this fixture blank, so it scored nothing. Nothing is ever filled in for you.'
    case 'unbanked':
      return 'You did not enter this matchweek, so nothing was banked and nothing scored — which is different from entering and leaving fixtures blank.'
    case 'pending':
      return hasProvisional
        ? predicted
          ? 'This score is what a provider is reporting now, not a result. Nothing is awarded until the platform confirms the fixture, and a provisional score can still change.'
          : 'This score is what a provider is reporting now, not a result. You have no prediction on this fixture.'
        : predicted
          ? 'Not settled yet. Points appear once the result is confirmed.'
          : 'Not settled yet, and you have no prediction on this fixture.'
  }
}
