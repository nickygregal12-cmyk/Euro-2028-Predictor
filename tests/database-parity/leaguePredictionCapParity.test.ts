import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/20260811220000_league_prediction_cap_honesty.sql')
const contract149 = read('supabase/migrations/20260810150000_season_league_matchweek_predictions.sql')
const contract44 = read('supabase/migrations/20260727182300_bounded_read_models.sql')
const deploymentContract = JSON.parse(read('config/deployment-contract.json')) as {
  requiredRpcSignatures: string[]
}
const proof = read('supabase/tests/220_league_prediction_cap_honesty.sql')

describe('contract 171 league prediction caps', () => {
  it('records the defect it fixes: contract 149 capped with no ordering', () => {
    // Kept as evidence. If this ever stops matching, the thing this contract
    // was written against has changed and its reasoning needs re-reading.
    expect(contract149).toMatch(/where membership\.league_id = p_league_id\n\s*limit 200\) revealed;/)
  })

  it('caps in the order the aggregate ranks by', () => {
    // THE ASSERTION THIS FILE EXISTS FOR. An unordered cap is an arbitrary
    // choice presented as a table: the ranked list can omit the league leader,
    // and two identical calls can disagree.
    expect(migration).not.toMatch(
      /where membership\.league_id = p_league_id\n\s*limit 200\) revealed;/,
    )
    expect(migration).toContain('order by score.points desc nulls last')
    expect(migration).toContain('lower(profile.display_name) collate "C"')
    expect(migration).toContain('md5(membership.user_id::text)\n         limit 200) revealed;')
  })

  it('leaves the tournament read deterministic, as it already was', () => {
    // Contract 44 ordered before truncating from the start. Saying so stops
    // this contract reading as though both reads were equally wrong.
    expect(contract44).toContain('order by profile.display_name, membership.user_id')
    expect(migration).toContain('order by profile.display_name, membership.user_id')
  })

  it('states how many rows it carried and whether that was all of them', () => {
    // The league's real size is already in the payload, so a truncated list
    // beside it is indistinguishable from members who did not predict — and
    // those two need opposite copy.
    expect(migration).toContain("'members_returned'")
    expect(migration).toContain("'members_truncated'")
    expect(migration).toContain("'picks_returned'")
    expect(migration).toContain("'picks_truncated'")
  })

  it('is additive in payload as well as in schema', () => {
    // Every key either read emitted before, it still emits.
    for (const key of ["'member_count'", "'predicted_count'", "'revealed'", "'fixtures'"]) {
      expect(contract149).toContain(key)
      expect(migration).toContain(key)
    }
    for (const key of ["'total_members'", "'locked'", "'kind'", "'picks'"]) {
      expect(migration).toContain(key)
    }
  })

  it('changes neither signature, so no caller breaks', () => {
    expect(deploymentContract.requiredRpcSignatures).toContain(
      'public.get_league_match_picks(uuid,uuid)',
    )
    expect(deploymentContract.requiredRpcSignatures).toContain(
      'public.get_season_league_matchweek_predictions(uuid,uuid)',
    )
    // A page argument would need the old function DROPPED first, because the
    // overload would also match a two-argument call. That is the guarded lane,
    // and it would be paging nothing while the rollout caps stand.
    expect(migration).not.toMatch(/^drop function/im)
    // Not the word — the migration's own prose explains why it is absent —
    // but a PARAMETER. Neither function may gain one.
    expect(migration).not.toMatch(/^\s*p_limit\s+integer/m)
    expect(migration).not.toMatch(/^\s*p_after\s+text/m)
  })

  it('moves no reveal boundary and no grant', () => {
    expect(migration).toContain('predictor_internal.season_matchweek_lock_at')
    expect(migration).toContain("raise exception 'Not a member of this league'")
    expect(migration).toContain(
      'grant execute on function public.get_season_league_matchweek_predictions(uuid, uuid)\n  to authenticated;',
    )
    expect(migration).not.toMatch(/grant execute[^;]*to anon/i)
  })

  it('proves the arbitrary cap by a case where it drops the leader', () => {
    // A cap tested on a league smaller than the cap proves nothing at all.
    expect(proof).toContain('more members than the cap')
    expect(proof).toMatch(/the league leader/i)
  })
})
