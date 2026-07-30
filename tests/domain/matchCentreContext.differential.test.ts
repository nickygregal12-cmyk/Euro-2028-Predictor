import { describe, expect, it } from 'vitest'
import { lifecycleToLegacyTemporalState } from '../../src/domain/tournament/matchCentreLegacyBridge'
import {
  adaptRepositoryMatchToCentre,
  legacyRepositoryLifecycle,
} from '../../src/domain/tournament/matchCentreRepositoryAdapter'
import { resolveMatchCentreCompetitionContext } from '../../src/features/matches/matchCentreCompetitionContext'
import type { Match, Team, TournamentData } from '../../src/services/supabase/tournamentData'

const TEAMS: Team[] = [
  { id: 'home', name: 'Home', groupId: 'group-a', slot: 1 },
  { id: 'away', name: 'Away', groupId: 'group-a', slot: 2 },
]

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    matchRef: 'M01',
    round: 'group',
    groupId: 'group-a',
    matchday: 1,
    homeSource: 'Home source',
    awaySource: 'Away source',
    homeTeamId: 'home',
    awayTeamId: 'away',
    matchDate: '2028-06-10',
    kickoffAt: '2028-06-10T18:00:00Z',
    venue: 'Wembley Stadium',
    homeScore: null,
    awayScore: null,
    resultState: 'scheduled',
    resultMethod: null,
    homeScore90: null,
    awayScore90: null,
    homeScore120: null,
    awayScore120: null,
    homePenalties: null,
    awayPenalties: null,
    winnerTeamId: null,
    ...overrides,
  }
}

function tournamentData(fixture: Match): TournamentData {
  return {
    tournament: {
      id: 'euro-2028',
      name: 'Euro 2028',
      year: 2028,
      startsOn: '2028-06-10',
      endsOn: '2028-07-09',
      lockAt: fixture.kickoffAt,
    },
    groups: [{ id: 'group-a', letter: 'A' }],
    teams: TEAMS,
    matches: [fixture],
  }
}

function resultShape(model: ReturnType<typeof adaptRepositoryMatchToCentre>) {
  return {
    lifecycle: model.external.lifecycle,
    temporalState: lifecycleToLegacyTemporalState(model.external.lifecycle),
    kickoffAt: model.external.kickoffAt,
    score: model.external.score,
    source: {
      provider: model.external.source.provider,
      freshnessSeconds: model.external.source.freshnessSeconds,
      isStale: model.external.source.isStale,
      dataQuality: model.external.source.dataQuality,
    },
  }
}

/**
 * Immutable pre-migration capture of the repository Match Centre lifecycle.
 * A passed kickoff without an authoritative feed deliberately remains upcoming;
 * the shared-context migration must not manufacture a live period.
 */
function captureLegacy(input: { match: Match; now: string }) {
  const lifecycle = legacyRepositoryLifecycle(input.match, input.now)
  const model = adaptRepositoryMatchToCentre({
    match: input.match,
    teams: TEAMS,
    now: input.now,
    fetchedAt: input.now,
    resolvedState:
      lifecycle === 'FULL_TIME'
        ? 'confirmed'
        : lifecycle === 'PRE_MATCH'
          ? 'scheduled_editable'
          : 'scheduled_locked',
  })
  return resultShape(model)
}

function captureMigrated(input: { match: Match; now: string }) {
  const nowServer = new Date(input.now)
  const resolved = resolveMatchCentreCompetitionContext({
    data: tournamentData(input.match),
    matchId: input.match.id,
    submitted: true,
    nowServer,
    timeZone: 'Europe/London',
    fetchedAt: input.now,
  })
  return {
    resolvedState: resolved.state,
    output: resultShape(
      adaptRepositoryMatchToCentre({
        match: input.match,
        teams: TEAMS,
        now: input.now,
        fetchedAt: input.now,
        resolvedState: resolved.state,
      }),
    ),
  }
}

const SCENARIOS = {
  farBefore: {
    match: match(),
    now: '2028-06-10T12:00:00Z',
  },
  startingSoon: {
    match: match(),
    now: '2028-06-10T17:30:00Z',
  },
  passedKickoffNoFeed: {
    match: match(),
    now: '2028-06-10T19:00:00Z',
  },
  fullTime: {
    match: match({
      homeScore: 2,
      awayScore: 1,
      resultState: 'confirmed',
    }),
    now: '2028-06-10T20:30:00Z',
  },
  dateOnlyFallback: {
    match: match({ kickoffAt: null, matchDate: '2028-06-11' }),
    now: '2028-06-11T12:00:00Z',
  },
  invalidKickoff: {
    match: match({ kickoffAt: 'not-a-date' }),
    now: '2028-06-10T17:30:00Z',
  },
}

