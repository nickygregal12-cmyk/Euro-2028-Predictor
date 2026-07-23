import { describe, expect, it } from 'vitest'
import fixtures from '../../fixtures/predicted-group-order.json'
import { resolveGroupTies } from '../../src/domain/tournament/resolveGroupTies'

type Fixture = { name:string; teams:string[]; matches:[string,string,number,number][]; resolutions:{teamIds:string[];order:string[]}[]; status:string; order?:string[] }
describe('predicted group-order shared fixtures', () => {
 for (const f of fixtures as Fixture[]) it(f.name, () => {
   if (f.matches.length !== 6) { expect(f.status).toBe('incomplete'); return }
   const result=resolveGroupTies(f.teams,f.matches.map(([homeTeamId,awayTeamId,homeScore,awayScore])=>({homeTeamId,awayTeamId,homeScore,awayScore})),f.resolutions)
   if (f.status==='unresolved') expect(result.unresolvedGroups.length).toBeGreaterThan(0)
   else { expect(result.unresolvedGroups).toEqual([]); expect(result.standings.map(x=>x.teamId)).toEqual(f.order) }
 })
})
