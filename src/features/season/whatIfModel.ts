import { explainFixtureScore, type FixtureScoreReason } from '../../domain/season/scoring'
import type {
  ProjectionLeague,
  ProjectionScore,
  SeasonMatchweekProjection,
} from '../../services/supabase/seasonMatchweekProjectionModel'

/**
 * `INNOV-001` — the What-If projection for one live fixture, PRESENTED.
 *
 * WHAT CHANGED, AND WHY THIS FILE NO LONGER PROJECTS. This module used to do
 * the projection itself: fold the league's revealed predictions over the
 * matchweek's fixtures, apply the Joker, rank the result. It did that because
 * contract 175 was written and not hosted, and a surface with no authority
 * either derives or shows nothing. 175 is hosted now, so every number below
 * arrives from `get_season_matchweek_projection` — the same
 * `predictor_internal.season_fixture_points` settlement banks from — and this
 * module's job is to decide what to SAY about them. Two answers to one question
 * is the defect that removal closes; the projection had no way to disagree with
 * settlement quietly, and now it has no way to disagree at all.
 *
 * THE ONE COMPARISON THAT REMAINS IS NOT A POINT VALUE. `explainFixtureScore`
 * is still called, for the reason token alone — exact, right result, wrong,
 * unscored — because the server returns the matchweek total under a branch and
 * not what the branch would do to THIS fixture's outcome. No number in this
 * file comes from that call: the points on screen are the server's matchweek
 * totals and the difference between two of them.
 *
 * EVERY FIGURE IS A PROJECTION AND IS LABELLED AS ONE. Nothing here is a point,
 * a rank or a standing. It is the scoring authority applied to a provider's
 * provisional score, which can move, be corrected or be withdrawn.
 *
 * IT PROJECTS ONLY WHILE THERE IS SOMETHING TO PROJECT. A settled matchweek, a
 * fixture with a confirmed result, and a fixture with no provider score at all
 * each return unavailable — the surface renders nothing rather than explaining
 * why it has nothing.
 *
 * THE LEAGUE HALF IS "AS IT STANDS", AND SAYS SO RATHER THAN IMPLYING MORE.
 * Contract 175 projects each member's matchweek on the basis every fixture
 * actually has; it does not project a league under a hypothetical, and this
 * module does not build one. Reconstructing it here would mean re-deriving
 * other players' points in the browser, which is the thing that was removed.
 * Before the matchweek's own lock the server hides the block completely, and
 * `revealed: false` is rendered as hidden rather than as empty or failed.
 *
 * PURE. No clock, no storage, no network; the decoded payload is given.
 */

export type WhatIfScore = ProjectionScore

export type WhatIfBranchKey = 'now' | 'home' | 'away'

export type WhatIfBranch = {
  key: WhatIfBranchKey
  /** "As it stands", "If Liverpool score", "If Arsenal score". */
  label: string
  score: WhatIfScore
  scoreLabel: string
  /** The player's WHOLE matchweek under this branch, post-Joker. The server's. */
  matchweekPoints: number
  /** Change against "as it stands". Always 0 on the `now` branch. */
  change: number
  /** What this branch would make of the player's prediction on this fixture. */
  reason: FixtureScoreReason
}

export type WhatIfLeagueRow = {
  userId: string
  displayName: string
  isSelf: boolean
  bankedPoints: number
  projectedPoints: number
  currentRank: number
  projectedRank: number
}

export type WhatIfLeague = {
  leagueName: string
  /** The league's real size where the server supplied one. */
  membersTotal: number | null
  membersReturned: number
  membersTruncated: boolean
  rows: readonly WhatIfLeagueRow[]
  you: WhatIfLeagueRow | null
  /** Whose projected total leads the rows that were carried. */
  leaderName: string | null
  /** Projected points between you and the leader, never negative. */
  gapToLeader: number | null
}

export type WhatIfLeagueBlock =
  /** The server withheld it: the matchweek's own lock has not passed. */
  | { revealed: false; leagueName: string; locksAt: string | null }
  | ({ revealed: true } & WhatIfLeague)

export type WhatIfUnavailable =
  /** The matchweek's points are banked. A projection over history is a novelty. */
  | 'settled'
  /** The fixture has a confirmed result. Nothing left to project. */
  | 'fixture_settled'
  /** No provider score at all — not started, or nothing reported. */
  | 'no_live_score'
  /** The projection does not carry this fixture. */
  | 'fixture_absent'

export type WhatIfProjection =
  | { available: false; reason: WhatIfUnavailable }
  | {
      available: true
      matchweek: number
      /** The provisional score every branch starts from. Never a result. */
      live: WhatIfScore
      /** Where the provisional score came from, for the caller to attribute. */
      liveKind: string | null
      /** The player's own prediction on this fixture, or null. */
      prediction: WhatIfScore | null
      jokerPlayed: boolean
      /** The whole matchweek as it stands, post-Joker. The server's. */
      matchweekPoints: number
      branches: readonly WhatIfBranch[]
      league: WhatIfLeagueBlock | null
    }