const EXPECTED = {
  farBefore: {
    lifecycle: 'SCHEDULED',
    temporalState: 'before',
    kickoffAt: '2028-06-10T18:00:00Z',
    score: null,
    source: {
      provider: 'repository',
      freshnessSeconds: 0,
      isStale: false,
      dataQuality: 'provisional',
    },
  },
  startingSoon: {
    lifecycle: 'PRE_MATCH',
    temporalState: 'before',
    kickoffAt: '2028-06-10T18:00:00Z',
    score: null,
    source: {
      provider: 'repository',
      freshnessSeconds: 0,
      isStale: false,
      dataQuality: 'provisional',
    },
  },
  passedKickoffNoFeed: {
    lifecycle: 'SCHEDULED',
    temporalState: 'before',
    kickoffAt: '2028-06-10T18:00:00Z',
    score: null,
    source: {
      provider: 'repository',
      freshnessSeconds: 0,
      isStale: false,
      dataQuality: 'provisional',
    },
  },
  fullTime: {
    lifecycle: 'FULL_TIME',
    temporalState: 'after',
    kickoffAt: '2028-06-10T18:00:00Z',
    score: { home: 2, away: 1 },
    source: {
      provider: 'repository',
      freshnessSeconds: 0,
      isStale: false,
      dataQuality: 'verified',
    },
  },
  dateOnlyFallback: {
    lifecycle: 'SCHEDULED',
    temporalState: 'before',
    kickoffAt: '2028-06-11T00:00:00.000Z',
    score: null,
    source: {
      provider: 'repository',
      freshnessSeconds: 0,
      isStale: false,
      dataQuality: 'provisional',
    },
  },
  invalidKickoff: {
    lifecycle: 'SCHEDULED',
    temporalState: 'before',
    kickoffAt: 'not-a-date',
    score: null,
    source: {
      provider: 'repository',
      freshnessSeconds: 0,
      isStale: false,
      dataQuality: 'provisional',
    },
  },
} as const

describe('Match Centre legacy differential fixture', () => {
  it('retains the captured lifecycle and fail-closed feed behaviour', () => {
    expect({
      farBefore: captureLegacy(SCENARIOS.farBefore),
      startingSoon: captureLegacy(SCENARIOS.startingSoon),
      passedKickoffNoFeed: captureLegacy(SCENARIOS.passedKickoffNoFeed),
      fullTime: captureLegacy(SCENARIOS.fullTime),
      dateOnlyFallback: captureLegacy(SCENARIOS.dateOnlyFallback),
      invalidKickoff: captureLegacy(SCENARIOS.invalidKickoff),
    }).toEqual(EXPECTED)
  })
})

describe('Match Centre competition-context migration', () => {
  it.each(Object.entries(SCENARIOS))('preserves legacy output for %s', (name, scenario) => {
    const migrated = captureMigrated(scenario)
    expect(migrated.output).toEqual(EXPECTED[name as keyof typeof EXPECTED])
  })

  it('observes passed kickoff and feedless full-time heuristics without exposing them as live', () => {
    const passed = captureMigrated(SCENARIOS.passedKickoffNoFeed)
    const feedlessFullTime = captureMigrated({
      match: match(),
      now: '2028-06-10T20:30:00Z',
    })

    expect(passed.resolvedState).toBe('in_play_no_feed')
    expect(passed.output.lifecycle).toBe('SCHEDULED')
    expect(feedlessFullTime.resolvedState).toBe('full_time_unconfirmed')
    expect(feedlessFullTime.output.lifecycle).toBe('SCHEDULED')
  })

  it('fails the lock closed when the fixture snapshot is stale', () => {
    const fixture = match()
    const resolved = resolveMatchCentreCompetitionContext({
      data: tournamentData(fixture),
      matchId: fixture.id,
      submitted: true,
      nowServer: new Date('2028-06-10T12:00:01Z'),
      timeZone: 'Europe/London',
      fetchedAt: '2028-06-10T12:00:00Z',
    })

    expect(resolved.match?.lockState).toMatchObject({
      locked: true,
      reason: 'stale_fixture_data',
    })
    expect(resolved.state).toBe('scheduled_locked')
  })
})
