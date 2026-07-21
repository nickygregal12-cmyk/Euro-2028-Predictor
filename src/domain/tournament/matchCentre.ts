// Pure domain for the Match Centre (design-system §6). Turns raw picks/results
// into the shapes the per-fixture page renders: temporal state, your stake, the
// overall distribution (bars), and league member picks (names) for both the
// group and knockout variants. No React, no DB. Scoring reuses calculateScore
// via scoreOneMatch-equivalent logic so nothing drifts from score_events.

import { calculateScore } from './calculateScore'
import { KNOCKOUT_STAGE_ORDER, KNOCKOUT_STAGE_POINTS, type KnockoutStage } from './scoringConfig'

// --- Temporal state --------------------------------------------------------

export type MatchTemporalState = 'before' | 'during' | 'after'

/**
 * Which of the three states a fixture is in. `after` once a result exists;
 * `during` once kickoff has passed but no result is in yet (the live window —
 * wired through but unfed until a live-score source exists); `before` otherwise.
 */
export function matchTemporalState(
  match: { kickoffAt: string | null; homeScore: number | null; awayScore: number | null },
  now: Date = new Date(),
): MatchTemporalState {
  if (match.homeScore !== null && match.awayScore !== null) return 'after'
  if (match.kickoffAt && now.getTime() >= new Date(match.kickoffAt).getTime()) return 'during'
  return 'before'
}

// --- Group match outcome ---------------------------------------------------

export type GroupOutcome = 'exact' | 'correct' | 'wrong' | 'unknown'

function outcomeOf(
  pick: { homeScore: number; awayScore: number },
  result: { home: number; away: number } | null,
): GroupOutcome {
  if (!result) return 'unknown'
  if (pick.homeScore === result.home && pick.awayScore === result.away) return 'exact'
  const sign = (a: number, b: number) => Math.sign(a - b)
  if (sign(pick.homeScore, pick.awayScore) === sign(result.home, result.away)) return 'correct'
  return 'wrong'
}

/** Points a single group pick scored, via the one scoring source (calculateScore). */
export function groupPickPoints(
  pick: { homeScore: number; awayScore: number; joker?: boolean },
  result: { home: number; away: number } | null,
): number | null {
  if (!result) return null
  const b = calculateScore(
    { groupMatches: [{ matchId: 'm', homeScore: pick.homeScore, awayScore: pick.awayScore, joker: pick.joker }] },
    { groupMatches: [{ matchId: 'm', homeScore: result.home, awayScore: result.away }] },
  )
  return b.groupMatches.items[0].points
}

// --- Your stake ------------------------------------------------------------

export type GroupStake = {
  kind: 'group'
  pick: { homeScore: number; awayScore: number; joker: boolean } | null
  outcome: GroupOutcome
  points: number | null
}
export type KoStake = {
  kind: 'knockout'
  // The team you backed to go through this tie ('home'/'away'), or null if you
  // had neither participant advancing (your bracket sent different teams here).
  backed: 'home' | 'away' | null
  correct: boolean | null // vs the actual winner (null pre-result)
  points: number | null // progression points for reaching the next stage, if correct
}

const ROUND_ORD: Record<string, number> = { r16: 0, qf: 1, sf: 2, final: 3 }
const NEXT_STAGE_AFTER: Record<string, KnockoutStage> = {
  r16: 'QF',
  qf: 'SF',
  sf: 'FINAL',
  final: 'CHAMPION',
}

// Which of the two participants a set of predicted stages backs to go through
// this tie: the one predicted to reach beyond this round.
function backedTeam(
  homeStage: KnockoutStage | null,
  awayStage: KnockoutStage | null,
  matchRound: string,
): 'home' | 'away' | null {
  const roundOrd = ROUND_ORD[matchRound] ?? -1
  const through = (s: KnockoutStage | null) => s !== null && KNOCKOUT_STAGE_ORDER.indexOf(s) > roundOrd
  if (through(homeStage)) return 'home'
  if (through(awayStage)) return 'away'
  return null
}

export function groupStake(
  pick: { homeScore: number; awayScore: number; joker: boolean } | null,
  result: { home: number; away: number } | null,
): GroupStake {
  return {
    kind: 'group',
    pick,
    outcome: pick ? outcomeOf(pick, result) : 'unknown',
    points: pick ? groupPickPoints(pick, result) : null,
  }
}

