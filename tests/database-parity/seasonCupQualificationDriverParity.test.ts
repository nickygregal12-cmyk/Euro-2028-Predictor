import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 187 changes six expressions inside
 * `public.admin_finalise_predictor_cup_groups` and two inside each season
 * launcher, and it does so by patching the INSTALLED definitions rather than by
 * restating the functions.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------------------------------------------------------
 *
 * `cupGroupQualificationParity.test.ts` guards contract 184's patch of the same
 * function and records why: **no migration holds this function's current text.**
 * Contract 47 wrote it, contract 60 rewrote it in place by transforming
 * `pg_get_functiondef` output, contract 184 patched it again. Contract 184's
 * first draft restated it from contract 47 — 97 lines short, reverting contract
 * 60 outright, failing suites 110, 114 and 153.
 *
 * So there is nothing here to diff two files against, and this file guards the
 * mechanism instead. A later editor who replaced the anchored, round-tripped
 * patch with a blind `replace()` — or worse, with a restatement — would pass
 * every database test and quietly reintroduce the whole failure mode.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DIFFERENT ABOUT CONTRACT 186'S PATCH
 * ---------------------------------------------------------------------------
 *
 * Contract 184 replaced two expressions that each occurred once. Contract 187
 * replaces six, and two of them are **textually identical to each other**: the
 * playoff-window lookup and the first-knockout-window lookup are the same line.
 * Replacing one and not the other would leave the playoff and the first knockout
 * round reading different windows — a competition that half-works, which is
 * worse than one that refuses.
 *
 * A `position(... ) = 0` check cannot see that. So the migration COUNTS both
 * repeated targets, and this file requires it to keep counting them.
 */

const repositoryRoot = process.cwd()
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/20260812090000_season_cup_qualification_driver.sql'),
  'utf8',
)

describe('contract 187 patches the qualification driver rather than restating it', () => {
  it('reads the installed definition instead of a migration file', () => {
    expect(migration).toContain('pg_catalog.pg_get_functiondef(')
    expect(migration).toContain("'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure")
    // The tell-tale of contract 184's first-draft mistake: a restatement.
    expect(
      migration,
      'contract 187 must not restate admin_finalise_predictor_cup_groups; no migration holds its current text',
    ).not.toContain('create or replace function public.admin_finalise_predictor_cup_groups')
    // Same rule for the two launchers, whose text IS on disk but which contract
    // 185 has already patched in place — so the committed text is stale for them
    // too.
    expect(migration).not.toContain(
      'create or replace function predictor_internal.launch_season_cup',
    )
  })

  it('fails closed when any replaced expression is absent', () => {
    for (const anchor of [
      'v_old_declare',
      'v_old_settle',
      'v_old_needed',
      'v_old_exists',
      'v_old_first',
      'v_old_table',
    ]) {
      expect(migration, `${anchor} must be checked before it is replaced`).toContain(anchor)
    }
    expect(migration).toContain('position(v_old_declare in v_before) = 0')
    expect(migration).toContain('position(v_old_settle in v_before) = 0')
    expect(migration).toContain('position(v_old_needed in v_before) = 0')
    expect(migration).toContain('position(v_old_exists in v_before) = 0')
  })

  it('counts the two repeated targets rather than merely finding them', () => {
    // The playoff and first-knockout window lookups are the SAME line, and the
    // group-table read occurs four times. `position(...) > 0` is satisfied by
    // one occurrence, which is exactly the half-patched function this guards
    // against.
    expect(migration).toContain('<> 2 then')
    expect(migration).toContain('<> 4 then')
    expect(migration).toContain('expected exactly two first-knockout-window lookups')
    expect(migration).toContain('expected exactly four group-table reads')
  })

  it('proves the round trip, which is what bounds the change', () => {
    // Reversing all six replacements must reproduce the original byte for byte.
    // Stronger than a line diff: it proves nothing ELSE moved without having to
    // enumerate what did not.
    expect(migration).toContain('v_roundtrip')
    expect(migration).toContain('v_roundtrip is distinct from v_before')
    // All six reversals, or the proof is partial.
    for (const reversal of [
      'v_new_table, v_old_table',
      'v_new_first, v_old_first',
      'v_new_exists, v_old_exists',
      'v_new_needed, v_old_needed',
      'v_new_settle, v_old_settle',
      'v_new_declare, v_old_declare',
    ]) {
      expect(migration, `the round trip must reverse ${reversal}`).toContain(reversal)
    }
  })

  it('re-checks contract 60 s lint property and contract 184 s rule reads', () => {
    // The specific things contract 184's first draft destroyed, and the rule
    // functions contract 184 installed.
    expect(migration).toContain('pg_temp.cup_gate_tables')
    expect(migration).toContain('create temporary table')
    expect(migration).toContain('must not reinstate it')
    expect(migration).toContain('cup_group_automatic_places')
    expect(migration).toContain('cup_group_qualifying_limit')
  })

  it('leaves the driver s grants alone and keeps it off the browser', () => {
    // `create or replace function` preserves grants, so the patch touches none
    // — and must not start. The driver is now competition-neutral, so a grant to
    // `authenticated` would put the TOURNAMENT Championship's qualification
    // behind the same door as the season's.
    expect(migration).not.toMatch(
      /grant execute on function public\.admin_finalise_predictor_cup_groups/,
    )
    expect(migration).toContain(
      "has_function_privilege('authenticated',\n          'public.admin_finalise_predictor_cup_groups(uuid)', 'execute')",
    )
  })

  it('keeps the tournament neutral by construction rather than by testing', () => {
    // The three properties that make "the tournament is unchanged" a fact about
    // the code rather than a claim about coverage.
    expect(migration).toContain('return 3;')
    expect(migration).toContain('cup_is_league_season')
    expect(migration).toContain('cup_initial_group_tables')
  })

  it('does not weaken contract 182 s CUP-005 guard', () => {
    // ADR 0028 § 7 permits CUP-002's driver to reach the tie rule; this one does
    // not, so the guard has something to be a control over rather than nothing.
    expect(migration).toContain('assert_single_group_stage_authority()')
    expect(migration).toContain("v_driver ~ 'settle_season_cup_tie'")
  })

  it('appends knockout windows through the delivered generator', () => {
    // A second window writer would be a second calendar authority. Contract 110's
    // appender has continued from `max(sequence)` since it was written, which is
    // exactly what is needed, and the boundary it is given must be the last GROUP
    // window rather than `now()` — passed `now()`, its own idempotency guard
    // returns zero and creates nothing.
    expect(migration).toContain('generate_season_cup_windows')
    expect(migration).toContain('not\n-- `now()`')
  })
})
