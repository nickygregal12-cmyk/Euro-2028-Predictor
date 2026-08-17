import { describe, expect, it } from 'vitest'
import {
  catchUpSummary,
  homePhase,
  pointsToday,
  selectBestLeague,
  type HomePhase,
  type LeagueStanding,
} from '../../src/domain/tournament/homeDashboard'
import { resolveHomeCompetitionContext } from '../../src/features/home/homeCompetitionContext'
import type { TournamentData } from '../../src/services/supabase/tournamentData'
import { at } from '../support/indexed'

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

function tournamentData(hasResults: boolean): TournamentData {
  return {
    tournament: {
      id: 'tournament',
      name: 'Euro 2028',
      year: 2028,
      startsOn: '2028-06-14',
      endsOn: '2028-07-14',
      lockAt: '2028-06-14T19:00:00Z',
    },
    groups: [{ id: 'group-a', letter: 'A' }],
    teams: [],
    matches: [
      {
        id: 'match-1',
        matchRef: 'M1',
        round: 'group',
        groupId: 'group-a',
        matchday: 1,
        homeSource: 'A1',
        awaySource: 'A2',
        homeTeamId: null,
        awayTeamId: null,
        matchDate: '2028-06-14',
        kickoffAt: '2028-06-14T19:00:00Z',
        venue: 'Test venue',
        homeScore: hasResults ? 1 : null,
        awayScore: hasResults ? 0 : null,
        resultState: hasResults ? 'confirmed' : 'scheduled',
      },
    ],
  }
}

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

function captureMigratedOutput(input: LegacyPhaseInput) {
  const migrated = resolveHomeCompetitionContext({
    data: tournamentData(input.hasResults),
    submitted: input.submitted,
    entryComplete: input.submitted,
    nowServer: new Date(input.hasResults ? '2028-06-15T12:00:00Z' : '2028-06-14T12:00:00Z'),
    viewerTimeZone: 'UTC',
  })

  return {
    phase: migrated.phase,
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
    const expected = {
      phase: expectedPhase,
      pointsToday: 5,
      bestLeagueId: 'older-first',
      catchUp: { pointsDelta: 5, rankDelta: null },
    }

    expect(captureLegacyOutput(input)).toEqual(expected)
    expect(captureMigratedOutput(input)).toEqual(expected)
  })

  it('uses a genuine point-in-time fixture snapshot for the entry lock', () => {
    const migrated = resolveHomeCompetitionContext({
      data: tournamentData(false),
      submitted: true,
      entryComplete: true,
      nowServer: new Date('2028-06-14T18:00:00Z'),
      viewerTimeZone: 'UTC',
    })

    expect(migrated.context.lockConfigurationValid).toBe(true)
    expect(migrated.context.lockScopes['home-entry']).toMatchObject({
      locked: false,
      lockAt: '2028-06-14T19:00:00.000Z',
      reason: 'before_scope_lock',
    })
  })

  it('derives the Home date from the injected competition timezone', () => {
    const migrated = resolveHomeCompetitionContext({
      data: tournamentData(false),
      submitted: true,
      entryComplete: true,
      nowServer: new Date('2028-06-14T23:30:00Z'),
      viewerTimeZone: 'Europe/London',
    })

    expect(migrated.todayISO).toBe('2028-06-15')
  })

  it('preserves the legacy unsubmitted phase after the shared lock resolves', () => {
    const migrated = resolveHomeCompetitionContext({
      data: tournamentData(false),
      submitted: false,
      entryComplete: true,
      nowServer: new Date('2028-06-14T20:00:00Z'),
      viewerTimeZone: 'UTC',
    })

    expect(migrated.context.entryState).toBe('locked')
    expect(migrated.phase).toBe('preIncomplete')
  })

  it('preserves the legacy partial-result phase edge case', () => {
    const data = tournamentData(false)
    at(data.matches, 0).homeScore = 1

    const migrated = resolveHomeCompetitionContext({
      data,
      submitted: true,
      entryComplete: true,
      nowServer: new Date('2028-06-14T18:00:00Z'),
      viewerTimeZone: 'UTC',
    })

    expect(migrated.phase).toBe('during')
  })
})
