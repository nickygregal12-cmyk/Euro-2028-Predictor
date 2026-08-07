#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '../..')
const migrationDir = resolve(repositoryRoot, 'supabase/migrations')

export const SOURCE_CONTRACT = 63
export const TARGET_CONTRACT = 67
export const SOURCE_VERSION = '20260729154931'
export const SOURCE_NAME = 'prediction_consensus_minimum_cohort'
export const TARGET_VERSION = '20260803180000'
export const TARGET_NAME = 'matchweek_lock_scope'
export const EXPECTED_MIGRATIONS = [
  '20260730180000_cup_winner_deletion_semantics.sql',
  '20260730235602_stage_c1_competition_season_foundation.sql',
  '20260803070000_c1b_game_catalogue_memberships.sql',
  '20260803180000_matchweek_lock_scope.sql',
]
export const CRITICAL_COUNT_KEYS = [
  'auth_users',
  'profiles',
  'tournaments',
  'teams',
  'matches',
  'entries',
  'match_predictions',
  'leagues',
  'league_members',
  'score_events',
  'entry_totals',
]
export const EXPECTED_CRITICAL_COUNT_DELTAS = Object.freeze({
  // Contract 66 deliberately seeds the two 2026/27 domestic league seasons.
  // Every other critical Production row count must remain unchanged.
  tournaments: 2,
})

function fail(message) {
  throw new Error(message)
}

function parseArguments(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (['--db-url', '--source-inventory', '--output'].includes(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`Missing value for ${argument}`)
      result[argument.slice(2).replaceAll('-', '_')] = value
      index += 1
      continue
    }
    fail(`Unknown argument: ${argument}`)
  }
  for (const required of ['db_url', 'source_inventory', 'output']) {
    if (!result[required]) fail(`Missing --${required.replaceAll('_', '-')}`)
  }
  return result
}

export function assertDisposableLocalDatabase(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    fail('Batch A rehearsal requires a parseable local PostgreSQL URL')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('Batch A rehearsal requires a PostgreSQL URL')
  }
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.port !== '54322') {
    fail('Batch A rehearsal refuses any database except disposable local Supabase on port 54322')
  }
  if (parsed.pathname !== '/postgres') {
    fail('Batch A rehearsal requires the disposable local postgres database')
  }
}

