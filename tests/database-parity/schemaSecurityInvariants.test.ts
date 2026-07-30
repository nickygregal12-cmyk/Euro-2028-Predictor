import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The two schema-wide security invariants, asserted over the committed migrations.
 *
 *   1. Every table in the API-exposed `public` schema has row-level security
 *      enabled. A `public` table without it is readable by anyone holding the
 *      publishable key, through PostgREST, with no policy in the way.
 *   2. Every `security definer` function pins `search_path`. A definer function
 *      that resolves unqualified names through the caller's `search_path` can be
 *      induced to run an attacker's object with the definer's privileges.
 *
 * Both hold today — 34 public tables, all RLS-enabled; 110 `security definer`
 * functions, all pinned. Neither was checked by anything that fails. `supabase db lint` covers
 * both classes, but it runs only inside the path-gated `local-supabase` job, and
 * at its default level a finding is a warning in a log rather than a red check.
 * These assertions run in ordinary CI on every pull request instead, and fail.
 *
 * Because both invariants currently hold, this file is a true guard rather than
 * a characterisation: any failure here is a regression, not a known gap.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function sourceOf(migration: string): string {
  return readFileSync(resolve(migrationsDirectory, migration), 'utf8')
}

/**
 * Source with `--` line comments removed.
 *
 * These migrations document themselves heavily, and the prose quotes the DDL it
 * is describing. `league_fk_semantics.sql` contains the line
 * ``-- auth.users inline. Because that migration used `create table if not
 * exists`,`` — parsed as DDL that yields a table named `if`, which then appears
 * as a public table with no RLS. Stripping comments first is what keeps a
 * documentation edit from failing a security assertion.
 */
