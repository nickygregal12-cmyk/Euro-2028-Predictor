import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Stage C deliberately retains the physical `p_tournament_id` RPC contract
 * while widening its meaning to tournament editions and league seasons.
 *
 * Before implementation begins, that compatibility surface must be exact:
 * every live public function that still accepts `p_tournament_id` needs a
 * reviewed manifest disposition, and every function named in the Stage C
 * function/authority sections must still exist in the effective migration
 * history.
 *
 * This is text-based and legal-outcome independent. It creates no migration and
 * does not assume how issue #272 will resolve the account-deletion path.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const coverageManifestPath = resolve(
  repositoryRoot,
  'docs/architecture/stage-c-schema-coverage.md',
)

type FunctionDefinition = {
  header: string
  migration: string
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function sourceOf(migration: string): string {
  return readFileSync(resolve(migrationsDirectory, migration), 'utf8')
}

/**
 * Remove line comments before reading function declarations. The migrations
 * quote DDL in prose, and documentation must not invent an effective function.
 */
function statementsOf(migration: string): string {
  return sourceOf(migration)
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

/**
 * Last definition wins, matching append-only migration semantics.
 *
 * The captured header stops at the function body delimiter so a later function
 * cannot lend `p_tournament_id` or security attributes to the current one.
 */
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
      latest.set(qualifiedName, {
        header: rest.slice(0, bodyStart),
        migration,
      })
    }
  }

  return latest
}

function sectionBetween(source: string, start: string, end: string): string {
  const section = source.split(start)[1]?.split(end)[0]
  expect(section, `manifest section ${start}`).toBeTruthy()
  return section!
}

function bulletIdentifiers(section: string): string[] {
  const names = new Set<string>()
  const pattern = /^-\s+`([a-z_][a-z0-9_]*)`\s*$/gm

  for (const match of section.matchAll(pattern)) names.add(at(match, 1))
  return [...names].sort()
}

const definitions = latestFunctionDefinitions()
const manifest = readFileSync(coverageManifestPath, 'utf8')

const publicFunctionSection = sectionBetween(
  manifest,
  '## 6. Public functions and RPCs',
  '## 7. Existing validators and authorities',
)
const authoritySection = sectionBetween(
  manifest,
  '## 7. Existing validators and authorities',
  '## 8. RLS, views, grants and definer coverage',
)
const retainedTournamentParameterSection = sectionBetween(
  publicFunctionSection,
  '### Retained `p_tournament_id` signatures',
  '### Bodies with implicit tournament joins',
)

const manifestTournamentParameterFunctions = bulletIdentifiers(retainedTournamentParameterSection)
const manifestReviewedFunctions = [
  ...new Set([
    ...bulletIdentifiers(publicFunctionSection),
    ...bulletIdentifiers(authoritySection),
  ]),
].sort()

const effectiveFunctionNames = new Map<string, string[]>()
for (const qualifiedName of definitions.keys()) {
  const name = qualifiedName.split('.').at(-1)!
  const existing = effectiveFunctionNames.get(name) ?? []
  existing.push(qualifiedName)
  effectiveFunctionNames.set(name, existing.sort())
}

const effectivePublicTournamentParameterFunctions = [...definitions]
  .filter(
    ([qualifiedName, definition]) =>
      qualifiedName.startsWith('public.') && /\bp_tournament_id\b/i.test(definition.header),
  )
  .map(([qualifiedName]) => qualifiedName.replace(/^public\./, ''))
  .sort()

describe('Stage C function compatibility coverage', () => {
  it('keeps parser positive controls at the effective function boundary', () => {
    expect(definitions.size).toBeGreaterThanOrEqual(126)
    expect(manifestReviewedFunctions.length).toBeGreaterThanOrEqual(50)
    expect(effectivePublicTournamentParameterFunctions.length).toBeGreaterThanOrEqual(15)
  })

  it('pins every live public p_tournament_id signature to the manifest inventory', () => {
    expect(manifestTournamentParameterFunctions).toEqual(
      effectivePublicTournamentParameterFunctions,
    )
  })

  it('keeps every function named for Stage C review effective in migration history', () => {
    const missing = manifestReviewedFunctions.filter(
      (functionName) => !effectiveFunctionNames.has(functionName),
    )

    expect(missing).toEqual([])
  })

  it('does not silently resolve a reviewed name to multiple schemas', () => {
    const ambiguous = manifestReviewedFunctions
      .map((functionName) => ({
        functionName,
        qualifiedNames: effectiveFunctionNames.get(functionName) ?? [],
      }))
      .filter(({ qualifiedNames }) => qualifiedNames.length > 1)

    expect(ambiguous).toEqual([])
  })
})
