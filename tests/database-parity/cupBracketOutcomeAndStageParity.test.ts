import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/20260819130000_cup_bracket_outcome_and_knockout_stage.sql')
const previous = read('supabase/migrations/20260819100000_cup_bracket_seed_initial_phase.sql')
const proof = read('supabase/tests/253_cup_bracket_outcome_and_knockout_stage.sql')

/**
 * The function body alone. Both migrations quote the DEFECTIVE predicate in
 * their prose to explain it, so a whole-file assertion would be answered by the
 * explanation rather than by the code — the failure mode contract 205's own
 * review hit when it counted a helper's name and matched its `COMMENT ON`.
 */
function bracketBody(source: string): string {
  const start = source.indexOf('create or replace function public.get_season_cup_bracket(')
  expect(start, 'get_season_cup_bracket is not defined in this source').toBeGreaterThan(-1)
  const end = source.indexOf('$bracket$;', start)
  expect(end, 'the function body is unterminated').toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('contract 207 Championship outcome and knockout stage', () => {
  describe('the elimination gap', () => {
    it('reads the outcome from the entrant row and emits it unchanged', () => {
      const body = bracketBody(migration)
      expect(body).toContain('select entrant.outcome')
      expect(body).toContain("'your_outcome', v_outcome")
    })

    it('never derives it', () => {
      // THE ASSERTION THIS BLOCK EXISTS FOR. Every available inference — a lost
      // tie, an absent later fixture, a missing seed — looks conclusive and is
      // wrong whenever the competition has not finished eliminating. The value
      // must be a variable carrying a stored column and nothing else.
      const body = bracketBody(migration)
      const emitted = body.slice(body.indexOf("'your_outcome',"))
      const value = emitted.slice("'your_outcome',".length, emitted.indexOf('\n'))
      expect(value.trim()).toBe('v_outcome,')
      expect(body).not.toMatch(/'your_outcome',\s*case/i)
      expect(body).not.toMatch(/'your_outcome',\s*'/)
    })

    it('reads it for the caller only, and reaches the entrant table once', () => {
      // A per-seat outcome would turn a draw sheet into a disclosure of every
      // entrant's standing — the boundary the Penalty Number already keeps.
      const body = bracketBody(migration)
      expect(body).toContain('entrant.user_id = v_uid')
      expect(body.match(/from public\.bonus_competition_entrants/g) ?? []).toHaveLength(1)
    })

    it('proves the key was genuinely absent before', () => {
      expect(bracketBody(previous)).not.toContain('your_outcome')
    })
  })

  describe('knockout means knockout', () => {
    it('names the two knockout stages in all four predicates', () => {
      const body = bracketBody(migration)
      expect(body.match(/stage in \('playoff', 'knockout'\)/g) ?? []).toHaveLength(4)
      expect(body).not.toContain("stage <> 'group'")
    })

    it('proves the predecessor really did use the broad form four times', () => {
      expect(bracketBody(previous).match(/stage <> 'group'/g) ?? []).toHaveLength(4)
    })

    it('agrees with the contracts that already narrowed it', () => {
      // Contract 194 ASSERTS against the broad form reappearing and contract
      // 195 states why. Contract 193 was the outlier, not the precedent.
      const c194 = read('supabase/migrations/20260817150000_cup_tie_eligibility.sql')
      const c195 = read('supabase/migrations/20260818000000_cup_penalty_number_actions.sql')
      expect(c194).toContain("stage in ('playoff', 'knockout')")
      expect(c195).toContain("fixture.stage in ('playoff', 'knockout')")
    })
  })

  describe('what must not have moved', () => {
    it('keeps the entrancy boundary and the non-entrant shape', () => {
      const body = bracketBody(migration)
      expect(body).toContain("'entered', false")
      expect(body).toContain('v_is_entrant := v_outcome is not null')
      // A non-entrant's payload is built in two places and neither may gain a
      // key: a private uuid is not an existence oracle.
      expect(body.match(/'competition_id', p_competition_id, 'entered', false/g) ?? []).toHaveLength(2)
    })

    it('keeps contract 205s initial-phase seed pin', () => {
      expect(bracketBody(migration)).toContain("member.phase_kind = 'initial'")
    })

    it('keeps the Penalty Number scoped to the caller and reached once', () => {
      const body = bracketBody(migration)
      expect(body).toContain('pn.user_id = v_uid')
      expect(body.match(/bonus_cup_penalty_numbers/g) ?? []).toHaveLength(1)
    })

    it('stays a stable, definer-scoped, authenticated-only read', () => {
      expect(migration).toContain('stable')
      expect(migration).toContain('security definer')
      expect(migration).toContain("set search_path = ''")
      expect(migration).toContain(
        'revoke all on function public.get_season_cup_bracket(uuid) from public, anon',
      )
      expect(migration).toContain(
        'grant execute on function public.get_season_cup_bracket(uuid) to authenticated',
      )
    })

    it('replaces one function and adds no table', () => {
      expect(migration.match(/create or replace function/g) ?? []).toHaveLength(1)
      expect(migration).not.toMatch(/create\s+table/i)
      expect(migration).not.toMatch(/alter\s+table/i)
    })
  })

  it('proves its properties against the installed text', () => {
    expect(migration).toMatch(
      /pg_get_functiondef\(\s*'public\.get_season_cup_bracket\(uuid\)'::regprocedure\)/,
    )
    // The SQL-escaped apostrophe, because that is what is in the file and what
    // the database will raise.
    for (const guard of [
      "The caller''s outcome must be read from the entrant row",
      'The outcome must be emitted verbatim rather than reshaped',
      'The outcome must be read for the caller only',
      'A knockout predicate must name playoff and knockout',
      'All four knockout predicates must name the knockout stages',
    ]) {
      expect(migration, `${guard} is not asserted in-transaction`).toContain(guard)
    }
  })

  it('is proved by a suite that exercises a SPLIT competition with four outcomes', () => {
    // Both defects are invisible in a competition that never split, which is
    // why contract 193's own suite passed with them present.
    expect(proof).toContain("'split'")
    expect(proof).toContain("'eliminated'")
    expect(proof).toContain("'champion'")
    expect(proof).toContain("'qualified'")
    expect(proof).toContain('your_outcome')
    expect(proof).toContain('%"eliminated"%')
  })
})
