import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Stage C1 migration defines each entry-lock trigger function twice, and
 * both definitions are load-bearing.
 *
 * The season-scope backfill issues `update` statements against
 * `match_predictions`, `predicted_group_positions`, `predicted_progression` and
 * `predicted_tie_resolutions` to populate `tournament_id`. Those tables carry
 * the lock triggers, so a definition must already be in force when the backfill
 * runs. The second definition then installs the final rule, which tolerates a
 * fixture whose kickoff is not yet known.
 *
 * That is a legitimate ordering dependency, but it is also how the worst defect
 * in this migration happened: the two definitions drifted apart. The second
 * became `security definer` and changed its trusted predicate from
 * `current_user` to `session_user`.
 *
 * Both halves mattered. `session_user` is the login role — PostgREST connects
 * as `authenticator` and then changes role, so it is never `postgres`, which
 * left the trusted automatic-submission refresh permanently unreachable and
 * made the processor reject its own work at every deadline. And had the
 * predicate been restored to `current_user` while the function stayed
 * `security definer`, `current_user` would always have been the owner inside
 * the trigger; `set_config` is executable by `authenticated`, so any signed-in
 * user could then have set the flag and written predictions after the lock.
 *
 * Nothing compared the definitions to each other. This does. It is a source
 * check rather than a schema check on purpose: the live database only ever
 * shows the last definition, so a drifting earlier one — the one that governs
 * the backfill — would be invisible to `pg_proc`.
 */

const repositoryRoot = process.cwd()
const migration = resolve(
  repositoryRoot,
  'supabase/migrations/20260730235602_stage_c1_competition_season_foundation.sql',
)

/** The header is everything from `create ... function` to the `begin` body. */
function definitionsOf(source: string, qualifiedName: string): string[] {
  const pattern = new RegExp(
    `create or replace function ${qualifiedName.replace('.', '\\.')}\\(\\)[\\s\\S]*?\\nbegin`,
    'g',
  )
  return source.match(pattern) ?? []
}

const source = readFileSync(migration, 'utf8')

const LOCK_FUNCTIONS = [
  'public.enforce_entry_lock_generic',
  'public.enforce_entry_lock_scores',
  'public.enforce_joker_rules',
] as const

describe('Stage C1 entry-lock function definitions', () => {
  it.each(LOCK_FUNCTIONS)('defines %s more than once, as the backfill requires', (name) => {
    expect(definitionsOf(source, name).length).toBeGreaterThan(1)
  })

  it.each(LOCK_FUNCTIONS)('never marks any definition of %s security definer', (name) => {
    const offending = definitionsOf(source, name).filter((definition) =>
      /security\s+definer/i.test(definition),
    )

    expect(offending).toEqual([])
  })

  it.each(LOCK_FUNCTIONS)('pins search_path on every definition of %s', (name) => {
    const unpinned = definitionsOf(source, name).filter(
      (definition) => !/set\s+search_path/i.test(definition),
    )

    expect(unpinned).toEqual([])
  })

  it('never tests session_user, which is authenticator for every PostgREST request', () => {
    const offending = LOCK_FUNCTIONS.flatMap((name) =>
      definitionsOf(source, name)
        .filter((definition) => /session_user/i.test(definition))
        .map(() => name),
    )

    expect(offending).toEqual([])
  })

  it('gives every definition of the generic guard the same trusted predicate', () => {
    const definitions = definitionsOf(source, 'public.enforce_entry_lock_generic')
    const predicates = definitions.map((definition) =>
      /current_user\s*=\s*'postgres'/i.test(definition),
    )

    // Every definition agrees, and they agree on *true* — the trusted refresh
    // must be reachable in each, or the backfill window and the final rule
    // would enforce different things.
    expect(predicates).toEqual(definitions.map(() => true))
  })

  it('scopes the trusted refresh to predicted_group_positions in every definition', () => {
    const definitions = definitionsOf(source, 'public.enforce_entry_lock_generic')
    const scoped = definitions.map((definition) =>
      /tg_table_name\s*=\s*'predicted_group_positions'/i.test(definition),
    )

    expect(scoped).toEqual(definitions.map(() => true))
  })
})
