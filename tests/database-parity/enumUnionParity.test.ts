import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * TypeScript string-literal unions against the database allow-lists they mirror.
 *
 * The service layer hand-writes every row type — there are no generated Supabase
 * types — so a union like `MatchRound` is a second, independently-maintained
 * copy of a `check (round in (…))` constraint. Nothing related them. Drift is
 * invisible at compile time and only shows up as a value the client cannot
 * render or a state it mishandles:
 *
 *   - a stage added to the database that the union does not know about arrives
 *     as an unhandled string;
 *   - a value removed from the database but left in the union is dead branching
 *     that reads as supported.
 *
 * `ACQ-R08` names exactly this — *"generate and freshness-check database
 * types"*. This is the freshness check for the enum surface, which is the part
 * where drift changes behaviour rather than merely types.
 *
 * Two of these unions are copies of the *same* constraint: `MatchResultState`
 * and `AdminResultState` both mirror `result_state`, as do `MatchResultMethod`
 * and `AdminResultMethod` for `result_method`. They can drift from each other
 * as well as from the schema, so each is compared to the database rather than
 * to its twin.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

/** Migration SQL with `--` comments removed, so prose cannot parse as DDL. */
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

const allSql = migrationSql()

/**
 * The allowed values for a column, read from its CHECK constraint.
 *
 * Anchored on `check (` deliberately. Matching a bare `<column> in (…)` picks up
 * unrelated expressions elsewhere in the migration set — `round in ('qf','sf',
 * 'final')` appears inside knockout logic and is not the column's allow-list.
 *
 * Both constraint shapes are covered: the bare form, and the nullable form
 * `check (<column> is null or <column> in (…))`.
 *
 * Exactly one constraint must match. Zero means the parser has lost the schema;
 * more than one means the allow-list is defined in two places and picking
 * either would be a guess. Both are failures rather than silent choices.
 */
function allowedValues(column: string): string[] {
  const pattern = new RegExp(
    `check\\s*\\(\\s*(?:${column}\\s+is\\s+null\\s+or\\s+)?${column}\\s+in\\s*\\(([^)]*)\\)`,
    'gi',
  )
  const found = [...allSql.matchAll(pattern)]
  if (found.length !== 1) {
    throw new Error(
      `Expected exactly one check constraint for "${column}", found ${found.length}.`,
    )
  }
  return [...found[0][1].matchAll(/'([^']*)'/g)].map((match) => match[1]).sort()
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

/** Each union, the file it lives in, and the column whose allow-list it mirrors. */
const PAIRS = [
  { union: 'MatchRound', file: TOURNAMENT_DATA, column: 'round' },
  { union: 'MatchResultState', file: TOURNAMENT_DATA, column: 'result_state' },
  { union: 'MatchResultMethod', file: TOURNAMENT_DATA, column: 'result_method' },
  { union: 'AdminResultState', file: ADMIN, column: 'result_state' },
  { union: 'AdminResultMethod', file: ADMIN, column: 'result_method' },
] as const

describe('TypeScript unions match the database allow-lists', () => {
  it('parses both sides at all', () => {
    // Without this, a changed `check` idiom or a moved type would empty one
    // side and make every comparison below pass vacuously.
    for (const { union, file, column } of PAIRS) {
      expect(allowedValues(column).length, `${column} allow-list`).toBeGreaterThan(1)
      expect(unionMembers(file, union).length, `${union} members`).toBeGreaterThan(1)
    }
  })

  it.each(PAIRS)('$union equals the $column allow-list', ({ union, file, column }) => {
    expect(unionMembers(file, union)).toEqual(allowedValues(column))
  })

  it('pins the values themselves', () => {
    // The comparison above only proves the two sides agree. If both were edited
    // together the pair would still match, so the values are pinned as well —
    // a new knockout stage or result method has to be a deliberate change here.
    expect(allowedValues('round')).toEqual(['final', 'group', 'qf', 'r16', 'sf'])
    expect(allowedValues('result_state')).toEqual(['confirmed', 'corrected', 'scheduled'])
    expect(allowedValues('result_method')).toEqual(['extra_time', 'penalties', 'regulation'])
  })

  it('keeps the duplicated unions agreeing with each other', () => {
    // MatchResultState/AdminResultState and MatchResultMethod/AdminResultMethod
    // are separate hand-written copies of one constraint each. Comparing both
    // to the database already covers this, but stating it directly names the
    // failure mode: two client types disagreeing about the same column.
    expect(unionMembers(TOURNAMENT_DATA, 'MatchResultState')).toEqual(
      unionMembers(ADMIN, 'AdminResultState'),
    )
    expect(unionMembers(TOURNAMENT_DATA, 'MatchResultMethod')).toEqual(
      unionMembers(ADMIN, 'AdminResultMethod'),
    )
  })
})