function statementsOf(migration: string): string {
  return sourceOf(migration)
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

/* ------------------------------------------------------------------------- */
/* Row-level security                                                         */
/* ------------------------------------------------------------------------- */

type CreatedTable = { schema: string; name: string }

/**
 * Tables created by the migrations, with their schema.
 *
 * `create table predictor_internal.operating_limits` must not be read as a
 * `public` table called `predictor_internal` — that schema is deliberately
 * outside the Data API (guarded by `supabase/tests/000_predictor_internal_
 * boundary.sql`), so it neither needs nor uses RLS.
 */
function createdTables(): CreatedTable[] {
  const tables: CreatedTable[] = []
  for (const migration of migrationFiles()) {
    const pattern = /create table\s+(?:if not exists\s+)?(?:([a-z_0-9]+)\.)?([a-z_0-9]+)/gi
    for (const match of statementsOf(migration).matchAll(pattern)) {
      tables.push({ schema: match[1] ?? 'public', name: match[2] })
    }
  }
  return tables
}

/**
 * Tables switched to RLS. The `alter table` statements are whitespace-aligned in
 * the initial migration (`alter table profiles      enable row level security`),
 * so the gap must be `\s+` — requiring a single space silently misses thirteen
 * tables and makes the invariant look broken when it is not.
 */
function rowLevelSecurityEnabled(): Set<string> {
  const enabled = new Set<string>()
  for (const migration of migrationFiles()) {
    const pattern = /alter table\s+(?:public\.)?([a-z_0-9]+)\s+enable row level security/gi
    for (const match of statementsOf(migration).matchAll(pattern)) {
      enabled.add(match[1])
    }
  }
  return enabled
}

const publicTables = new Set(
  createdTables()
    .filter((table) => table.schema === 'public')
    .map((table) => table.name),
)
const rlsTables = rowLevelSecurityEnabled()

describe('row-level security', () => {
  it('parses a plausible number of tables at all', () => {
    // Without this, a changed `create table` idiom would empty the set and make
    // the invariant below pass vacuously.
    expect(publicTables.size).toBeGreaterThanOrEqual(34)
  })

  it('enables RLS on every public table', () => {
    const unprotected = [...publicTables].filter((table) => !rlsTables.has(table)).sort()

    expect(unprotected).toEqual([])
  })

  it('keeps the internal schema out of the public surface', () => {
    // The one table that legitimately has no RLS, and the reason it is exempt.
    const internal = createdTables().filter((table) => table.schema !== 'public')

    expect(internal).toEqual([{ schema: 'predictor_internal', name: 'operating_limits' }])
    expect(publicTables.has('operating_limits')).toBe(false)
  })
})

/* ------------------------------------------------------------------------- */
/* security definer search_path                                               */
/* ------------------------------------------------------------------------- */

type FunctionDefinition = { migration: string; header: string }

/**
 * The *last* definition of each function, keyed by name.
 *
 * Two traps, both of which produce a wrong answer rather than an error:
 *
 *   - functions are redefined append-only across migrations, so the first
 *     definition is not the live one. `enforce_entry_lock_generic` is defined
 *     three times and only the later two pin `search_path`; reading the first
 *     reports a hardened function as vulnerable.
 *   - the header must stop at the body delimiter. Scanning a fixed window past
 *     it picks up `security definer` from the *next* function in the file, which
 *     reports plain `language sql` helpers as definer functions.
 */
function latestFunctionDefinitions(): Map<string, FunctionDefinition> {
  const latest = new Map<string, FunctionDefinition>()
  for (const migration of migrationFiles()) {
    const source = statementsOf(migration)
    // The schema qualifier is captured, not assumed to be `public`. Matching
    // only `(?:public\.)?name` skips every `predictor_internal.*` function
    // outright — and those are `security definer` too, so the invariant would
    // have gone unchecked precisely where the privileges are highest.
    const pattern = /create (?:or replace )?function\s+(?:([a-z_0-9]+)\.)?([a-z_0-9]+)\s*\(/gi
    for (const match of source.matchAll(pattern)) {
      const rest = source.slice(match.index)
      const bodyStart = rest.search(/\bas\s*\$/i)
      if (bodyStart < 0) continue
      const qualifiedName = `${match[1] ?? 'public'}.${match[2]}`
      latest.set(qualifiedName, { migration, header: rest.slice(0, bodyStart) })
    }
  }
  return latest
}

const definitions = latestFunctionDefinitions()
const definerFunctions = [...definitions].filter(([, definition]) =>
  /security definer/i.test(definition.header),
)

describe('security definer functions', () => {
  it('parses a plausible number of definer functions at all', () => {
    // 126 functions, 110 of them definer. The thresholds matter: an earlier
    // draft of this parser assumed a `public.` qualifier and silently saw only
    // 69 and 62, missing all 48 definer functions in `predictor_internal`.
    expect(definitions.size).toBeGreaterThanOrEqual(126)
    expect(definerFunctions.length).toBeGreaterThanOrEqual(110)
  })

  it('pins search_path on every one of them', () => {
    const unpinned = definerFunctions
      .filter(([, definition]) => !/set\s+search_path/i.test(definition.header))
      .map(([name, definition]) => `${definition.migration} :: ${name}`)
      .sort()

    expect(unpinned).toEqual([])
  })

  it('resolves redefinitions to the latest one', () => {
    // Pins the append-only hazard itself, so the parser above cannot regress
    // into reading first definitions without this failing.
    const redefined = 'public.enforce_entry_lock_generic'
    const occurrences = migrationFiles().filter((migration) =>
      new RegExp(`create (?:or replace )?function\\s+(?:public\\.)?${redefined.replace(/^public\./, '')}\\b`, 'i').test(
        sourceOf(migration),
      ),
    )

    expect(occurrences).toEqual([
      '20260719170000_lock_and_leaderboard.sql',
      '20260723174500_harden_entry_lock_functions.sql',
      '20260727174658_automatic_entry_submission.sql',
    ])

    // The first definition does not pin search_path; the live one does.
    expect(sourceOf(occurrences[0])).not.toMatch(/enforce_entry_lock_generic[\s\S]{0,200}set search_path/i)
    expect(definitions.get(redefined)?.migration).toBe(occurrences.at(-1))
    expect(definitions.get(redefined)?.header).toMatch(/set search_path/i)
  })

  it('stops the header at the function body', () => {
    // The other half of the parsing contract: `_stage_ord` is a plain
    // `language sql immutable` helper that sits immediately before a definer
    // function, and a header window that overruns the body reports it as one.
    expect(definitions.get('public._stage_ord')?.header).not.toMatch(/security definer/i)
  })
})
