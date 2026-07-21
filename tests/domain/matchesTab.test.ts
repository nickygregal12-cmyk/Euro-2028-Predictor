import { describe, it, expect } from 'vitest'
import {
  groupByMatchday,
  groupByGroupLetter,
  currentGroupIndex,
  type FixtureLike,
} from '../../src/domain/tournament/matchesTab'

const fx = (o: Partial<FixtureLike> & { id: string; round: string }): FixtureLike => ({
  matchday: null,
  groupId: null,
  matchDate: '2028-06-10',
  kickoffAt: null,
  matchRef: o.id,
  ...o,
})

describe('groupByMatchday', () => {
  const matches: FixtureLike[] = [
    fx({ id: 'GA-1', round: 'group', matchday: 1, groupId: 'A', kickoffAt: '2028-06-10T18:00:00Z' }),
    fx({ id: 'GB-1', round: 'group', matchday: 1, groupId: 'B', kickoffAt: '2028-06-10T15:00:00Z' }),
    fx({ id: 'GA-4', round: 'group', matchday: 2, groupId: 'A', kickoffAt: '2028-06-14T18:00:00Z' }),
    fx({ id: 'R16-1', round: 'r16', kickoffAt: '2028-06-27T18:00:00Z' }),
    fx({ id: 'FINAL', round: 'final', kickoffAt: '2028-07-09T18:00:00Z' }),
  ]

  it('groups + orders MD1 → MD2 → … → Final, dropping empty matchdays', () => {
    const g = groupByMatchday(matches)
    expect(g.map((x) => x.key)).toEqual(['MD1', 'MD2', 'R16', 'FINAL'])
    expect(g[0].label).toBe('Matchday 1')
    expect(g[2].label).toBe('Round of 16')
  })

  it('orders fixtures within a matchday by kickoff time', () => {
    const md1 = groupByMatchday(matches).find((x) => x.key === 'MD1')!
    expect(md1.matches.map((m) => m.id)).toEqual(['GB-1', 'GA-1']) // 15:00 before 18:00
  })
})

describe('groupByGroupLetter', () => {
  const matches: FixtureLike[] = [
    fx({ id: 'GA-1', round: 'group', matchday: 1, groupId: 'gA' }),
    fx({ id: 'GB-1', round: 'group', matchday: 1, groupId: 'gB' }),
    fx({ id: 'GA-2', round: 'group', matchday: 2, groupId: 'gA' }),
    fx({ id: 'R16-1', round: 'r16', groupId: null }),
  ]
  const letterOf = (id: string | null) => (id === 'gA' ? 'A' : id === 'gB' ? 'B' : null)

  it('regroups group-stage fixtures by letter, excludes knockouts', () => {
    const g = groupByGroupLetter(matches, letterOf)
    expect(g.map((x) => x.label)).toEqual(['Group A', 'Group B'])
    expect(g[0].matches.map((m) => m.id)).toEqual(['GA-1', 'GA-2'])
    expect(g.flatMap((x) => x.matches).some((m) => m.round === 'r16')).toBe(false)
  })
})

describe('currentGroupIndex', () => {
  const groups = groupByMatchday([
    fx({ id: 'GA-1', round: 'group', matchday: 1, kickoffAt: '2028-06-10T18:00:00Z' }),
    fx({ id: 'GA-4', round: 'group', matchday: 2, kickoffAt: '2028-06-14T18:00:00Z' }),
    fx({ id: 'GA-6', round: 'group', matchday: 3, kickoffAt: '2028-06-18T18:00:00Z' }),
  ])

  it('is the first matchday with a future match (mid-tournament)', () => {
    expect(currentGroupIndex(groups, new Date('2028-06-12T00:00:00Z'))).toBe(1) // MD1 past, MD2 next
  })
  it('is the first group when everything is upcoming', () => {
    expect(currentGroupIndex(groups, new Date('2026-01-01T00:00:00Z'))).toBe(0)
  })
  it('is the last group once everything is played', () => {
    expect(currentGroupIndex(groups, new Date('2028-08-01T00:00:00Z'))).toBe(2)
  })
})
