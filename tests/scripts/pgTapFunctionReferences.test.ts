import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Every `predictor_internal` function a pgTAP file calls must exist.
 *
 * WHY THIS EXISTS. Contract 83 renamed `season_complete_card_fixtures` to
 * `season_card_fixtures`. The migration changed, the TypeScript parity guard
 * changed, and `134_season_matchweek_scheduler.sql` did not — because pgTAP does
 * not run locally in this container, and the hand-translation used to check
 * those assertions had been done BEFORE the rename and was not repeated after
 * it. CI caught it, but only after a push, and the failure was a hard `ERROR:
 * function ... does not exist` that aborted the file and reported "Bad plan.
 * You planned 11 tests but ran 3".
 *
 * That is the expensive shape of this mistake: eight assertions silently stopped
 * running. A stale reference does not weaken one check, it deletes the rest of
 * the file. This test makes the same mistake cost a few seconds instead of a CI
 * round trip.
 *
 * Scoped to `predictor_internal` deliberately. That schema holds only functions
 * these migrations define, so a name that resolves nowhere is unambiguously
 * wrong. `public` carries tables, views and PostgREST-facing RPCs whose
 * definitions arrive from several directions, and guessing there would produce
 * false failures that train people to ignore this.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const testsDirectory = resolve(repositoryRoot, 'supabase/tests')

function read(directory: string, file: string): string {
  return readFileSync(resolve(directory, file), 'utf8')
}

function sqlFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

/**
 * Every `predictor_internal` function name any migration brings into existence.
 *
 * `create function` is not the only way. Contract 63 renamed
 * `get_prediction_consensus` to `get_prediction_consensus_unsuppressed` with
 * `alter function ... rename to`, and a scan for `create` alone reports that
 * name as undefined — which is how the first run of this guard produced a false
 * failure against a file that was perfectly correct. A guard that cries wolf on
 * good code is worse than no guard, because it teaches people to skip it.
 */
const defined = new Set<string>()
for (const file of sqlFiles(migrationsDirectory)) {
  const source = read(migrationsDirectory, file)
  for (const match of source.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+predictor_internal\.([a-z_][a-z0-9_]*)\s*\(/gi,
  )) {
    defined.add(at(match, 1).toLowerCase())
  }
  for (const match of source.matchAll(/rename\s+to\s+([a-z_][a-z0-9_]*)\s*;/gi)) {
    defined.add(at(match, 1).toLowerCase())
  }
}

/**
 * `predictor_internal` is not a functions-only schema and has not been since
 * contract 96 put the provider custody tables there. That matters here because
 * the reference scan below keys on `name(`, and `insert into
 * predictor_internal.some_table (` matches it — the paren is the column list.
 *
 * Contract 116 found that: a correct test file was reported as calling a
 * function that does not exist, which is precisely the cry-wolf failure the
 * comment above warns about. So the tables are collected and excluded rather
 * than the test file being written around the regex.
 */
const internalTables = new Set<string>()
for (const file of sqlFiles(migrationsDirectory)) {
  for (const match of read(migrationsDirectory, file).matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?predictor_internal\.([a-z_][a-z0-9_]*)/gi,
  )) {
    internalTables.add(at(match, 1).toLowerCase())
  }
}

/**
 * Every `predictor_internal` function name a pgTAP file references, by file.
 *
 * Both call sites count: a direct `predictor_internal.name(` call, and the
 * name `function_privs_are('predictor_internal', 'name', ...)` takes as a
 * string — which a call-shaped pattern alone would miss, and which fails just
 * as hard when the name is stale.
 */
function referencedBy(source: string): Set<string> {
  const names = new Set<string>()
  for (const match of source.matchAll(/predictor_internal\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
    if (internalTables.has(at(match, 1).toLowerCase())) continue
    names.add(at(match, 1).toLowerCase())
  }
  // Scoped to `function_privs_are` rather than any adjacent string pair.
  // `has_schema_privilege('anon', 'predictor_internal', 'usage')` puts a
  // PRIVILEGE where this pattern expected a function name, and the looser
  // version duly reported a function called `usage`.
  for (const match of source.matchAll(
    /function_privs_are\(\s*'predictor_internal'\s*,\s*'([a-z_][a-z0-9_]*)'/gi,
  )) {
    names.add(at(match, 1).toLowerCase())
  }
  return names
}

describe('the inventories are populated, so nothing below is vacuous', () => {
  it('found predictor_internal functions in the migrations', () => {
    // A positive control on the parser: if `create function` stopped matching,
    // every reference would be "undefined" and the suite would fail loudly
    // rather than pass silently — but a zero here would be the real cause.
    expect(defined.size).toBeGreaterThan(20)
  })

  it('found pgTAP files that reference them', () => {
    const referencing = sqlFiles(testsDirectory).filter(
      (file) => referencedBy(read(testsDirectory, file)).size > 0,
    )
    expect(referencing.length).toBeGreaterThan(5)
  })
})

describe('no pgTAP file calls a predictor_internal function that does not exist', () => {
  it.each(sqlFiles(testsDirectory))('%s', (file) => {
    const missing = [...referencedBy(read(testsDirectory, file))]
      .filter((name) => !defined.has(name))
      .sort()

    expect(
      missing,
      `${file} references predictor_internal function(s) no migration defines: ${missing.join(', ')}. ` +
        'A stale reference is not one weak assertion — psql aborts the file, so every ' +
        'assertion after it silently stops running.',
    ).toEqual([])
  })
})
