import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every writer that upserts a competition must name the partial index.
 *
 * THE DEFECT CLASS THIS FILE EXISTS FOR. Contract 103 replaced
 * `unique (tournament_id, game_key)` with a PARTIAL unique index over live
 * instances (`where completed_at is null`). A bare
 * `on conflict (tournament_id, game_key)` cannot infer a partial index, so
 * every such statement fails at runtime with 42P10 — "there is no unique or
 * exclusion constraint matching the ON CONFLICT specification".
 *
 * That is not a subtle failure, and it still got through twice. The reason is
 * worth writing down, because it is a lesson about auditing rather than about
 * SQL: the contract's own review audited READERS of the replaced key, and both
 * escapes were WRITERS. Then the first fix audited writers with `pg_proc`,
 * which sees function bodies only — and the third escape was a standalone
 * script (`scripts/bonus-games/publish-catalogue.sql`) that no database
 * catalogue can see because it is never stored in one.
 *
 * So the audit surface is: committed migrations, pgTAP suites, seed and
 * fixture SQL, and helper scripts. This test reads all of them from the
 * repository — the one place that holds every writer regardless of where it
 * eventually runs.
 *
 * WHY A TEST RATHER THAN A THIRD FIX. Fixing instance three would leave
 * instance four to CI. A repository-wide rule cannot be escaped by adding a
 * file in a directory nobody thought of.
 */

const repositoryRoot = process.cwd()

/**
 * Statements that upsert onto the competition pair, wherever they live.
 *
 * `git ls-files` rather than a directory walk: it covers the whole repository,
 * skips build output and node_modules, and picks up any new location
 * automatically — which is the entire point, since the third escape was in a
 * directory this test's author had not considered.
 */
const sqlFiles = execFileSync('git', ['ls-files', '*.sql'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

/**
 * The contract that introduced the partial index. Migrations are append-only
 * and replay in filename order, so everything BEFORE this one runs while the
 * old total constraint still exists and is correct as written. Only this
 * migration and later ones — plus every non-migration file, which always runs
 * against the finished schema — must name the predicate.
 */
const PARTIAL_INDEX_MIGRATION = '20260804333000_competition_instance_lineage.sql'

const CONFLICT_TARGET = /on\s+conflict\s*\(\s*tournament_id\s*,\s*game_key\s*\)(\s*where\s+visibility_kind\s*=\s*'public'\s+and\s+completed_at\s+is\s+null)?/gi

type Offender = { file: string; line: number }

/**
 * Blank out comments and string literals, preserving offsets so line numbers
 * stay honest.
 *
 * Necessary, and found the hard way: the first version of this guard flagged
 * two hits inside the contract-103 migration's own header, which is prose
 * *describing* the bare form in order to warn against it. A guard that fires on
 * a comment explaining the rule is a guard people switch off, so the scan has
 * to read code only. Dollar-quoted function bodies are deliberately NOT
 * stripped — a writer inside one is exactly what escape two was.
 */
function code(source: string): string {
  let out = ''
  let index = 0
  while (index < source.length) {
    if (source.startsWith('--', index)) {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      out += ' '.repeat(stop - index)
      index = stop
      continue
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(index, stop).replace(/[^\n]/g, ' ')
      index = stop
      continue
    }
    if (source[index] === "'") {
      const end = source.indexOf("'", index + 1)
      const stop = end === -1 ? source.length : end + 1
      const literal = source.slice(index, stop)
      out += literal.toLowerCase() === "'public'"
        ? literal
        : literal.replace(/[^\n]/g, ' ')
      index = stop
      continue
    }
    out += source[index]
    index += 1
  }
  return out
}

function scan(): { offenders: Offender[]; qualified: number } {
  const offenders: Offender[] = []
  let qualified = 0

  for (const file of sqlFiles) {
    const isMigration = file.startsWith('supabase/migrations/')
    if (isMigration) {
      const name = file.slice('supabase/migrations/'.length)
      // Replays before the index exists; the bare target is correct there.
      if (name < PARTIAL_INDEX_MIGRATION) continue
    }

    const source = code(readFileSync(resolve(repositoryRoot, file), 'utf8'))
    for (const match of source.matchAll(CONFLICT_TARGET)) {
      if (match[1]) {
        qualified += 1
        continue
      }
      const line = source.slice(0, match.index).split('\n').length
      offenders.push({ file, line })
    }
  }

  return { offenders, qualified }
}

describe('competition upserts name the partial live-public-instance index', () => {
  it('finds the writers it is meant to be checking', () => {
    // Without this the suite below passes vacuously the moment the regex, the
    // file list or the conflict style changes — and a silently inert guard is
    // exactly what let three instances of this defect through.
    const { qualified } = scan()
    expect(qualified).toBeGreaterThan(0)
  })

  it('has no unqualified `on conflict (tournament_id, game_key)` anywhere', () => {
    const { offenders } = scan()
    expect(
      offenders.map(({ file, line }) => `${file}:${line}`),
      'a bare or incomplete conflict target cannot infer the partial live-public-instance index and fails at runtime with 42P10; add `where visibility_kind = 'public' and completed_at is null`',
    ).toEqual([])
  })

  it('covers scripts and fixtures, not only migrations and functions', () => {
    // The specific blind spots that produced escapes two and three: a database
    // catalogue sees function bodies but not standalone scripts, and the seed
    // replay covered `seed.sql` but not the helper SQL the browser workflow
    // runs after it.
    expect(sqlFiles).toContain('scripts/bonus-games/publish-catalogue.sql')
    expect(sqlFiles).toContain('supabase/seed.sql')
    expect(sqlFiles.some((file) => file.startsWith('e2e/'))).toBe(true)
    expect(sqlFiles.some((file) => file.startsWith('supabase/tests/'))).toBe(true)
  })
})
