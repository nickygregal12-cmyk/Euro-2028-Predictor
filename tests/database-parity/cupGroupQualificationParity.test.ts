import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 184 changes two expressions inside
 * `public.admin_finalise_predictor_cup_groups`, and it does so by patching the
 * INSTALLED definition rather than by restating the function.
 *
 * ---------------------------------------------------------------------------
 * WHY, AND THE MISTAKE THAT ESTABLISHED IT
 * ---------------------------------------------------------------------------
 *
 * **No migration holds this function's current text.** Contract 47 wrote it,
 * and contract 60 then rewrote it in place — reading `pg_get_functiondef`,
 * string-replacing its `pg_temp` block and re-executing the result, because
 * hosted lint could not resolve a temporary relation. The live definition is
 * therefore contract 47's text transformed by contract 60's replacements, and
 * it exists nowhere on disk.
 *
 * The first draft of contract 184 copied contract 47's migration text. That was
 * wrong twice over: it was 97 lines short of the real function, and it would
 * have **reverted contract 60 entirely** — reinstating the `pg_temp` block and
 * restoring the grants contract 60 changed. `114_predictor_cup_lint_safe_qualification.sql`
 * failed seven of its eight assertions, and `110` and `153` failed too.
 *
 * So there is nothing here to diff two files against, and this file guards the
 * mechanism instead: the migration must read the installed definition, refuse
 * if either expression is missing, prove the round trip, and re-check contract
 * 60's property afterwards. A later editor replacing that with a blind
 * `replace()` would pass every database test and quietly reintroduce the whole
 * failure mode.
 */

const repositoryRoot = process.cwd()
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/20260812060000_cup_group_qualification.sql'),
  'utf8',
)

describe('contract 184 patches the qualification driver rather than restating it', () => {
  it('reads the installed definition instead of a migration file', () => {
    expect(migration).toContain('pg_catalog.pg_get_functiondef(')
    expect(migration).toContain("'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure")
    // The tell-tale of the mistake: a full restatement of the function body.
    expect(
      migration,
      'contract 184 must not restate admin_finalise_predictor_cup_groups; no migration holds its current text',
    ).not.toContain('create or replace function public.admin_finalise_predictor_cup_groups')
  })

  it('fails closed when either replaced expression is absent', () => {
    // Guessing at a function that is not the one this contract was written
    // against is worse than stopping.
    expect(migration).toContain('position(v_old_automatic in v_before) = 0')
    expect(migration).toContain('position(v_old_wildcard in v_before) = 0')
  })

  it('proves the round trip, which is what bounds the change', () => {
    // Reversing both replacements must reproduce the original byte for byte.
    // Stronger than a line diff: it proves nothing ELSE moved without having to
    // enumerate what did not.
    expect(migration).toContain('v_roundtrip')
    expect(migration).toContain('v_roundtrip is distinct from v_before')
  })

  it('re-checks contract 60 s lint property after patching', () => {
    // The specific thing the first draft destroyed.
    expect(migration).toContain('pg_temp.cup_gate_tables')
    expect(migration).toContain('create temporary table')
    expect(migration).toContain('must not reinstate it')
  })

  it('leaves the grants alone', () => {
    // `create or replace function` preserves grants, so the patch touches none
    // — and must not start.
    expect(migration).not.toMatch(
      /grant execute on function public\.admin_finalise_predictor_cup_groups/,
    )
    expect(migration).not.toMatch(
      /revoke .* on function public\.admin_finalise_predictor_cup_groups/,
    )
  })
})

describe('the published rule and the SQL rule agree', () => {
  const rules = readFileSync(resolve(repositoryRoot, 'docs/predictor-cup-rules.md'), 'utf8')

  it('publishes a row for every group size ADR 0014 permits', () => {
    // `bonus_cup_groups_size_allowed` admits 3..20 for an initial group stage.
    // The rules document is the authority ADR 0028 § 6 required the numbers to
    // be written into, so a size missing THERE is the defect.
    for (let size = 3; size <= 20; size += 1) {
      expect(rules, `section 6.2 has no row for a group of ${size}`).toMatch(
        new RegExp(`\\|\\s*\\*\\*${size}\\*\\*\\s*\\|`),
      )
    }
  })

  it('states the arithmetic rather than only the table', () => {
    // A table alone can be missing a size and still look complete. The
    // arithmetic is what makes the table checkable, and it is what the SQL
    // implements.
    expect(rules).toContain('floor(N / 2)')
    expect(rules).toContain('ceil(2N / 3)')
  })

  it('records where sizes 5 to 20 were decided', () => {
    expect(rules).toContain('0028-owner-decisions-unblocking-product-work.md')
    expect(rules).toContain('CUP-001')
  })
})
