import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The two schema-wide security invariants, asserted over the committed migrations.
 *
 *   1. Every table in the API-exposed `public` schema has row-level security
 *      enabled.
 *   2. Every `security definer` function pins `search_path`.
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

function statementsOf(migration: string): string {
  return sourceOf(migration)
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

type CreatedTable = { schema: string; name: string }

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
    expect(publicTables.size).toBeGreaterThanOrEqual(41)
  })

  it('enables RLS on every public table', () => {
    const unprotected = [...publicTables].filter((table) => !rlsTables.has(table)).sort()
    expect(unprotected).toEqual([])
  })

  it('keeps the internal schema out of the public surface', () => {
    const internal = createdTables().filter((table) => table.schema !== 'public')
    expect(internal).toEqual([
      { schema: 'predictor_internal', name: 'operating_limits' },
      { schema: 'predictor_internal', name: 'provider_raw_responses' },
      { schema: 'predictor_internal', name: 'provider_response_processing' },
      // Contract 114. The record of what the poll job sent. Internal rather
      // than public for the same reason as the two custody tables above it:
      // nothing outside the job has cause to read it, and its neighbours in
      // `public` all exist because something reaches them through a definer
      // function that needs a public foreign key.
      { schema: 'predictor_internal', name: 'provider_poll_dispatches' },
      // Contract 116. Every kickoff a provider moved, with the instant it
      // moved from. Internal because it is an administrator's review queue
      // rather than anything a player reads, and because the fixture already
      // carries the current kickoff — this exists to hold what the current
      // value replaced, which no browser surface has a use for.
      { schema: 'predictor_internal', name: 'season_fixture_revisions' },
      // Contract 123. Every round play window refresh that was refused because
      // its proposed span overlapped another round's. Internal for the same
      // reason as the revision queue above it: it records what was NOT written
      // and why, which is an administrator's review surface and has no meaning
      // to a player — the round already carries the window in force.
      { schema: 'predictor_internal', name: 'round_window_refresh_conflicts' },
      // Contract 125. Every official season result confirmed, corrected or
      // cleared, with the result it replaced. Internal for the same reason as
      // the queues above it: the fixture carries the result in force, and this
      // carries what that value replaced, which no player surface reads.
      { schema: 'predictor_internal', name: 'season_fixture_result_revisions' },
      // Contract 132. Fresh provider fixture discovery remains private evidence
      // until a competition administrator explicitly approves or rejects the
      // complete initial calendar. No player-facing API needs direct access.
      { schema: 'predictor_internal', name: 'provider_fixture_proposals' },
      // Contract 134. The Euro publication state itself, and its append-only
      // transition history. Internal because ADR 0026 makes publication an
      // owner operational act rather than anything a player reads: what a
      // browser may see is the bounded `euro_publication_state()` read — the
      // state and the instant it last changed, nothing more — while the actor
      // who moved it, their reason and the whole history stay here with no
      // browser grant at all. The mutation reaches these tables only through
      // the definer RPC, which gates on super_admin internally.
      { schema: 'predictor_internal', name: 'euro_publication_state' },
      { schema: 'predictor_internal', name: 'euro_publication_transitions' },
    ])
    for (const table of internal) {
      expect(publicTables.has(table.name)).toBe(false)
    }
  })
})

type FunctionDefinition = { migration: string; header: string }

/** Last definition wins, exactly as append-only migrations apply. */
function latestFunctionDefinitions(): Map<string, FunctionDefinition> {
  const latest = new Map<string, FunctionDefinition>()
  for (const migration of migrationFiles()) {
    const source = statementsOf(migration)
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
    expect(definitions.size).toBeGreaterThanOrEqual(143)
    expect(definerFunctions.length).toBeGreaterThanOrEqual(127)
  })

  it('pins search_path on every one of them', () => {
    const unpinned = definerFunctions
      .filter(([, definition]) => !/set\s+search_path/i.test(definition.header))
      .map(([name, definition]) => `${definition.migration} :: ${name}`)
      .sort()

    expect(unpinned).toEqual([])
  })

  it('resolves redefinitions to the latest one', () => {
    const redefined = 'public.enforce_entry_lock_generic'
    const occurrences = migrationFiles().filter((migration) =>
      new RegExp(
        `create (?:or replace )?function\\s+(?:public\\.)?${redefined.replace(/^public\./, '')}\\b`,
        'i',
      ).test(sourceOf(migration)),
    )

    expect(occurrences).toEqual([
      '20260719170000_lock_and_leaderboard.sql',
      '20260723174500_harden_entry_lock_functions.sql',
      '20260727174658_automatic_entry_submission.sql',
      '20260730235602_stage_c1_competition_season_foundation.sql',
      '20260803070000_c1b_game_catalogue_memberships.sql',
    ])

    expect(sourceOf(occurrences[0])).not.toMatch(
      /enforce_entry_lock_generic[\s\S]{0,200}set search_path/i,
    )
    expect(definitions.get(redefined)?.migration).toBe(occurrences.at(-1))
    expect(definitions.get(redefined)?.header).toMatch(/set search_path/i)

    // This function deliberately remains SECURITY INVOKER. The trusted refresh
    // predicate therefore observes the real caller rather than the owner.
    expect(definitions.get(redefined)?.header).not.toMatch(/security definer/i)
  })

  it('stops the header at the function body', () => {
    expect(definitions.get('public._stage_ord')?.header).not.toMatch(/security definer/i)
  })
})
