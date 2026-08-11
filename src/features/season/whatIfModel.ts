import {
  explainFixtureScore,
  scoreMatchweek,
  type FixtureScoreReason,
} from '../../domain/season/scoring'

/**
 * `INNOV-001` — the What-If projection for one live fixture.
 *
 * WHAT IT ANSWERS. "What does the current score, and the next goal, mean to
 * me?" — the one question a live fixture raises that no existing surface could
 * answer. The Match Centre already shows the prediction, the provisional score
 * and the settled points; none of them says what a 1–1 becoming 2–1 would do.
 *
 * EVERY NUMBER HERE IS A PROJECTION AND IS LABELLED AS ONE. Nothing this module
 * produces is a point, a rank or a standing. It is arithmetic over a provider's
 * provisional score, which can move, be corrected or be withdrawn, and the
 * caller must never render it where an official figure goes.
 *
 * IT REIMPLEMENTS NO RULE. Points come from `explainFixtureScore` and matchweek
 * totals from `scoreMatchweek` — ADR 0012's authority, parity-checked against
 * the database — so a projection cannot disagree with the settlement it is
 * anticipating. There is no threshold, no multiplier and no comparison in this
 * file that the scoring authority does not own.
 *
 * IT PROJECTS ONLY WHILE THERE IS SOMETHING TO PROJECT. A fixture with a
 * confirmed result is history and returns `settled`: showing a player what
 * "might" happen to a match that has finished is a novelty, not information.
 * A fixture with no provider score at all returns `no_live_score` rather than
 * projecting from a kickoff time.
 *
 * THE LEAGUE HALF IS OPTIONAL AND FAILS TO ABSENT. It needs the matchweek's
 * revealed league predictions (contract 149), which exist only after the
 * matchweek's own lock, and it is suppressed entirely once the matchweek has
 * settled — at that point the real table is the answer and a projection beside
 * it would be a second, worse one. It never reveals a prediction the server
 * withheld: the caller passes what contract 149 already returned, and that read
 * carries no member rows at all before the lock.
 *
 * FIXTURES WITH NO SCORE ARE COUNTED, NOT GUESSED. A matchweek in progress has
 * fixtures nobody knows the result of. They contribute zero to every member
 * equally and the count is reported, so the surface can say what the projection
 * does not know instead of implying it knows everything.
 *
 * PURE. No clock, no storage, no network; every input is given.
 */

export type WhatIfScore = { home: number; away: number }

export type WhatIfBranchKey = 'now' | 'home' | 'away'

/**
 * The largest scoreline this module will project into. A provider reporting an
 * implausible score is a data fault, and branching off it would multiply the
 * fault rather than contain it.
 */
const MAX_PROJECTED_GOALS = 20

export type WhatIfLeagueRow = {
  userId: string
  displayName: string
  isSelf: boolean
  /** Projected points for the whole matchweek, Joker applied by the authority. */
  matchweekPoints: number
  /** Banked season points BEFORE this matchweek. Null when not supplied. */
  seasonPointsBefore: number | null
  /** `seasonPointsBefore + matchweekPoints`. Null when the former is null. */
  projectedSeasonPoints: number | null
  /** Position on projected season points, ties sharing a position. */
  projectedRank: number | null
}

export type WhatIfLeagueProjection = {
  leagueName: string
  /** The league's real size, from the server. May exceed `rows.length`. */
  memberCount: number
  /** Matchweek fixtures with no score of any kind. Zero for every member. */
  unknownFixtures: number
  rows: readonly WhatIfLeagueRow[]
  you: WhatIfLeagueRow | null
  /** Whose projected total leads. Null when nothing can be ranked. */
  leaderName: string | null
  /**
   * Projected points between you and the leader, never negative. Null when you
   * are the leader, or when season totals were not supplied.
   */
  gapToLeader: number | null
}

export type WhatIfBranch = {
  key: WhatIfBranchKey
  /** "Now", "If Liverpool score", "If Arsenal score". */
  label: string
  score: WhatIfScore
  scoreLabel: string
  /** The player's own projected points from this fixture alone. */
  points: number
  reason: FixtureScoreReason
  league: WhatIfLeagueProjection | null
}

