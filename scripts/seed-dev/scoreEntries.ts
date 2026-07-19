// Runs the REAL scoring pipeline over the generated seed so the fake
// mid-tournament is internally consistent: calculateScore (domain §1–§4) →
// scoreEventsFromBreakdown → groupScoreEvents. At ~12 group results only group
// matches score; positions/knockout/awards stay pending (the tournament is mid-
// group-stage), which is exactly what the Points breakdown renders as
// "0 · pending". Pure — data in, ranked leaderboard out.

import {
  calculateScore,
  type ScoreActuals,
  type ScorePrediction,
} from '../../src/domain/tournament/calculateScore'
import {
  groupScoreEvents,
  scoreEventsFromBreakdown,
  type ScoreEvent,
  type ScoreEventResolvers,
} from '../../src/domain/tournament/scoreEvents'
import { shortName, teamOf, type Fixture, type FixtureMatch } from './fixture'
import type { GeneratedResult, SeedData } from './generate'

export type ScoredEntry = {
  displayName: string
  total: number
  events: ScoreEvent[]
}

export type RankedScoredEntry = ScoredEntry & { rank: number }

function buildResolvers(
  fixture: Fixture,
  matchByRef: Map<string, FixtureMatch>,
  resultByRef: Map<string, GeneratedResult>,
): ScoreEventResolvers {
  return {
    match: (matchId) => {
      const m = matchByRef.get(matchId)!
      const home = teamOf(fixture, m.groupLetter, m.homeSlot)
      const away = teamOf(fixture, m.groupLetter, m.awaySlot)
      const r = resultByRef.get(matchId)
      const score = r ? `${r.homeScore}–${r.awayScore}` : 'v'
      return {
        text: `${shortName(home.name)} ${score} ${shortName(away.name)}`,
        flag: { name: home.name, countryCode: home.countryCode },
      }
    },
    group: (groupId) => ({ text: `Group ${groupId}` }),
    team: (teamId) => ({ text: teamId }),
  }
}

/** Score every generated entry against the entered results, via the real pipeline. */
export function scoreEntries(fixture: Fixture, data: SeedData): ScoredEntry[] {
  const matchByRef = new Map(fixture.matches.map((m) => [m.matchRef, m]))
  const resultByRef = new Map(data.results.map((r) => [r.matchRef, r]))
  const resolvers = buildResolvers(fixture, matchByRef, resultByRef)

  // Only entered results become actuals; unplayed matches simply don't score.
  const actuals: ScoreActuals = {
    groupMatches: data.results.map((r) => ({
      matchId: r.matchRef,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    })),
  }

  return data.entries.map((entry) => {
    const prediction: ScorePrediction = {
      groupMatches: entry.groupMatches.map((m) => ({
        matchId: m.matchRef,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        joker: m.joker,
      })),
    }
    const breakdown = calculateScore(prediction, actuals)
    // Drop wrong-guess zero rows so the seed's breakdown reads like real scored
    // points; the component still shows "0 · pending" for untouched categories.
    const events = scoreEventsFromBreakdown(breakdown, resolvers, { includeZero: false })
    return { displayName: entry.displayName, total: groupScoreEvents(events).total, events }
  })
}

/**
 * Standard competition ranking: sort by total desc, ties share a rank, ordered
 * alphabetically within a tie (mirrors rankLeaderboard's rule for the printout).
 */
export function rankScored(scored: ScoredEntry[]): RankedScoredEntry[] {
  const sorted = scored
    .slice()
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName))
  let lastTotal: number | null = null
  let lastRank = 0
  return sorted.map((entry, i) => {
    const rank = lastTotal !== null && entry.total === lastTotal ? lastRank : i + 1
    lastTotal = entry.total
    lastRank = rank
    return { ...entry, rank }
  })
}