const scoreLabel = (score: WhatIfScore): string => `${score.home} – ${score.away}`

function presentLeague(league: ProjectionLeague | null): WhatIfLeagueBlock | null {
  if (league === null) return null
  if (!league.revealed) {
    return { revealed: false, leagueName: league.name, locksAt: league.locksAt }
  }

  const rows = league.rows.map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    isSelf: row.isSelf,
    bankedPoints: row.bankedPoints,
    projectedPoints: row.projectedPoints,
    currentRank: row.currentRank,
    projectedRank: row.projectedRank,
  }))

  const you = rows.find((row) => row.isSelf) ?? null
  // The leader among the rows that were CARRIED. Where the server truncated,
  // the surface says so beside this rather than the model pretending the
  // top of a page is the top of a league.
  const leader = rows.find((row) => row.projectedRank === 1) ?? null

  return {
    revealed: true,
    leagueName: league.name,
    membersTotal: league.membersTotal,
    membersReturned: league.membersReturned,
    membersTruncated: league.membersTruncated,
    rows,
    you,
    leaderName: leader?.displayName ?? null,
    gapToLeader:
      you && leader ? Math.max(0, leader.projectedPoints - you.projectedPoints) : null,
  }
}

/**
 * One fixture's What-If, read out of the matchweek the server projected.
 *
 * @param projection the decoded contract 175 payload
 * @param fixtureId  the fixture the surface is about
 * @param homeName   club names for the branch labels; the projection carries
 * @param awayName   team ids, and this surface already holds the names
 */
export function presentWhatIf(
  projection: SeasonMatchweekProjection,
  fixtureId: string,
  homeName: string,
  awayName: string,
): WhatIfProjection {
  // A banked matchweek has a real total. Projecting over it would be a second,
  // worse answer to a question that already has one.
  if (projection.settled) return { available: false, reason: 'settled' }

  const fixture = projection.fixtures.find((entry) => entry.fixtureId === fixtureId)
  if (!fixture) return { available: false, reason: 'fixture_absent' }
  if (fixture.basis === 'official') return { available: false, reason: 'fixture_settled' }
  if (fixture.basis === 'none' || fixture.provisional === null) {
    return { available: false, reason: 'no_live_score' }
  }

  const live: WhatIfScore = { home: fixture.provisional.home, away: fixture.provisional.away }
  const prediction = fixture.prediction

  const now: WhatIfBranch = {
    key: 'now',
    label: 'As it stands',
    score: live,
    scoreLabel: scoreLabel(live),
    matchweekPoints: projection.projectedPoints,
    change: 0,
    reason: explainFixtureScore(prediction, live).reason,
  }

  // Branches exist only where the server built them — a fixture actually in
  // play. Without them the panel still says what the current score is worth,
  // which is the smaller honest answer rather than an invented next goal.
  const branches: WhatIfBranch[] = [now]
  if (fixture.branches) {
    const { homeScores, awayScores } = fixture.branches
    branches.push(
      {
        key: 'home',
        label: `If ${homeName} score`,
        score: homeScores.score,
        scoreLabel: scoreLabel(homeScores.score),
        matchweekPoints: homeScores.matchweekPoints,
        change: homeScores.matchweekPoints - projection.projectedPoints,
        reason: explainFixtureScore(prediction, homeScores.score).reason,
      },
      {
        key: 'away',
        label: `If ${awayName} score`,
        score: awayScores.score,
        scoreLabel: scoreLabel(awayScores.score),
        matchweekPoints: awayScores.matchweekPoints,
        change: awayScores.matchweekPoints - projection.projectedPoints,
        reason: explainFixtureScore(prediction, awayScores.score).reason,
      },
    )
  }

  return {
    available: true,
    matchweek: projection.matchweek.ordinal,
    live,
    liveKind: fixture.provisional.kind,
    prediction,
    jokerPlayed: projection.jokerPlayed,
    matchweekPoints: projection.projectedPoints,
    branches,
    league: presentLeague(projection.league),
  }
}

/**
 * One sentence for a branch, in the player's own terms. Kept beside the model
 * so the wording cannot claim something the numbers do not say.
 *
 * IT DESCRIBES THE MATCHWEEK, BECAUSE THAT IS WHAT THE NUMBER IS. A branch's
 * figure is the whole matchweek under the hypothetical, not this fixture's
 * share of it, and a sentence about "points from this fixture" beside a
 * matchweek total would misread the one number on the panel that matters.
 */
export function describeBranch(branch: WhatIfBranch): string {
  const outcome =
    branch.reason === 'exact_score'
      ? 'Your prediction would be exact.'
      : branch.reason === 'correct_result'
        ? 'Right result, wrong score.'
        : branch.reason === 'unscored'
          ? 'You have no prediction on this fixture.'
          : 'Your prediction would be wrong.'

  if (branch.key === 'now') return outcome

  const movement =
    branch.change > 0
      ? `${branch.change} more across the matchweek.`
      : branch.change < 0
        ? `${Math.abs(branch.change)} fewer across the matchweek.`
        : 'No change across the matchweek.'

  return `${outcome} ${movement}`
}
