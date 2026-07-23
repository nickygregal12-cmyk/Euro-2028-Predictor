import { describe, expect, it } from 'vitest'
import fixtures from '../../fixtures/predicted-group-order.json'
import { calculateGroupTable, type MatchScore, type TeamStanding } from '../../src/domain/tournament/calculateGroupTable'
import { resolveGroupTies } from '../../src/domain/tournament/resolveGroupTies'

type Score = [string, string, number, number]
type Expected = Pick<TeamStanding, 'teamId' | 'points' | 'goalDifference' | 'goalsFor'>
type Proof = { criterion: string; tiedTeams: string[]; overall: Expected[]; headToHead: Expected[]; recursiveSubset?: string[]; recursiveHeadToHead?: Expected[] }
type Fixture = { name: string; teams: string[]; matches: Score[]; expectation: 'resolved' | 'unresolved' | 'partial'; order?: string[]; unresolved?: string[][]; ranks?: number[]; criterionProof?: Proof; automaticProof?: Proof }
const batch2 = new Set(['two-team-head-to-head-points', 'three-team-overall-goals-scored-fallback', 'three-team-head-to-head-goal-difference', 'three-team-head-to-head-goals-scored', 'recursive-subset-resolved', 'recursive-subset-unresolved'])
const scores = (matches: Score[]): MatchScore[] => matches.map(([homeTeamId, awayTeamId, homeScore, awayScore]) => ({ homeTeamId, awayTeamId, homeScore, awayScore }))
const find = (table: TeamStanding[], id: string) => table.find((s) => s.teamId === id)!
function tableIs(teams: string[], matches: MatchScore[], expected: Expected[]) { const table = calculateGroupTable(teams, matches); expect(expected.map((s) => find(table, s.teamId))).toMatchObject(expected) }
function proofIs(fixture: Fixture, matches: MatchScore[]) {
  const proof = fixture.automaticProof ?? fixture.criterionProof
  if (!proof) return
  tableIs(fixture.teams, matches, proof.overall); tableIs(proof.tiedTeams, matches, proof.headToHead)
  const h2h = calculateGroupTable(proof.tiedTeams, matches)
  const values = (key: 'points' | 'goalDifference' | 'goalsFor') => proof.tiedTeams.map((id) => find(h2h, id)[key])
  if (proof.criterion === 'head-to-head-goal-difference') { expect(new Set(values('points')).size).toBe(1); expect(new Set(values('goalDifference')).size).toBeGreaterThan(1) }
  if (proof.criterion === 'head-to-head-goals-scored') { expect(new Set(values('points')).size).toBe(1); expect(new Set(values('goalDifference')).size).toBe(1); expect(new Set(values('goalsFor')).size).toBeGreaterThan(1) }
  if (proof.criterion === 'overall-goals-scored') { expect(new Set(values('points')).size).toBe(1); expect(new Set(values('goalDifference')).size).toBe(1); expect(new Set(values('goalsFor')).size).toBe(1); expect(new Set(proof.overall.map((s) => s.goalDifference)).size).toBe(1); expect(new Set(proof.overall.map((s) => s.goalsFor)).size).toBeGreaterThan(1) }
  if (proof.recursiveSubset) { tableIs(proof.recursiveSubset, matches, proof.recursiveHeadToHead!); const initial = proof.recursiveSubset.map((id) => find(h2h, id)); const recursive = calculateGroupTable(proof.recursiveSubset, matches); expect(initial).not.toMatchObject(proof.recursiveSubset.map((id) => find(recursive, id))) }
}
for (const fixture of fixtures as Fixture[]) describe(`fixture: ${fixture.name}`, () => it('matches the production resolver contract', () => { const matches = scores(fixture.matches); const result = resolveGroupTies(fixture.teams, matches); proofIs(fixture, matches); if (fixture.expectation === 'resolved') { expect(result.unresolvedGroups).toEqual([]); expect(result.standings.map((s) => s.teamId)).toEqual(fixture.order) } else { expect(result.unresolvedGroups).toEqual(fixture.unresolved); if (fixture.order) expect(result.standings.map((s) => s.teamId)).toEqual(fixture.order); if (fixture.ranks) expect(result.standings.map((s) => s.rank)).toEqual(fixture.ranks) } }))
const variants = <T,>(items: T[]) => [items, [...items].reverse(), [...items.slice(1), items[0]]]
const blocks = (value: string[][]) => value.map((x) => [...x].sort()).sort((a, b) => a.join().localeCompare(b.join()))
describe('Batch 2 input-order independence', () => { for (const fixture of fixtures as Fixture[]) if (batch2.has(fixture.name)) it(fixture.name, () => { const expected = resolveGroupTies(fixture.teams, scores(fixture.matches)); for (const teams of variants(fixture.teams)) for (const matches of variants(scores(fixture.matches))) { const result = resolveGroupTies(teams, matches); if (fixture.expectation === 'resolved') expect(result.standings.map((s) => s.teamId)).toEqual(expected.standings.map((s) => s.teamId)); else { expect(blocks(result.unresolvedGroups)).toEqual(blocks(expected.unresolvedGroups)); expect(result.standings.map((s) => s.rank).sort()).toEqual(expected.standings.map((s) => s.rank).sort()); expect(result.standings.filter((s) => s.tiedUnresolved).map((s) => s.teamId).sort()).toEqual(expected.standings.filter((s) => s.tiedUnresolved).map((s) => s.teamId).sort()) } } }); it('keeps all-draws unresolved without an input-order fallback', () => { const fixture = (fixtures as Fixture[]).find((x) => x.name === 'all-draws-unresolved')!; for (const teams of variants(fixture.teams)) for (const matches of variants(scores(fixture.matches))) { const result = resolveGroupTies(teams, matches); expect(blocks(result.unresolvedGroups)).toEqual([['a', 'b', 'c', 'd']]); expect(result.standings.every((s) => s.rank === 1 && s.tiedUnresolved)).toBe(true) } }) })
