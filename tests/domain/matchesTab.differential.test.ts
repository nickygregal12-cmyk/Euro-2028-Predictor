import { describe, expect, it } from 'vitest'
import {
  currentGroupIndex,
  groupByGroupLetter,
  groupByMatchday,
  type FixtureLike,
} from '../../src/domain/tournament/matchesTab'

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
