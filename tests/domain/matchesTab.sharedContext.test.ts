import { describe, expect, it } from 'vitest'
import {
  currentGroupIndex,
  currentGroupIndexFromContext,
  groupByMatchday,
} from '../../src/domain/tournament/matchesTab'
import { resolveTournamentCompetitionContext } from '../../src/features/shared/tournamentCompetitionContext'
import type { Match, TournamentData } from '../../src/services/supabase/tournamentData'

function match(
  id: string,
  round: Match['round'],
  matchday: number | null,
  kickoffAt: string | null,
  homeScore: number | null = null,
  awayScore: number | null = null,
): Match {
  return {
    id,
    matchRef: id,
    round,
    groupId: round === 'group' ? 'group-a' : null,
    matchday,
    homeSource: '',
    awaySource: '',
    homeTeamId: null,
    awayTeamId: null,
    matchDate: kickoffAt?.slice(0, 10) ?? '2028-06-01',
    kickoffAt,
    venue: '',
    homeScore,
    awayScore,
  }
}

function data(matches: Match[]): TournamentData {
  return {
    tournament: {
      id: 'euro-2028',
      name: 'EURO 2028',
      year: 2028,
      startsOn: '2028-06-09',
      endsOn: '2028-07-09',
      lockAt: '2028-06-09T18:00:00.000Z',
    },
    groups: [{ id: 'group-a', letter: 'A' }],
    teams: [],
    matches,
  }
}

const scenarios = [
  {
    name: 'before the tournament',
    now: new Date('2028-06-01T12:00:00.000Z'),
    matches: [
      match('M01', 'group', 1, '2028-06-09T18:00:00.000Z'),
      match('M13', 'group', 2, '2028-06-14T18:00:00.000Z'),
    ],
  },
  {
    name: 'between group matchdays',
    now: new Date('2028-06-12T12:00:00.000Z'),
    matches: [
      match('M01', 'group', 1, '2028-06-09T18:00:00.000Z', 1, 0),
      match('M13', 'group', 2, '2028-06-14T18:00:00.000Z'),
    ],
  },
  {
    name: 'during the knockout stage',
    now: new Date('2028-06-29T12:00:00.000Z'),
    matches: [
      match('M37', 'r16', null, '2028-06-28T18:00:00.000Z', 2, 1),
      match('M45', 'qf', null, '2028-07-02T18:00:00.000Z'),
    ],
  },
  {
    name: 'after every fixture',
    now: new Date('2028-07-10T12:00:00.000Z'),
    matches: [
      match('M49', 'sf', null, '2028-07-05T18:00:00.000Z', 1, 0),
      match('M51', 'final', null, '2028-07-09T18:00:00.000Z', 2, 1),
    ],
  },
] as const

describe('matches tab shared competition-context parity', () => {
  it.each(scenarios)('$name', ({ now, matches }) => {
    const groups = groupByMatchday([...matches])
    const legacy = currentGroupIndex(groups, now)
    const resolved = resolveTournamentCompetitionContext({
      data: data([...matches]),
      submitted: true,
      entryComplete: true,
      nowServer: now,
      viewerTimeZone: 'Europe/London',
    })
    expect(currentGroupIndexFromContext(groups, resolved.context)).toBe(legacy)
  })

  it('falls back to the last group when the context has no usable next fixture', () => {
    const matches = [
      match('M01', 'group', 1, null),
      match('M13', 'group', 2, null),
    ]
    const groups = groupByMatchday(matches)
    const resolved = resolveTournamentCompetitionContext({
      data: data(matches),
      submitted: false,
      entryComplete: false,
      nowServer: new Date('2028-06-01T12:00:00.000Z'),
      viewerTimeZone: 'Europe/London',
    })
    expect(currentGroupIndexFromContext(groups, resolved.context)).toBe(groups.length - 1)
  })
})
