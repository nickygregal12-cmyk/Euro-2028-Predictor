import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * TypeScript string-literal unions against the database allow-lists they mirror.
 *
 * The service layer hand-writes every row type — generated Supabase types do not
 * replace these domain-facing unions — so a union like `MatchRound` is a second,
 * independently-maintained copy of a `check (round in (…))` constraint.
 *
 * Text-based over the committed append-only migrations, so it needs no database.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

/** Migration SQL with `--` comments removed, ordered exactly as it is applied. */
function migrationSql(): string {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) =>
      readFileSync(resolve(migrationsDirectory, file), 'utf8')
        .split('\n')
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n'),
    )
    .join('\n')
}

// Comments stripped before any scan. This file pairs quotes positionally to
// read a CHECK constraint's IN list, and `rpcAllowlistParity` was broken by
// exactly that: one apostrophe in a `--` comment re-paired every quote after
// it and silently dropped a real entry. Same input language, same failure mode,
// same one-line defence — applied here before it costs a CI round trip too.
const allSql = migrationSql().replace(/--[^\n]*/g, '')

/**
 * The effective allowed values for a column, read from migration order.
 *
 * Stage C widens `matches.round` in place by dropping and recreating the named
 * constraint. Append-only history therefore contains both the superseded and
 * replacement text even though the rebuilt database contains one live
 * constraint. The final matching definition is the effective one, matching the
 * same last-definition-wins rule used for functions elsewhere in the parity
 * suite.
 */
function allowedValues(column: string): string[] {
  const pattern = new RegExp(
    `check\\s*\\(\\s*(?:${column}\\s+is\\s+null\\s+or\\s+)?${column}\\s+in\\s*\\(([^)]*)\\)`,
    'gi',
  )
  const found = [...allSql.matchAll(pattern)]
  if (found.length === 0) {
    throw new Error(`No check constraint allow-list found for "${column}".`)
  }
  const effective = found.at(-1)!
  return [...effective[1].matchAll(/'([^']*)'/g)].map((match) => match[1]).sort()
}

/** The members of an exported string-literal union, from the service layer. */
function unionMembers(file: string, name: string): string[] {
  const source = readFileSync(resolve(repositoryRoot, file), 'utf8')
  const declaration = new RegExp(`export type ${name}\\s*=\\s*([^\\n]+)`).exec(source)
  if (!declaration) return []
  return [...declaration[1].matchAll(/'([^']*)'/g)].map((match) => match[1]).sort()
}

const TOURNAMENT_DATA = 'src/services/supabase/tournamentData.ts'
const ADMIN = 'src/services/supabase/adminResults.ts'

const PAIRS = [
  { union: 'MatchRound', file: TOURNAMENT_DATA, column: 'round' },
  { union: 'MatchResultState', file: TOURNAMENT_DATA, column: 'result_state' },
  { union: 'MatchResultMethod', file: TOURNAMENT_DATA, column: 'result_method' },
  { union: 'AdminResultState', file: ADMIN, column: 'result_state' },
  { union: 'AdminResultMethod', file: ADMIN, column: 'result_method' },
] as const

describe('TypeScript unions match the database allow-lists', () => {
  it('parses both sides at all', () => {
    for (const { union, file, column } of PAIRS) {
      expect(allowedValues(column).length, `${column} allow-list`).toBeGreaterThan(1)
      expect(unionMembers(file, union).length, `${union} members`).toBeGreaterThan(1)
    }
  })

  it.each(PAIRS)('$union equals the $column allow-list', ({ union, file, column }) => {
    expect(unionMembers(file, union)).toEqual(allowedValues(column))
  })

  it('pins the values themselves', () => {
    expect(allowedValues('round')).toEqual(['final', 'group', 'league', 'qf', 'r16', 'sf'])
    expect(allowedValues('result_state')).toEqual(['confirmed', 'corrected', 'scheduled'])
    expect(allowedValues('result_method')).toEqual(['extra_time', 'penalties', 'regulation'])
  })

  it('keeps the duplicated unions agreeing with each other', () => {
    expect(unionMembers(TOURNAMENT_DATA, 'MatchResultState')).toEqual(
      unionMembers(ADMIN, 'AdminResultState'),
    )
    expect(unionMembers(TOURNAMENT_DATA, 'MatchResultMethod')).toEqual(
      unionMembers(ADMIN, 'AdminResultMethod'),
    )
  })
})
