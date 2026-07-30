import { describe, expect, it } from 'vitest'
import { lifecycleToLegacyTemporalState } from '../../src/domain/tournament/matchCentreLegacyBridge'
import { adaptRepositoryMatchToCentre } from '../../src/domain/tournament/matchCentreRepositoryAdapter'
import type { Match, Team } from '../../src/services/supabase/tournamentData'

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

/**
 * Immutable pre-migration capture of the repository Match Centre lifecycle.
 * A passed kickoff without an authoritative feed deliberately remains upcoming;
 * the shared-context migration must not manufacture a live period.
 */
function captureLegacy(input: { match: Match; now: string }) {
  const model = adaptRepositoryMatchToCentre({
    match: input.match,
    teams: TEAMS,
    now: input.now,
    fetchedAt: input.now,
  })

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

describe('Match Centre legacy differential fixture', () => {
  it('captures the repository lifecycle and fail-closed feed behaviour', () => {
    expect({
      farBefore: captureLegacy({
        match: match(),
        now: '2028-06-10T12:00:00Z',
      }),
      startingSoon: captureLegacy({
        match: match(),
        now: '2028-06-10T17:30:00Z',
      }),
      passedKickoffNoFeed: captureLegacy({
        match: match(),
        now: '2028-06-10T19:00:00Z',
      }),
      fullTime: captureLegacy({
        match: match({
          homeScore: 2,
          awayScore: 1,
          resultState: 'confirmed',
        }),
        now: '2028-06-10T20:30:00Z',
      }),
      dateOnlyFallback: captureLegacy({
        match: match({ kickoffAt: null, matchDate: '2028-06-11' }),
        now: '2028-06-11T12:00:00Z',
      }),
      invalidKickoff: captureLegacy({
        match: match({ kickoffAt: 'not-a-date' }),
        now: '2028-06-10T17:30:00Z',
      }),
    }).toEqual({
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
    })
  })
})
