import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260819110000_same_season_player_profile.sql'),
  'utf8',
)

function executable(text: string): string {
  return text.replaceAll(/--.*$/gm, '').replaceAll(/\s+/g, ' ').trim()
}

const body = executable(migration)

function section(start: string, end: string): string {
  const from = body.indexOf(start)
  const to = body.indexOf(end, from + start.length)
  expect(from).toBeGreaterThan(-1)
  expect(to).toBeGreaterThan(from)
  return body.slice(from, to)
}

describe('Contract 206 uses the season reference as the new profile address', () => {
  it('adds exactly one bounded by-ref profile RPC and a shared internal payload builder', () => {
    expect(body).toContain(
      'create or replace function public.get_season_player_profile_by_ref( p_tournament_id uuid, p_player_ref uuid )',
    )
    expect(body).toContain(
      'create or replace function predictor_internal.season_player_profile_payload(',
    )
  })

  it('proves the caller belongs to the season before resolving the target ref', () => {
    const byRef = section(
      'create or replace function public.get_season_player_profile_by_ref(',
      'comment on function public.get_season_player_profile_by_ref',
    )
    const callerScope = byRef.indexOf('if not exists ( select 1 from public.entries entry')
    const targetResolve = byRef.indexOf('select entry.user_id into v_player_id')
    expect(callerScope).toBeGreaterThan(-1)
    expect(targetResolve).toBeGreaterThan(callerScope)
  })

  it('permits compare at the new ref path without relabelling the reach', () => {
    const byRef = section(
      'create or replace function public.get_season_player_profile_by_ref(',
      'comment on function public.get_season_player_profile_by_ref',
    )
    expect(byRef).toContain("if v_reach not in ('self', 'profile', 'compare') then")
    expect(byRef).toContain('p_player_ref, v_reach, v_reach = \'self\', false')
  })

  it('cannot emit an auth UUID from the ref-addressed public function', () => {
    const byRef = section(
      'create or replace function public.get_season_player_profile_by_ref(',
      'comment on function public.get_season_player_profile_by_ref',
    )
    expect(byRef).not.toContain("'user_id'")
    expect(byRef).not.toContain("'playerId'")
    expect(byRef).toContain('predictor_internal.season_player_profile_payload(')
  })
})

describe('Contract 206 preserves the older narrow UUID boundary', () => {
  it('keeps the legacy RPC at self/private-league reach', () => {
    const legacy = section(
      'create or replace function public.get_season_player_profile(',
      'revoke all on function public.get_season_player_profile(uuid, uuid)',
    )
    expect(legacy).toContain("if v_reach not in ('self', 'profile') then")
    expect(legacy).not.toContain("'compare'")
    expect(legacy).toContain('v_reach = \'self\', true')
  })

  it('shares the payload derivation rather than creating two reveal implementations', () => {
    const occurrences = body.match(/predictor_internal\.season_player_profile_payload\(/g) ?? []
    // Definition + legacy call + by-ref call.
    expect(occurrences).toHaveLength(3)
  })
})

describe('capability and identity remain separate', () => {
  it('makes compare profile-readable while keeping playerId narrow', () => {
    const resolver = section(
      'create or replace function public.resolve_season_player(',
      'comment on function public.resolve_season_player',
    )
    expect(resolver).toContain("'canViewProfile', v_reach in ('self', 'profile', 'compare')")
    expect(resolver).toContain("when v_reach in ('self', 'profile') then to_jsonb(v_player)")
  })

  it('grants the new public read to authenticated and explicitly excludes service_role', () => {
    expect(body).toContain(
      'revoke all on function public.get_season_player_profile_by_ref(uuid, uuid) from public, anon, service_role;',
    )
    expect(body).toContain(
      'grant execute on function public.get_season_player_profile_by_ref(uuid, uuid) to authenticated;',
    )
  })

  it('adds no caller-supplied clock and writes no competitive relation', () => {
    expect(body).not.toMatch(/p_\w+ timestamp/)
    expect(body).not.toMatch(/p_\w+ timestamptz/)
    expect(body).not.toMatch(/\b(insert into|update|delete from) public\./)
  })
})
