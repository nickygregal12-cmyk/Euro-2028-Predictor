import { describe, expect, it } from 'vitest'
import {
  currentGroupIndex,
  groupByGroupLetter,
  groupByMatchday,
  type FixtureLike,
} from '../../src/domain/tournament/matchesTab'
import { resolveMatchesCompetitionContext } from '../../src/features/matches/matchesCompetitionContext'
import type { Match, TournamentData } from '../../src/services/supabase/tournamentData'

const fixture = (
  input: Partial<FixtureLike> & Pick<FixtureLike, 'id' | 'round' | 'matchRef'>,
): FixtureLike => ({
  matchday: null,
  groupId: null,
  matchDate: '2028-06-09',
  kickoffAt: null,
  ...input,
})

/**
 * Immutable pre-migration capture of the Matches tab grouping and auto-scroll
 * contract. Keep the expected object unchanged when the shared competition
 * context is wired; the migrated adapter must reproduce it.
 */
const MATCHES: FixtureLike[] = [
  fixture({
    id: 'md1-late',
    matchRef: 'M02',
    round: 'group',
    matchday: 1,
    groupId: 'group-a',
    kickoffAt: '2028-06-09T20:00:00Z',
  }),
  fixture({
    id: 'md1-early',
    matchRef: 'M01',
    round: 'group',
    matchday: 1,
    groupId: 'group-b',
    kickoffAt: '2028-06-09T17:00:00Z',
  }),
  fixture({
    id: 'md2-date-only',
    matchRef: 'M03',
    round: 'group',
    matchday: 2,
    groupId: 'group-a',
    matchDate: '2028-06-13',
    kickoffAt: null,
  }),
  fixture({
    id: 'md3',
    matchRef: 'M04',
    round: 'group',
    matchday: 3,
    groupId: 'group-b',
    kickoffAt: '2028-06-17T20:00:00Z',
  }),
  fixture({
    id: 'r16',
    matchRef: 'M37',
    round: 'r16',
    kickoffAt: '2028-06-24T17:00:00Z',
  }),
  fixture({
    id: 'final',
    matchRef: 'M51',
    round: 'final',
    kickoffAt: '2028-07-09T20:00:00Z',
  }),
]

const LETTERS = new Map([
  ['group-a', 'A'],
  ['group-b', 'B'],
])

function toMatch(match: FixtureLike): Match {
  return {
    ...match,
    round: match.round as Match['round'],
    homeSource: '',
    awaySource: '',
    homeTeamId: null,
    awayTeamId: null,
    venue: '',
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
  }
}

const TOURNAMENT_DATA: TournamentData = {
  tournament: {
    id: 'euro-2028',
    name: 'Euro 2028',
    year: 2028,
    startsOn: '2028-06-09',
    endsOn: '2028-07-09',
    lockAt: '2028-06-09T17:00:00Z',
  },
  groups: [
    { id: 'group-a', letter: 'A' },
    { id: 'group-b', letter: 'B' },
  ],
  teams: [],
  matches: MATCHES.map(toMatch),
}

function captureLegacyOutput() {
  const matchdays = groupByMatchday(MATCHES)
  const groups = groupByGroupLetter(MATCHES, (groupId) => LETTERS.get(groupId ?? '') ?? null)

  return {
    matchdays: matchdays.map((group) => ({
      key: group.key,
      label: group.label,
      matchIds: group.matches.map((match) => match.id),
    })),
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      matchIds: group.matches.map((match) => match.id),
    })),
    indexes: {
      empty: currentGroupIndex([], new Date('2028-06-10T00:00:00Z')),
      beforeTournament: currentGroupIndex(matchdays, new Date('2028-01-01T00:00:00Z')),
      exactKickoff: currentGroupIndex(matchdays, new Date('2028-06-09T17:00:00Z')),
      betweenMatchdays: currentGroupIndex(matchdays, new Date('2028-06-10T00:00:00Z')),
      dateOnlyBoundary: currentGroupIndex(matchdays, new Date('2028-06-13T00:00:00Z')),
      knockoutFront: currentGroupIndex(matchdays, new Date('2028-06-20T00:00:00Z')),
      afterTournament: currentGroupIndex(matchdays, new Date('2028-08-01T00:00:00Z')),
    },
  }
}

