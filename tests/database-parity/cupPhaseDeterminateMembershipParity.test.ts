import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/20260819120000_cup_phase_determinate_membership.sql')
const previous = read('supabase/migrations/20260811200000_season_cup_initial_group_table.sql')
const proof = read('supabase/tests/253_cup_phase_determinate_membership.sql')

/**
 * The body of the one function this contract replaces, so an assertion about
 * "the lookup" cannot accidentally be satisfied by the file's own prose. The
 * header of this migration quotes the defective predicate verbatim to explain
 * it, and a naive `expect(migration).not.toContain(...)` would fail on the
 * explanation rather than on the code.
 */
function phaseFunctionBody(source: string): string {
  const start = source.indexOf('create or replace function public.get_season_cup_phase(')
  expect(start, 'get_season_cup_phase is not defined in this source').toBeGreaterThan(-1)
  const end = source.indexOf('$get_season_cup_phase$;', start)
  expect(end, 'the function body is unterminated').toBeGreaterThan(start)
  return source.slice(start, end)
}

/** The membership lookup alone — the statement the defect lived in. */
function membershipLookup(source: string): string {
  const body = phaseFunctionBody(source)
  const start = body.indexOf('from public.bonus_cup_members member')
  expect(start, 'the membership lookup is gone').toBeGreaterThan(-1)
  return body.slice(start, body.indexOf(';', start))
}

describe('contract 206 determinate Championship phase membership', () => {
  it('names the phase, so the primary key identifies exactly one row', () => {
    // THE ASSERTION THIS FILE EXISTS FOR. `bonus_cup_members` is keyed
    // (competition_id, user_id, phase_kind); a predicate naming only the first
    // two matches BOTH of a split entrant's rows, and `select ... into` then
    // takes one silently.
    const lookup = membershipLookup(migration)
    expect(lookup).toContain('member.phase_kind =')
    expect(lookup).toContain("later.phase_kind = 'split'")
  })

  it('resolves by the key and never by an ordering', () => {
    // `limit 1` with an `order by` would also return one row, and would be
    // right only until the ordering changed. Contract 205 made the same
    // distinction for the seed lookup and it is the same distinction here.
    const lookup = membershipLookup(migration)
    expect(lookup).not.toMatch(/\blimit\b/i)
    expect(lookup).not.toMatch(/\border\s+by\b/i)
  })

  it('proves the predecessor really was indeterminate', () => {
    // Without this the suite could pass against a codebase where the defect
    // was never there, which would make every assertion above decorative.
    const before = membershipLookup(previous)
    expect(before).not.toContain('phase_kind =')
    expect(before).not.toMatch(/\blimit\b/i)
    expect(before).not.toMatch(/\border\s+by\b/i)
  })

  it('carries the phase dispatcher, the entrancy gate and the payload keys across', () => {
    const body = phaseFunctionBody(migration)
    const before = phaseFunctionBody(previous)

    for (const carried of [
      'predictor_internal.cup_split_group_tables',
      'predictor_internal.cup_initial_group_tables',
      'predictor_internal.cup_is_league_season',
      "'entered', false",
      "'table_source'",
      "'phase_kind', v_phase_kind",
      "'parent_group_id', v_group.parent_group_id",
    ]) {
      expect(body, `${carried} was lost`).toContain(carried)
      expect(before, `${carried} was not there to carry`).toContain(carried)
    }
  })

  it('reads the caller and nobody else, and stays a read', () => {
    const body = phaseFunctionBody(migration)
    expect(body).toContain('member.user_id = v_uid')
    expect(body).toContain('stable')
    expect(body).not.toMatch(/\b(insert|update|delete)\s+(into|from|public\.)/i)
  })

  it('keeps the signature, the security context and the grant unchanged', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain(
      'revoke all on function public.get_season_cup_phase(uuid) from public, anon, authenticated',
    )
    expect(migration).toContain(
      'grant execute on function public.get_season_cup_phase(uuid) to authenticated',
    )
    // One function, one contract. A phase pin that also edited a table
    // authority would be two reverts hiding in one file.
    const replaced = migration.match(/create or replace function/g) ?? []
    expect(replaced).toHaveLength(1)
  })

  it('proves the property against the installed text, not against this file', () => {
    expect(migration).toContain("pg_get_functiondef('public.get_season_cup_phase(uuid)'::regprocedure)")
    expect(migration).toContain('Contract 206: the membership lookup is not pinned to a phase')
    expect(migration).toContain(
      'Contract 206: the membership lookup resolves by ordering, not by key',
    )
  })

  it('is proved by a suite that exercises BOTH memberships and both plans', () => {
    // A split-only suite would pass a "fix" that broke the unsplit entrant,
    // and a seqscan-only suite would pass one whose determinacy came from the
    // planner.
    expect(proof).toContain("'split',")
    expect(proof).toContain('enable_seqscan = off')
    expect(proof).toContain("'initial',")
    expect(proof).toContain("'entered', false")
  })
})