function run(binary, arguments_, { capture = false } = {}) {
  const result = spawnSync(binary, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
  if (result.error) fail(`${binary} failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = capture ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim() : ''
    fail(`${binary} exited with status ${result.status}${detail ? `: ${detail}` : ''}`)
  }
  return capture ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim() : ''
}

function queryJson(dbUrl, sql) {
  const raw = run(
    process.env.PSQL_BIN || 'psql',
    [dbUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', sql],
    { capture: true },
  )
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length !== 1) fail(`Expected one JSON row from rehearsal query, got ${lines.length}`)
  try {
    return JSON.parse(lines[0])
  } catch (error) {
    fail(`Could not parse rehearsal JSON: ${error.message}`)
  }
}

function migrationHistory(dbUrl) {
  return queryJson(
    dbUrl,
    `select json_build_object(
      'count', count(*),
      'latest_version', max(version),
      'latest_name', (select name from supabase_migrations.schema_migrations order by version desc limit 1)
    )::text
    from supabase_migrations.schema_migrations;`,
  )
}

function criticalCounts(dbUrl) {
  return queryJson(
    dbUrl,
    `select json_build_object(
      'auth_users', (select count(*) from auth.users),
      'profiles', (select count(*) from public.profiles),
      'tournaments', (select count(*) from public.tournaments),
      'teams', (select count(*) from public.teams),
      'matches', (select count(*) from public.matches),
      'entries', (select count(*) from public.entries),
      'match_predictions', (select count(*) from public.match_predictions),
      'leagues', (select count(*) from public.leagues),
      'league_members', (select count(*) from public.league_members),
      'score_events', (select count(*) from public.score_events),
      'entry_totals', (select count(*) from public.entry_totals)
    )::text;`,
  )
}

function extensionAndCronBoundary(dbUrl) {
  return queryJson(
    dbUrl,
    `select json_build_object(
      'pg_net_installed', exists(select 1 from pg_extension where extname = 'pg_net'),
      'active_cron_jobs', coalesce((
        select json_agg(json_build_object('schedule', schedule, 'command', command) order by jobid)
        from cron.job
        where active
      ), '[]'::json)
    )::text;`,
  )
}

function lockScopeBoundary(dbUrl) {
  return queryJson(
    dbUrl,
    `select json_object_agg(game_key, lock_scope)::text
       from public.game_definitions
      where game_key in ('main_predictor', 'last_man_standing', 'original_predictor', 'ko_predictor');`,
  )
}

function domesticSeasonBoundary(dbUrl) {
  return queryJson(
    dbUrl,
    `select coalesce(
      json_agg(
        json_build_object(
          'slug', c.slug,
          'name', t.name,
          'season_key', t.season_key,
          'kind', t.kind,
          'display_timezone', t.display_timezone,
          'status', t.status
        ) order by c.slug
      ),
      '[]'::json
    )::text
    from public.tournaments t
    join public.competitions c on c.id = t.competition_id
    where c.slug in ('premier-league', 'scottish-premiership')
      and t.season_key = '2026-27';`,
  )
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function assertSourceInventory(sourceInventory) {
  if (!sourceInventory || typeof sourceInventory !== 'object') fail('Source inventory is not an object')
  if (!sourceInventory.counts || typeof sourceInventory.counts !== 'object') {
    fail('Source inventory has no counts object')
  }
  for (const key of CRITICAL_COUNT_KEYS) {
    if (!Number.isInteger(sourceInventory.counts[key])) {
      fail(`Source inventory is missing integer critical count ${key}`)
    }
  }
}

export function assertCriticalCountsUnchanged(sourceCounts, postCounts) {
  for (const key of CRITICAL_COUNT_KEYS) {
    if (postCounts[key] !== sourceCounts[key]) {
      fail(`Critical count changed during Batch A rehearsal: ${key} ${sourceCounts[key]} -> ${postCounts[key]}`)
    }
  }
}

export function assertCriticalCountsAfterBatchA(sourceCounts, postCounts) {
  for (const key of CRITICAL_COUNT_KEYS) {
    const expectedDelta = EXPECTED_CRITICAL_COUNT_DELTAS[key] ?? 0
    const expected = sourceCounts[key] + expectedDelta
    if (postCounts[key] !== expected) {
      fail(
        `Unexpected critical count after Batch A: ${key} expected ${expected} ` +
          `(${sourceCounts[key]} ${expectedDelta >= 0 ? '+' : '-'} ${Math.abs(expectedDelta)}), got ${postCounts[key]}`,
      )
    }
  }
}

export function assertDomesticSeasonBoundary(seasons) {
  const expected = [
    {
      slug: 'premier-league',
      name: 'Premier League 2026/27',
      season_key: '2026-27',
      kind: 'league_season',
      display_timezone: 'Europe/London',
      status: 'draft',
    },
    {
      slug: 'scottish-premiership',
      name: 'Scottish Premiership 2026/27',
      season_key: '2026-27',
      kind: 'league_season',
      display_timezone: 'Europe/London',
      status: 'draft',
    },
  ]
  if (JSON.stringify(seasons) !== JSON.stringify(expected)) {
    fail(`Unexpected domestic season seed boundary after Batch A: ${JSON.stringify(seasons)}`)
  }
}

function assertHistory(history, count, version, name, label) {
  if (
    history.count !== count ||
    history.latest_version !== version ||
    history.latest_name !== name
  ) {
    fail(
      `${label} migration history mismatch: expected ${count}/${version}/${name}, ` +
        `got ${history.count}/${history.latest_version}/${history.latest_name}`,
    )
  }
}

function assertBatchABoundaries(boundary, lockScopes) {
  if (boundary.pg_net_installed !== false) fail('Batch A unexpectedly installed pg_net')
  if (!Array.isArray(boundary.active_cron_jobs) || boundary.active_cron_jobs.length !== 1) {
    fail('Batch A must retain exactly one active cron job')
  }
  const [job] = boundary.active_cron_jobs
  if (
    job.schedule !== '* * * * *' ||
    String(job.command).trim() !== 'select public.process_due_entry_submissions();'
  ) {
    fail('Batch A changed the contract-63 cron boundary')
  }
  const expectedScopes = {
    main_predictor: 'matchweek',
    last_man_standing: 'matchweek',
    original_predictor: 'entry',
    ko_predictor: 'match',
  }
  for (const [gameKey, expected] of Object.entries(expectedScopes)) {
    if (lockScopes[gameKey] !== expected) {
      fail(`Unexpected ${gameKey} lock scope after Batch A: ${lockScopes[gameKey]}`)
    }
  }
}

function isolateBatchA() {
  const migrations = readdirSync(migrationDir)
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
  const expectedAtBoundary = migrations.slice(SOURCE_CONTRACT, TARGET_CONTRACT)
  if (JSON.stringify(expectedAtBoundary) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
    fail(
      `Repository contracts 64-67 no longer match the approved Batch A allowlist: ` +
        `${expectedAtBoundary.join(', ')}`,
    )
  }

  const stagingRoot = mkdtempSync(resolve(tmpdir(), 'production-batch-a-migrations-'))
  const moved = []
  for (const filename of migrations) {
    const version = filename.slice(0, 14)
    if (version <= TARGET_VERSION) continue
    const source = resolve(migrationDir, filename)
    const destination = resolve(stagingRoot, filename)
    renameSync(source, destination)
    moved.push({ source, destination })
  }
  return {
    restore() {
      for (const { source, destination } of moved) {
        if (existsSync(destination)) renameSync(destination, source)
      }
      rmSync(stagingRoot, { recursive: true, force: true })
    },
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2))
  assertDisposableLocalDatabase(arguments_.db_url)

  const sourceInventory = JSON.parse(readFileSync(arguments_.source_inventory, 'utf8'))
  assertSourceInventory(sourceInventory)

  const beforeHistory = migrationHistory(arguments_.db_url)
  assertHistory(beforeHistory, SOURCE_CONTRACT, SOURCE_VERSION, SOURCE_NAME, 'Restored source')
  const beforeCounts = criticalCounts(arguments_.db_url)
  assertCriticalCountsUnchanged(sourceInventory.counts, beforeCounts)

  const isolated = isolateBatchA()
  try {
    const dryRun = run(
      process.env.SUPABASE_BIN || 'supabase',
      ['db', 'push', '--db-url', arguments_.db_url, '--dry-run'],
      { capture: true },
    )
    const dryRunMigrations = [
      ...new Set(dryRun.match(/\b\d{14}_[A-Za-z0-9_-]+\.sql\b/g) ?? []),
    ]
    if (JSON.stringify(dryRunMigrations) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
      fail(`Dry run is not exactly Batch A: ${dryRunMigrations.join(', ') || '(none)'}`)
    }

    run(process.env.SUPABASE_BIN || 'supabase', [
      'db',
      'push',
      '--db-url',
      arguments_.db_url,
    ])

    const afterHistory = migrationHistory(arguments_.db_url)
    assertHistory(afterHistory, TARGET_CONTRACT, TARGET_VERSION, TARGET_NAME, 'Batch A target')
    const afterCounts = criticalCounts(arguments_.db_url)
    assertCriticalCountsAfterBatchA(sourceInventory.counts, afterCounts)
    const domesticSeasons = domesticSeasonBoundary(arguments_.db_url)
    assertDomesticSeasonBoundary(domesticSeasons)
    const boundary = extensionAndCronBoundary(arguments_.db_url)
    const lockScopes = lockScopeBoundary(arguments_.db_url)
    assertBatchABoundaries(boundary, lockScopes)

    writeJson(arguments_.output, {
      result: 'passed',
      source_contract: SOURCE_CONTRACT,
      target_contract: TARGET_CONTRACT,
      source_migration: `${SOURCE_VERSION}_${SOURCE_NAME}`,
      target_migration: `${TARGET_VERSION}_${TARGET_NAME}`,
      dry_run_migrations: dryRunMigrations,
      migration_sha256: Object.fromEntries(
        EXPECTED_MIGRATIONS.map((filename) => [
          filename,
          sha256(resolve(migrationDir, filename)),
        ]),
      ),
      critical_counts: Object.fromEntries(
        CRITICAL_COUNT_KEYS.map((key) => [key, afterCounts[key]]),
      ),
      critical_count_deltas: EXPECTED_CRITICAL_COUNT_DELTAS,
      domestic_seasons: domesticSeasons,
      pg_net_installed: boundary.pg_net_installed,
      active_cron_jobs: boundary.active_cron_jobs,
      lock_scopes: lockScopes,
      verified_at_utc: new Date().toISOString(),
    })
  } finally {
    isolated.restore()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Production Batch A rehearsal failed: ${error.message}`)
    process.exitCode = 1
  })
}