export function koStake(
  homeStage: KnockoutStage | null,
  awayStage: KnockoutStage | null,
  matchRound: string,
  actualWinner: 'home' | 'away' | null,
): KoStake {
  const backed = backedTeam(homeStage, awayStage, matchRound)
  const correct = actualWinner === null || backed === null ? null : backed === actualWinner
  const points =
    correct === true ? KNOCKOUT_STAGE_POINTS[NEXT_STAGE_AFTER[matchRound]] : correct === false ? 0 : null
  return { kind: 'knockout', backed, correct, points }
}

// --- Overall distribution (bars) -------------------------------------------

export type ScorelineBar = {
  homeScore: number
  awayScore: number
  count: number
  isYou: boolean
  outcome: GroupOutcome
}

/** Order the overall scoreline distribution best-first by count, mark your row. */
export function groupDistribution(
  buckets: { homeScore: number; awayScore: number; count: number }[],
  yourPick: { homeScore: number; awayScore: number } | null,
  result: { home: number; away: number } | null,
): { bars: ScorelineBar[]; total: number } {
  const bars = buckets
    .map((b) => ({
      homeScore: b.homeScore,
      awayScore: b.awayScore,
      count: b.count,
      isYou: !!yourPick && yourPick.homeScore === b.homeScore && yourPick.awayScore === b.awayScore,
      outcome: outcomeOf({ homeScore: b.homeScore, awayScore: b.awayScore }, result),
    }))
    .sort((a, b) => b.count - a.count || a.homeScore - b.homeScore || a.awayScore - b.awayScore)
  return { bars, total: buckets.reduce((s, b) => s + b.count, 0) }
}

export type KoSplit = {
  homeCount: number
  awayCount: number
  total: number
  youBacked: 'home' | 'away' | null
  actualWinner: 'home' | 'away' | null
}

export function koSplit(
  dist: { homeCount: number; awayCount: number; totalEntries: number },
  youBacked: 'home' | 'away' | null,
  actualWinner: 'home' | 'away' | null,
): KoSplit {
  return {
    homeCount: dist.homeCount,
    awayCount: dist.awayCount,
    total: dist.totalEntries,
    youBacked,
    actualWinner,
  }
}

// --- League member picks (names) -------------------------------------------

export type LeagueGroupPickRow = {
  displayName: string
  isYou: boolean
  homeScore: number
  awayScore: number
  joker: boolean
  outcome: GroupOutcome
  points: number | null
}

const GROUP_OUTCOME_RANK: Record<GroupOutcome, number> = { exact: 0, correct: 1, wrong: 2, unknown: 3 }

/** Order league group picks best-first (exact → correct → wrong), then by name. */
export function orderLeagueGroupPicks(
  picks: { displayName: string; isYou: boolean; homeScore: number; awayScore: number; joker: boolean }[],
  result: { home: number; away: number } | null,
): LeagueGroupPickRow[] {
  return picks
    .map((p) => ({
      displayName: p.displayName,
      isYou: p.isYou,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      joker: p.joker,
      outcome: outcomeOf(p, result),
      points: groupPickPoints(p, result),
    }))
    .sort(
      (a, b) =>
        GROUP_OUTCOME_RANK[a.outcome] - GROUP_OUTCOME_RANK[b.outcome] ||
        a.displayName.localeCompare(b.displayName),
    )
}

export type LeagueKoPickRow = {
  displayName: string
  isYou: boolean
  backed: 'home' | 'away' | null
  correct: boolean | null
}

/** Order league KO picks: backed-the-winner (✓) → backed-the-loser (✗) → neither. */
export function orderLeagueKoPicks(
  picks: { displayName: string; isYou: boolean; homeStage: KnockoutStage | null; awayStage: KnockoutStage | null }[],
  matchRound: string,
  actualWinner: 'home' | 'away' | null,
): LeagueKoPickRow[] {
  const rank = (r: LeagueKoPickRow) => (r.backed === null ? 2 : r.correct ? 0 : 1)
  return picks
    .map((p) => {
      const backed = backedTeam(p.homeStage, p.awayStage, matchRound)
      const correct = actualWinner === null || backed === null ? null : backed === actualWinner
      return { displayName: p.displayName, isYou: p.isYou, backed, correct }
    })
    .sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName))
}

// --- Consequences ("what it changed") --------------------------------------

export type KoConsequence = {
  // League members who backed the team that actually lost this tie.
  casualties: number
  // A named example for the schadenfreude line, if any.
  example: string | null
}

/** From ordered KO league rows + result, who in the league just lost a pick here. */
export function koLeagueCasualties(rows: LeagueKoPickRow[], hasResult: boolean): KoConsequence {
  if (!hasResult) return { casualties: 0, example: null }
  const losers = rows.filter((r) => r.backed !== null && r.correct === false && !r.isYou)
  return { casualties: losers.length, example: losers[0]?.displayName ?? null }
}