describe('Matches tab legacy differential fixture', () => {
  it('captures grouping, ordering and current-front selection before migration', () => {
    expect(captureLegacyOutput()).toEqual({
      matchdays: [
        { key: 'MD1', label: 'Matchday 1', matchIds: ['md1-early', 'md1-late'] },
        { key: 'MD2', label: 'Matchday 2', matchIds: ['md2-date-only'] },
        { key: 'MD3', label: 'Matchday 3', matchIds: ['md3'] },
        { key: 'R16', label: 'Round of 16', matchIds: ['r16'] },
        { key: 'FINAL', label: 'Final', matchIds: ['final'] },
      ],
      groups: [
        { key: 'GA', label: 'Group A', matchIds: ['md1-late', 'md2-date-only'] },
        { key: 'GB', label: 'Group B', matchIds: ['md1-early', 'md3'] },
      ],
      indexes: {
        empty: 0,
        beforeTournament: 0,
        exactKickoff: 0,
        betweenMatchdays: 1,
        dateOnlyBoundary: 1,
        knockoutFront: 3,
        afterTournament: 4,
      },
    })
  })
})

describe('Matches competition-context migration parity', () => {
  const groups = groupByMatchday(TOURNAMENT_DATA.matches)
  const scenarios = [
    ['before tournament', '2028-01-01T00:00:00Z'],
    ['at opening kickoff', '2028-06-09T17:00:00Z'],
    ['between matchdays', '2028-06-10T00:00:00Z'],
    ['at the date-only fallback boundary', '2028-06-13T00:00:00Z'],
    ['at the knockout front', '2028-06-20T00:00:00Z'],
    ['after the tournament', '2028-08-01T00:00:00Z'],
  ] as const

  it.each(scenarios)('preserves the legacy current-front index %s', (_name, instant) => {
    const nowServer = new Date(instant)
    const legacy = currentGroupIndex(groups, nowServer)
    const migrated = resolveMatchesCompetitionContext({
      data: TOURNAMENT_DATA,
      groups,
      submitted: true,
      nowServer,
      timeZone: 'Europe/London',
    })

    expect(migrated.currentGroupIndex).toBe(legacy)
  })

  it('derives the entry lock and match state through the shared resolvers', () => {
    const resolved = resolveMatchesCompetitionContext({
      data: TOURNAMENT_DATA,
      groups,
      submitted: true,
      nowServer: new Date('2028-06-09T17:00:00Z'),
      timeZone: 'Europe/London',
    })

    expect(resolved.context.lockScopes['matches-entry']).toMatchObject({
      locked: true,
      reason: 'already_locked',
    })
    expect(resolved.context.matches.find((match) => match.id === 'md1-early')?.state).toBe(
      'in_play_no_feed',
    )
  })

  it('injects the competition timezone into day-state resolution', () => {
    const match = toMatch(
      fixture({
        id: 'timezone-match',
        matchRef: 'TZ1',
        round: 'group',
        matchday: 1,
        groupId: 'group-a',
        matchDate: '2028-06-10',
        kickoffAt: '2028-06-10T00:30:00Z',
      }),
    )
    const data = { ...TOURNAMENT_DATA, matches: [match] }
    const timezoneGroups = groupByMatchday(data.matches)
    const nowServer = new Date('2028-06-09T23:30:00Z')

    const london = resolveMatchesCompetitionContext({
      data,
      groups: timezoneGroups,
      submitted: true,
      nowServer,
      timeZone: 'Europe/London',
    })
    const utc = resolveMatchesCompetitionContext({
      data,
      groups: timezoneGroups,
      submitted: true,
      nowServer,
      timeZone: 'UTC',
    })

    expect(london.context.dayState).toBe('before_first_match')
    expect(utc.context.dayState).toBe('no_matches_today')
  })

  it('fails the lock closed when no fixture snapshot can be assembled', () => {
    const emptyData = { ...TOURNAMENT_DATA, matches: [] }
    const resolved = resolveMatchesCompetitionContext({
      data: emptyData,
      groups: [],
      submitted: false,
      nowServer: new Date('2028-06-01T00:00:00Z'),
      timeZone: 'Europe/London',
    })

    expect(resolved.currentGroupIndex).toBe(0)
    expect(resolved.context.lockScopes['matches-entry']).toMatchObject({
      locked: true,
      reason: 'missing_fixture_data',
    })
  })
})
