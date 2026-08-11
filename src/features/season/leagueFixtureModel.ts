import type {
  SeasonLeagueMatchweekPredictions,
  SeasonLeaguePredictionFixture,
} from '../../services/supabase/seasonLeaguePredictions'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovement'

/**
 * What one private league predicted for ONE fixture, and how that matchweek
 * moved its table (contracts 149 and 150).
 *
 * THE REVEAL DECISION IS NOT TAKEN HERE. Contract 149 resolves the matchweek's
 * own lock server-side and returns `revealed`; this model reads it and never
 * compares an instant to anything. There is no clock in this file, which is the
 * point — a boundary a browser can compute is not a boundary.
 *
 * HIDDEN IS A STATE, NOT AN ABSENCE. Before the lock the view says so, with the
 * league's name and its member count, and carries no rows and no predicted
 * count — the read deliberately withholds both, and a surface that filled them
 * in from elsewhere would leak who has played.
 *
 * OUTCOME IS COUNTED, NOT SCORED. `exact` and `correct` describe how a
 * prediction compares with the official result — a fact about the prediction.
 * No point value is derived here: points come from `season_matchweek_scores`
 * through the read and are null until the matchweek settles.
 *
 * MOVEMENT ONLY FROM A SETTLED MATCHWEEK. Contract 150 answers `settled: false`
 * for a matchweek still being scored, and this model renders nothing from it —
 * reporting a climb out of totals that are still changing would show a player a
 * position they never held.
 *
 * PURE.
 */

export type LeagueFixtureOutcome = 'exact' | 'correct' | 'wrong'

export type LeagueFixtureRow = {
  userId: string
  displayName: string
  isSelf: boolean
  /** Null for a member who did not predict this fixture. */
  prediction: { home: number; away: number } | null
  /** "2 - 1", ready to print. Null when there is no prediction. */
  predictionLabel: string | null
  /** Null until the fixture has an official result. */
  outcome: LeagueFixtureOutcome | null
  /** The whole matchweek's points, not this fixture's. Null until settled. */
  matchweekPoints: number | null
  jokerPlayed: boolean
}

export type LeagueFixtureView = {
  leagueId: string
  leagueName: string | null
  matchweek: { ordinal: number; label: string; locksAt: string | null }
  revealed: boolean
  memberCount: number
  /** Zero while hidden, by the read's own design. */
  predictedCount: number
  /** Empty while hidden. Members who predicted, then members who did not. */
  rows: readonly LeagueFixtureRow[]
  /** True once the league's matchweek points are banked. */
  settled: boolean
}

function labelOf(prediction: { home: number; away: number } | null): string | null {
  return prediction ? `${prediction.home} - ${prediction.away}` : null
}

function outcomeOf(
  prediction: { home: number; away: number } | null,
  fixture: SeasonLeaguePredictionFixture | undefined,
): LeagueFixtureOutcome | null {
  const result = fixture?.result
  if (!prediction || !result) return null
  if (prediction.home === result.home && prediction.away === result.away) return 'exact'
  return Math.sign(prediction.home - prediction.away) ===
    Math.sign(result.home - result.away)
    ? 'correct'
    : 'wrong'
}

export function presentLeagueFixture(
  page: SeasonLeagueMatchweekPredictions,
  fixtureId: string,
): LeagueFixtureView {
  const fixture = page.fixtures.find((entry) => entry.id === fixtureId)

  const rows: LeagueFixtureRow[] = page.members.map((member) => {
    const prediction = member.predictions[fixtureId] ?? null
    return {
      userId: member.userId,
      displayName: member.displayName,
      isSelf: member.isSelf,
      prediction,
      predictionLabel: labelOf(prediction),
      outcome: outcomeOf(prediction, fixture),
      matchweekPoints: member.points,
      jokerPlayed: member.jokerPlayed,
    }
  })

  // Members who predicted this fixture come first — they are what the section
  // is for — and the server's order is preserved within each half rather than
  // re-sorted, so a league table and this list agree about who is ahead.
  const predicted = rows.filter((row) => row.prediction !== null)
  const absent = rows.filter((row) => row.prediction === null)

  return {
    leagueId: page.league.id,
    leagueName: page.league.name,
    matchweek: {
      ordinal: page.matchweek.ordinal,
      label: page.matchweek.label,
      locksAt: page.matchweek.locksAt,
    },
    revealed: page.revealed,
    memberCount: page.memberCount,
    predictedCount: page.predictedCount,
    rows: [...predicted, ...absent],
    settled: page.members.some((member) => member.settledAt !== null),
  }
}

export type LeagueMovementLine = {
  /** False when the matchweek has not settled. Nothing below may be rendered. */
  settled: boolean
  matchweekLabel: string | null
  rankBefore: number
  rankAfter: number
  /** Positive is a climb. */
  movement: number
  pointsThisMatchweek: number | null
  gapToLeaderAfter: number
  fieldSize: number
}

/**
 * The caller's own line in a settled matchweek's movement — "34th → 29th · ↑5".
 *
 * Null when the matchweek has not settled, when the read holds no row for the
 * caller, or when the league has one member and movement would be a number
 * with nothing behind it.
 */
export function presentLeagueMovement(
  movement: SeasonLeagueMovement,
): LeagueMovementLine | null {
  if (!movement.settled || movement.members.length === 0) return null
  const you = movement.members.find((member) => member.isSelf)
  if (!you) return null

  return {
    settled: true,
    matchweekLabel: movement.matchweek?.label ?? null,
    rankBefore: you.rankBefore,
    rankAfter: you.rankAfter,
    movement: you.movement,
    pointsThisMatchweek: you.pointsThisMatchweek,
    gapToLeaderAfter: you.gapToLeaderAfter,
    fieldSize: movement.members.length,
  }
}
