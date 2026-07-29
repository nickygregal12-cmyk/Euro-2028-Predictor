import { describe, expect, it } from 'vitest'
import {
  catchUpSummary,
  homePhase,
  pointsToday,
  selectBestLeague,
  type HomePhase,
  type LeagueStanding,
} from '../../src/domain/tournament/homeDashboard'

type LegacyPhaseInput = Parameters<typeof homePhase>[0]

type LegacyScenario = {
  name: string
  input: LegacyPhaseInput
  expectedPhase: HomePhase
}

/**
 * Pre-migration fixtures captured from the legacy Home domain contract.
 *
 * The scenario labels deliberately include timing, lock, feed and tournament
 * states that the migration request expects Home to distinguish. The legacy
 * function cannot observe those dimensions: its complete input is only
 * `{ hasResults, submitted }`. The repeated outputs below are therefore the
 * behaviour to preserve or explicitly disposition before any engine adapter is
 * wired. Do not update these fixtures to match a future implementation.
 */
const LEGACY_SCENARIOS: readonly LegacyScenario[] = [
  {
    name: 'pre-tournament incomplete entry',
    input: { hasResults: false, submitted: false },
    expectedPhase: 'preIncomplete',
  },
  {
    name: 'pre-lock submitted entry',
    input: { hasResults: false, submitted: true },
    expectedPhase: 'preSubmitted',
  },
  {
    name: 'locked submitted entry before a result exists',
    input: { hasResults: false, submitted: true },
    expectedPhase: 'preSubmitted',
  },
  {
    name: 'live match before the first result is stored',
    input: { hasResults: false, submitted: true },
    expectedPhase: 'preSubmitted',
  },
  {
    name: 'live tournament after a result exists',
    input: { hasResults: true, submitted: true },
    expectedPhase: 'during',
  },
  {
    name: 'between matchdays',
    input: { hasResults: true, submitted: true },
    expectedPhase: 'during',
  },
  {
    name: 'knockout stage',
    input: { hasResults: true, submitted: true },
    expectedPhase: 'during',
  },
  {
    name: 'complete tournament',
    input: { hasResults: true, submitted: true },
    expectedPhase: 'during',
  },
  {
    name: 'feedless state after results exist',
    input: { hasResults: true, submitted: true },
    expectedPhase: 'during',
  },
  {
    name: 'unavailable dashboard data before results exist',
    input: { hasResults: false, submitted: true },
    expectedPhase: 'preSubmitted',
  },
]

const MATCH_DATES = new Map([
  ['today-match', '2028-06-14'],
  ['other-day-match', '2028-06-15'],
])

const SCORE_EVENTS = [
  { matchId: 'today-match', points: 5 },
  { matchId: 'other-day-match', points: 3 },
  { matchId: null, points: 40 },
]

const LEAGUES: LeagueStanding[] = [
  {
    id: 'recent-second',
    name: 'Recent second place',
    memberCount: 8,
    rank: 2,
    gapToTop: 4,
    lastActivityMs: 200,
  },
  {
    id: 'older-first',
    name: 'Older first place',
    memberCount: 12,
    rank: 1,
    gapToTop: 0,
    lastActivityMs: 100,
  },
]

function captureLegacyOutput(input: LegacyPhaseInput) {
  return {
    phase: homePhase(input),
    pointsToday: pointsToday(SCORE_EVENTS, MATCH_DATES, '2028-06-14'),
    bestLeagueId: selectBestLeague(LEAGUES)?.id ?? null,
    catchUp: catchUpSummary({
      lastSeenAt: '2028-06-13T00:00:00Z',
      lastSeenPoints: 20,
      currentPoints: 25,
    }),
  }
}

describe('homeDashboard legacy differential fixtures', () => {
  it.each(LEGACY_SCENARIOS)('$name', ({ input, expectedPhase }) => {
    expect(captureLegacyOutput(input)).toEqual({
      phase: expectedPhase,
      pointsToday: 5,
      bestLeagueId: 'older-first',
      catchUp: { pointsDelta: 5, rankDelta: null },
    })
  })
})
