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

export const SOURCE_CONTRACT = 67
export const TARGET_CONTRACT = 96
export const SOURCE_VERSION = '20260803180000'
export const SOURCE_NAME = 'matchweek_lock_scope'
export const TARGET_VERSION = '20260804243000'
export const TARGET_NAME = 'cup_tie_settlement_refusal_order'
export const EXPECTED_MIGRATIONS = [
  '20260803193000_season_fixtures.sql',
  '20260803203000_season_predictions.sql',
  '20260803213000_season_scoring.sql',
  '20260803223000_lms_pick_resolution.sql',
  '20260803233000_lms_persistence.sql',
  '20260804003000_lms_round_conclusion.sql',
  '20260804013000_season_cup_rules.sql',
  '20260804023000_cup_neutral_points_source.sql',
  '20260804033000_cup_neutral_settlement_source.sql',
  '20260804043000_season_cup_sources.sql',
  '20260804053000_cup_league_schedule.sql',
  '20260804063000_cup_store_competition_domains.sql',
  '20260804073000_season_card_lock_resolution.sql',
  '20260804093000_season_card_status.sql',
  '20260804103000_season_card_no_prefill.sql',
  '20260804113000_season_matchweek_scheduler.sql',
  '20260804123000_lms_eligibility_parity.sql',
  '20260804133000_lms_settlement.sql',
  '20260804143000_lms_season_selection.sql',
  '20260804153000_lms_used_cycle.sql',
  '20260804163000_lms_auto_assignment.sql',
  '20260804173000_lms_settlement_job.sql',
  '20260804183000_season_matchweek_scores.sql',
  '20260804193000_matchweek_settlement_parity.sql',
  '20260804203000_season_fixture_replay_link.sql',
  '20260804213000_season_matchweek_scoring_job.sql',
  '20260804223000_season_standings_parity.sql',
  '20260804233000_season_leaderboard_read.sql',
  '20260804243000_cup_tie_settlement_refusal_order.sql',
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

export const EXPECTED_ACTIVE_CRON_JOBS = [
  { schedule: '* * * * *', command: 'select public.process_due_entry_submissions();' },
  { schedule: '* * * * *', command: 'select public.process_due_season_matchweek_submissions();' },
  { schedule: '0 * * * *', command: 'select public.process_due_season_lms_settlements();' },
  { schedule: '30 * * * *', command: 'select public.process_due_season_matchweek_scores();' },
]

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
    fail('Batch B rehearsal requires a parseable local PostgreSQL URL')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('Batch B rehearsal requires a PostgreSQL URL')
  }
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.port !== '54322') {
    fail('Batch B rehearsal refuses any database except disposable local Supabase on port 54322')
  }
  if (parsed.pathname !== '/postgres') {
    fail('Batch B rehearsal requires the disposable local postgres database')
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

function objectBoundary(dbUrl) {
  return queryJson(
    dbUrl,
    `select json_build_object(
      'season_fixtures', to_regclass('public.season_fixtures') is not null,
      'season_predictions', to_regclass('public.season_predictions') is not null,
      'season_matchweek_scores', to_regclass('public.season_matchweek_scores') is not null,
      'season_cup_window_fixtures', to_regclass('public.season_cup_window_fixtures') is not null
    )::text;`,
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
      fail(`Critical count changed during Batch B rehearsal: ${key} ${sourceCounts[key]} -> ${postCounts[key]}`)
    }
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

function assertDomesticSeasons(seasons) {
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
    fail(`Unexpected domestic season boundary after Batch B: ${JSON.stringify(seasons)}`)
  }
}

function assertBatchBBoundaries(boundary, objects) {
  if (boundary.pg_net_installed !== false) fail('Batch B unexpectedly installed pg_net')
  if (JSON.stringify(boundary.active_cron_jobs) !== JSON.stringify(EXPECTED_ACTIVE_CRON_JOBS)) {
    fail(`Unexpected Batch B cron boundary: ${JSON.stringify(boundary.active_cron_jobs)}`)
  }
  for (const [name, present] of Object.entries(objects)) {
    if (present !== true) fail(`Batch B target object missing: ${name}`)
  }
}

function isolateBatchB() {
  const migrations = readdirSync(migrationDir)
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
  const expectedAtBoundary = migrations.slice(SOURCE_CONTRACT, TARGET_CONTRACT)
  if (JSON.stringify(expectedAtBoundary) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
    fail(
      `Repository contracts 68-96 no longer match the approved Batch B allowlist: ` +
        `${expectedAtBoundary.join(', ')}`,
    )
  }

  const stagingRoot = mkdtempSync(resolve(tmpdir(), 'production-batch-b-migrations-'))
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

  const isolated = isolateBatchB()
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
      fail(`Dry run is not exactly Batch B: ${dryRunMigrations.join(', ') || '(none)'}`)
    }

    run(process.env.SUPABASE_BIN || 'supabase', [
      'db',
      'push',
      '--db-url',
      arguments_.db_url,
    ])

    const afterHistory = migrationHistory(arguments_.db_url)
    assertHistory(afterHistory, TARGET_CONTRACT, TARGET_VERSION, TARGET_NAME, 'Batch B target')
    const afterCounts = criticalCounts(arguments_.db_url)
    assertCriticalCountsUnchanged(sourceInventory.counts, afterCounts)
    const domesticSeasons = domesticSeasonBoundary(arguments_.db_url)
    assertDomesticSeasons(domesticSeasons)
    const boundary = extensionAndCronBoundary(arguments_.db_url)
    const objects = objectBoundary(arguments_.db_url)
    assertBatchBBoundaries(boundary, objects)

    writeJson(arguments_.output, {
      result: 'passed',
      source_contract: SOURCE_CONTRACT,
      target_contract: TARGET_CONTRACT,
      source_migration: `${SOURCE_VERSION}_${SOURCE_NAME}`,
      target_migration: `${TARGET_VERSION}_${TARGET_NAME}`,
      dry_run_migrations: dryRunMigrations,
      migration_sha256: Object.fromEntries(
        EXPECTED_MIGRATIONS.map((filename) => [filename, sha256(resolve(migrationDir, filename))]),
      ),
      critical_counts: Object.fromEntries(
        CRITICAL_COUNT_KEYS.map((key) => [key, afterCounts[key]]),
      ),
      domestic_seasons: domesticSeasons,
      pg_net_installed: boundary.pg_net_installed,
      active_cron_jobs: boundary.active_cron_jobs,
      target_objects: objects,
      verified_at_utc: new Date().toISOString(),
    })
  } finally {
    isolated.restore()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Production Batch B rehearsal failed: ${error.message}`)
    process.exitCode = 1
  })
}