export type WhatIfUnavailable =
  /** The fixture has a confirmed result. Nothing to project. */
  | 'settled'
  /** No provider score at all — the match has not started, or nothing reported. */
  | 'no_live_score'
  /** The provider score is not a usable pair of whole goal counts. */
  | 'unusable_live_score'

export type WhatIfProjection =
  | { available: false; reason: WhatIfUnavailable }
  | {
      available: true
      /** The provisional score every branch starts from. Never a result. */
      live: WhatIfScore
      /** The player's own prediction, or null. */
      prediction: WhatIfScore | null
      branches: readonly WhatIfBranch[]
    }

export type WhatIfLeagueMember = {
  userId: string
  displayName: string
  isSelf: boolean
  jokerPlayed: boolean
  /** Keyed by season fixture id. Empty for a member who did not predict. */
  predictions: Readonly<Record<string, WhatIfScore>>
  /**
   * The member's BANKED matchweek points. A non-null value means the matchweek
   * has settled, and settled matchweeks are never projected.
   */
  points: number | null
}

export type WhatIfLeagueFixture = {
  id: string
  /** The settled result, or null while the fixture is unconfirmed. */
  result: WhatIfScore | null
}

export type WhatIfLeagueInput = {
  leagueName: string
  memberCount: number
  members: readonly WhatIfLeagueMember[]
  fixtures: readonly WhatIfLeagueFixture[]
  /**
   * Banked season points before this matchweek, by user id (contract 128).
   * Optional: without it the projection ranks nothing and reports matchweek
   * points only, which is a smaller answer rather than a guessed one.
   */
  seasonPointsBefore?: Readonly<Record<string, number>>
}

export type WhatIfInput = {
  fixtureId: string
  homeName: string
  awayName: string
  prediction: WhatIfScore | null
  /** The confirmed result. Any value at all suppresses the whole projection. */
  result: WhatIfScore | null
  /** A provider's current score. Provisional, and the only thing projected from. */
  live: WhatIfScore | null
  league?: WhatIfLeagueInput | null
}

function isWholeScore(score: WhatIfScore | null | undefined): score is WhatIfScore {
  return (
    score != null &&
    Number.isInteger(score.home) &&
    Number.isInteger(score.away) &&
    score.home >= 0 &&
    score.away >= 0 &&
    score.home <= MAX_PROJECTED_GOALS &&
    score.away <= MAX_PROJECTED_GOALS
  )
}

const scoreLabel = (score: WhatIfScore): string => `${score.home} – ${score.away}`

/**
 * One member's projected matchweek points for a hypothetical score on one
 * fixture. Every other fixture keeps whatever it actually has: a settled result
 * scores, and an unconfirmed one scores nothing for anybody.
 */
function projectMember(
  member: WhatIfLeagueMember,
  fixtures: readonly WhatIfLeagueFixture[],
  fixtureId: string,
  branchScore: WhatIfScore,
): number {
  const entries = fixtures.flatMap((fixture) => {
    const result = fixture.id === fixtureId ? branchScore : fixture.result
    if (result === null) return []
    return [{ prediction: member.predictions[fixture.id] ?? null, result }]
  })
  // The authority applies the Joker, so the doubling cannot be re-expressed
  // here and cannot drift from what settlement will actually bank.
  return scoreMatchweek(entries, member.jokerPlayed).totalPoints
}

function rankRows(rows: WhatIfLeagueRow[]): WhatIfLeagueRow[] {
  const rankable = rows.every((row) => row.projectedSeasonPoints !== null)
  if (!rankable) return rows

  const ordered = [...rows].sort((left, right) => {
    const gap = (right.projectedSeasonPoints ?? 0) - (left.projectedSeasonPoints ?? 0)
    if (gap !== 0) return gap
    // A stable, stated tie-break so two renders cannot disagree. It is NOT a
    // standings rule: tied projections share a rank below, and this only fixes
    // the order they are printed in.
    return left.displayName.localeCompare(right.displayName)
  })

  let lastPoints: number | null = null
  let lastRank = 0
  return ordered.map((row, index) => {
    const points = row.projectedSeasonPoints
    if (points !== lastPoints) {
      lastRank = index + 1
      lastPoints = points
    }
    return { ...row, projectedRank: lastRank }
  })
}

function projectLeague(
  league: WhatIfLeagueInput,
  fixtureId: string,
  branchScore: WhatIfScore,
): WhatIfLeagueProjection | null {
  // A settled matchweek has a real table. Projecting over it would produce a
  // second answer to a question that already has one.
  if (league.members.some((member) => member.points !== null)) return null
  if (league.members.length === 0) return null

  const banked = league.seasonPointsBefore ?? null
  const rows = league.members.map((member) => {
    const matchweekPoints = projectMember(member, league.fixtures, fixtureId, branchScore)
    const before = banked?.[member.userId]
    const seasonPointsBefore = typeof before === 'number' && Number.isFinite(before) ? before : null
    return {
      userId: member.userId,
      displayName: member.displayName,
      isSelf: member.isSelf,
      matchweekPoints,
      seasonPointsBefore,
      projectedSeasonPoints:
        seasonPointsBefore === null ? null : seasonPointsBefore + matchweekPoints,
      projectedRank: null,
    } satisfies WhatIfLeagueRow
  })

  const ranked = rankRows(rows)
  const you = ranked.find((row) => row.isSelf) ?? null
  const leader = ranked.find((row) => row.projectedRank === 1) ?? null

  return {
    leagueName: league.leagueName,
    memberCount: league.memberCount,
    unknownFixtures: league.fixtures.filter(
      (fixture) => fixture.id !== fixtureId && fixture.result === null,
    ).length,
    rows: ranked,
    you,
    leaderName: leader?.displayName ?? null,
    gapToLeader:
      you && leader && you.projectedSeasonPoints !== null && leader.projectedSeasonPoints !== null
        ? Math.max(0, leader.projectedSeasonPoints - you.projectedSeasonPoints)
        : null,
  }
}

export function projectWhatIf(input: WhatIfInput): WhatIfProjection {
  if (input.result !== null) return { available: false, reason: 'settled' }
  if (input.live == null) return { available: false, reason: 'no_live_score' }
  if (!isWholeScore(input.live)) return { available: false, reason: 'unusable_live_score' }

  const live = input.live
  const prediction = isWholeScore(input.prediction) ? input.prediction : null
  const league = input.league ?? null

  const candidates: { key: WhatIfBranchKey; label: string; score: WhatIfScore }[] = [
    { key: 'now', label: 'As it stands', score: live },
    {
      key: 'home',
      label: `If ${input.homeName} score`,
      score: { home: live.home + 1, away: live.away },
    },
    {
      key: 'away',
      label: `If ${input.awayName} score`,
      score: { home: live.home, away: live.away + 1 },
    },
  ]

  const branches = candidates
    // A branch that would run past the plausible ceiling is dropped rather than
    // clamped: a clamped branch is a different match, silently.
    .filter((candidate) => isWholeScore(candidate.score))
    .map((candidate) => {
      const explained = explainFixtureScore(prediction, candidate.score)
      return {
        key: candidate.key,
        label: candidate.label,
        score: candidate.score,
        scoreLabel: scoreLabel(candidate.score),
        points: explained.points,
        reason: explained.reason,
        league: league ? projectLeague(league, input.fixtureId, candidate.score) : null,
      } satisfies WhatIfBranch
    })

  return { available: true, live, prediction, branches }
}

/**
 * One sentence for a branch, in the player's own terms. Kept beside the model
 * so the wording cannot claim something the numbers do not say.
 */
export function describeBranch(branch: WhatIfBranch): string {
  switch (branch.reason) {
    case 'exact_score':
      return `Your prediction would be exact — ${branch.points} projected points.`
    case 'correct_result':
      return `Right result, wrong score — ${branch.points} projected points.`
    case 'wrong':
      return 'No projected points from this fixture.'
    case 'unscored':
      return 'You have no prediction on this fixture, so it projects nothing for you.'
  }
}
