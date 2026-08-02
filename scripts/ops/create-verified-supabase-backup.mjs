#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import {
  DEVELOPMENT_PROJECT_REF,
  assertEquivalentBeforeState,
  collectEvidence,
  databaseTargetArguments,
  fail,
  readPreflightArtifact,
  repositoryRoot,
} from './stage-c1-evidence-lib.mjs'

const usage = `Usage (linked mode by default; CI sets STAGE_C1_TARGET_MODE=db-url
and consumes SUPABASE_DEV_DB_URL only from the environment):
  BACKUP_AGE_PUBLIC_KEY=age1... \\
  SUPABASE_BIN=/absolute/path/to/supabase \\
  SHRED_BIN=/absolute/path/to/shred \\
  node scripts/ops/create-verified-supabase-backup.mjs \\
    --project-ref iouzoutneyjpugbbtdem \\
    --preflight /secure/path/stage-c1-preflight-UTC.json \\
    --backup-root /secure/path/outside/repository`

function parseArguments(argv) {
  const result = { help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      result.help = true
      continue
    }
    if (['--project-ref', '--preflight', '--backup-root'].includes(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`Missing value for ${argument}`)
      result[argument.slice(2).replace('-', '_')] = value
      index += 1
      continue
    }
    fail(`Unknown argument: ${argument}`)
  }
  if (result.help) return result
  if (!result.project_ref) fail(`Pass --project-ref ${DEVELOPMENT_PROJECT_REF}`)
  if (!result.preflight) fail('Pass --preflight to the fresh canonical preflight artifact')
  if (!result.backup_root) fail('Pass --backup-root to a secure directory outside the repository')
  return result
}

function run(binary, arguments_, { capture = false, quiet = false } = {}) {
  const result = spawnSync(binary, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'] : 'inherit',
  })
  if (result.error) fail(`${binary} failed to start: ${result.error.message}`)
  if (result.status !== 0) fail(`${binary} exited with status ${result.status}`)
  return capture ? result.stdout.trim() : ''
}

function requireCommand(binary) {
  const probe = spawnSync(binary, ['--version'], { encoding: 'utf8', stdio: 'pipe' })
  if (probe.error || probe.status !== 0) fail(`Required command is unavailable: ${binary}`)
}

function inside(parent, child) {
  const fromParent = relative(parent, child)
  return fromParent === '' || (!fromParent.startsWith(`..${sep}`) && fromParent !== '..')
}

function prepareBackupRoot(path) {
  if (!isAbsolute(path)) fail('--backup-root must be an absolute path')
  mkdirSync(path, { recursive: true, mode: 0o700 })
  if (lstatSync(path).isSymbolicLink()) fail('--backup-root must not be a symbolic link')
  const absolute = resolve(path)
  if (inside(resolve(repositoryRoot), absolute)) fail('--backup-root must be outside the repository')
  chmodSync(absolute, 0o700)
  return absolute
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function walkFiles(root) {
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(path))
    else if (entry.isFile()) files.push(path)
    else fail(`Unexpected non-file backup entry: ${path}`)
  }
  return files.sort()
}

function secureRemove(root, shredBinary) {
  if (!existsSync(root)) return
  const paths = statSync(root).isDirectory() ? walkFiles(root) : [root]
  for (const path of paths) run(shredBinary, ['-u', path])
  if (existsSync(root)) rmSync(root, { recursive: true })
}

function writeChecksums(bundle) {
  const lines = walkFiles(bundle)
    .filter((path) => basename(path) !== 'SHA256SUMS')
    .map((path) => `${sha256(path)}  ${relative(bundle, path)}`)
  writeFileSync(resolve(bundle, 'SHA256SUMS'), `${lines.join('\n')}\n`, { mode: 0o600 })
}

function assertDumpContains(path, pattern, label) {
  if (!pattern.test(readFileSync(path, 'utf8'))) {
    fail(`${basename(path)} does not contain ${label}; refuse an incomplete backup`)
  }
}

function restoredPreflight(localDbUrl) {
  const sqlPath = resolve(
    repositoryRoot,
    'supabase/ops/stage-c1/stage-c1-hosted-preflight.sql',
  )
  const stdout = run(
    process.env.PSQL_BIN || 'psql',
    [localDbUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-f', sqlPath],
    { capture: true },
  )
  const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length !== 1) fail('Disposable restore did not emit one preflight JSON payload')
  return JSON.parse(lines[0])
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

let localStarted = false
let temporaryRoot
let plaintextTar
let shredBinary

try {
  const arguments_ = parseArguments(process.argv.slice(2))
  if (arguments_.help) {
    console.log(usage)
    process.exit(0)
  }

  const recipient = process.env.BACKUP_AGE_PUBLIC_KEY?.trim()
  if (!recipient || !/^age1[0-9a-z]+$/.test(recipient)) {
    fail('BACKUP_AGE_PUBLIC_KEY must be the owner-controlled age recipient')
  }

  const supabase = process.env.SUPABASE_BIN || 'supabase'
  const psql = process.env.PSQL_BIN || 'psql'
  shredBinary = process.env.SHRED_BIN || 'shred'
  const age = process.env.AGE_BIN || 'age'
  for (const command of [supabase, psql, shredBinary, age, 'docker', 'tar']) {
    requireCommand(command)
  }
  run('docker', ['info'], { capture: true, quiet: true })

  const baseline = readPreflightArtifact(arguments_.preflight)
  const source = collectEvidence({
    projectRef: arguments_.project_ref,
    sqlPath: 'supabase/ops/stage-c1/stage-c1-hosted-preflight.sql',
    resultColumn: 'stage_c1_preflight',
    phase: 'preflight',
  })
  assertEquivalentBeforeState(baseline, source)
  const targetArguments = databaseTargetArguments(arguments_.project_ref)

  const backupRoot = prepareBackupRoot(arguments_.backup_root)
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const artifactName = `euro28-development-${timestamp}.backup.tar.gz.age`
  const finalArtifact = resolve(backupRoot, artifactName)
  const finalEvidence = `${finalArtifact}.evidence.json`
  if (existsSync(finalArtifact) || existsSync(finalEvidence)) fail('Backup output already exists')

  temporaryRoot = mkdtempSync(resolve(backupRoot, '.stage-c1-backup-'))
  chmodSync(temporaryRoot, 0o700)
  const bundle = resolve(temporaryRoot, 'bundle')
  mkdirSync(resolve(bundle, 'verification'), { recursive: true, mode: 0o700 })

  writeJson(resolve(bundle, 'source-preflight.json'), source)
  writeFileSync(resolve(bundle, 'repository-commit.txt'), `${source.repository_commit}\n`, { mode: 0o600 })
  writeFileSync(resolve(bundle, 'project-ref.txt'), `${arguments_.project_ref}\n`, { mode: 0o600 })
  writeFileSync(
    resolve(bundle, 'supabase-cli-version.txt'),
    `${source.supabase_cli_version}\n`,
    { mode: 0o600 },
  )

  console.log('Capturing roles, schema, data, and migration history from development…')
  run(supabase, ['db', 'dump', ...targetArguments, '--role-only', '--file', resolve(bundle, 'roles.sql')])
  run(supabase, ['db', 'dump', ...targetArguments, '--file', resolve(bundle, 'schema.sql')])
  run(supabase, [
    'db', 'dump', ...targetArguments, '--data-only', '--use-copy',
    '--exclude', 'storage.buckets_vectors', '--exclude', 'storage.vector_indexes',
    '--file', resolve(bundle, 'data.sql'),
  ])
  run(supabase, [
    'db', 'dump', ...targetArguments, '--schema', 'supabase_migrations',
    '--file', resolve(bundle, 'migration-history-schema.sql'),
  ])
  run(supabase, [
    'db', 'dump', ...targetArguments, '--schema', 'supabase_migrations',
    '--data-only', '--use-copy', '--file', resolve(bundle, 'migration-history-data.sql'),
  ])

  for (const filename of [
    'roles.sql',
    'schema.sql',
    'data.sql',
    'migration-history-schema.sql',
    'migration-history-data.sql',
  ]) {
    const path = resolve(bundle, filename)
    if (!existsSync(path) || statSync(path).size === 0) fail(`Backup dump is empty: ${filename}`)
  }
  assertDumpContains(resolve(bundle, 'data.sql'), /(COPY|INSERT INTO)\s+"?auth"?\."?users"?/i, 'auth.users')
  assertDumpContains(resolve(bundle, 'data.sql'), /(COPY|INSERT INTO)\s+"?public"?\."?profiles"?/i, 'public.profiles')
  assertDumpContains(
    resolve(bundle, 'migration-history-data.sql'),
    /(COPY|INSERT INTO)\s+"?supabase_migrations"?\."?schema_migrations"?/i,
    'canonical migration history',
  )

  for (const filename of [
    'managed-schema-customizations.sql',
    'prepare-disposable-restore-target.sql',
  ]) {
    copyFileSync(
      resolve(repositoryRoot, 'scripts/database-rollout', filename),
      resolve(bundle, filename),
    )
  }
  for (const filename of [
    'stage-c1-hosted-preflight.sql',
    'stage-c1-audit-digest.sql',
    'stage-c1-hosted-postflight.sql',
  ]) {
    copyFileSync(
      resolve(repositoryRoot, 'supabase/ops/stage-c1', filename),
      resolve(bundle, 'verification', filename),
    )
  }
  writeChecksums(bundle)

  console.log('Restoring the plaintext bundle into a disposable local Supabase…')
  run(supabase, ['start'])
  localStarted = true
  const localDbUrl = process.env.LOCAL_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

  // The hosted role dump names platform-managed roles (`ALTER ROLE
  // supabase_admin …`), and the disposable stack's supautils protection
  // refuses any modification of a reserved role — run 30765694087 died at
  // roles.sql:13 exactly there. Those roles exist with platform-managed
  // configuration on both sides, so they are not part of the application
  // state this rehearsal proves. The rehearsal restores a filtered copy;
  // the encrypted evidence bundle keeps the original roles.sql untouched.
  const PLATFORM_MANAGED_ROLES = [
    'supabase_admin',
    'supabase_auth_admin',
    'supabase_storage_admin',
    'supabase_functions_admin',
    'supabase_realtime_admin',
    'supabase_replication_admin',
    'supabase_read_only_user',
    'authenticator',
    'pgbouncer',
    'dashboard_user',
    'postgres',
    'anon',
    'authenticated',
    'service_role',
  ]
  const managedAlternation = PLATFORM_MANAGED_ROLES.join('|')
  const managedRoleStatement = new RegExp(
    `^\\s*(?:CREATE|ALTER|DROP)\\s+ROLE\\s+"?(?:${managedAlternation})"?\\s*(?:;|\\s)`,
  )
  const managedRoleMembership = new RegExp(`^\\s*GRANT\\s+"?(?:${managedAlternation})"?\\s+TO\\s`)
  const rehearsalRolesPath = resolve(bundle, '..', 'roles.rehearsal.sql')
  writeFileSync(
    rehearsalRolesPath,
    readFileSync(resolve(bundle, 'roles.sql'), 'utf8')
      .split('\n')
      .filter((line) => !managedRoleStatement.test(line) && !managedRoleMembership.test(line))
      .join('\n'),
    { mode: 0o600 },
  )

  // Hosted Auth and Storage upgrade continuously; the disposable stack's
  // images are pinned by the CLI version, so platform-managed tables drift a
  // column at a time (run 30766302401: auth.custom_oauth_providers gained
  // custom_claims_allowlist; run 30766851663: storage.s3_multipart_uploads
  // gained metadata). Those tables are platform state, not application
  // state. The rehearsal therefore compares each managed-schema COPY block
  // against the columns the disposable stack actually has and skips blocks
  // that cannot fit — loudly, and only inside auth/storage. Application
  // schemas are never skipped: a mismatch there still aborts the rehearsal,
  // and the protected identity/content tables may never be skipped at all.
  // The encrypted bundle keeps the full data.sql byte-for-byte, so real
  // recovery against a matching hosted target loses nothing.
  const MANAGED_SKEW_SCHEMAS = new Set(['auth', 'storage'])
  const MUST_RESTORE_TABLES = new Set([
    'auth.users',
    'auth.identities',
    'storage.buckets',
    'storage.objects',
  ])
  function localManagedColumns() {
    const raw = run(psql, [
      localDbUrl,
      '-X',
      '--no-align',
      '--tuples-only',
      '-v',
      'ON_ERROR_STOP=1',
      '--command',
      "select table_schema || '.' || table_name || '|' || string_agg(column_name, ',') " +
        "from information_schema.columns where table_schema in ('auth', 'storage') " +
        'group by table_schema, table_name',
    ])
    const columnsByTable = new Map()
    for (const line of raw.split('\n').filter(Boolean)) {
      const [table, columns] = line.split('|')
      columnsByTable.set(table, new Set(columns.split(',')))
    }
    return columnsByTable
  }
  function withoutSkewedManagedCopyBlocks(sql, columnsByTable) {
    const lines = sql.split('\n')
    const kept = []
    let skippingUntilTerminator = false
    for (const line of lines) {
      if (skippingUntilTerminator) {
        if (line.trim() === '\\.') skippingUntilTerminator = false
        continue
      }
      const copyTarget = line.match(/^COPY\s+([^\s(]+)\s*\(([^)]*)\)/)
      if (copyTarget) {
        const table = copyTarget[1].replaceAll('"', '')
        const schema = table.split('.')[0]
        if (MANAGED_SKEW_SCHEMAS.has(schema)) {
          const localColumns = columnsByTable.get(table)
          const dumpedColumns = copyTarget[2].split(',').map((c) => c.trim().replaceAll('"', ''))
          const fits =
            localColumns !== undefined && dumpedColumns.every((c) => localColumns.has(c))
          if (!fits) {
            if (MUST_RESTORE_TABLES.has(table)) {
              fail(`Rehearsal cannot skip protected table ${table}; its shape must match`)
            }
            console.log(`Rehearsal skips version-skewed managed table ${table}`)
            skippingUntilTerminator = true
            continue
          }
        }
      }
      kept.push(line)
    }
    if (skippingUntilTerminator) fail('Unterminated COPY block while preparing the rehearsal data file')
    return kept.join('\n')
  }
  const rehearsalDataPath = resolve(bundle, '..', 'data.rehearsal.sql')
  writeFileSync(
    rehearsalDataPath,
    withoutSkewedManagedCopyBlocks(
      readFileSync(resolve(bundle, 'data.sql'), 'utf8'),
      localManagedColumns(),
    ),
    { mode: 0o600 },
  )
  const prepareSql = `
begin;
drop schema if exists predictor_internal cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
drop schema if exists supabase_migrations cascade;
truncate table auth.users cascade;
truncate table storage.objects, storage.buckets cascade;
commit;`
  run(psql, [localDbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '--command', prepareSql])
  run(psql, [localDbUrl, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1', '--file', rehearsalRolesPath])
  run(psql, [localDbUrl, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1', '--file', resolve(bundle, 'schema.sql')])
  run(psql, [
    localDbUrl, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
    '--command', 'SET session_replication_role = replica', '--file', rehearsalDataPath,
  ])
  run(psql, [
    localDbUrl, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
    '--file', resolve(bundle, 'managed-schema-customizations.sql'),
  ])
  run(psql, [
    localDbUrl, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
    '--file', resolve(bundle, 'migration-history-schema.sql'),
  ])
  run(psql, [
    localDbUrl, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
    '--file', resolve(bundle, 'migration-history-data.sql'),
  ])

  const restored = restoredPreflight(localDbUrl)
  assertEquivalentBeforeState(source, {
    repository_commit: source.repository_commit,
    evidence: restored,
  })
  writeJson(resolve(bundle, 'restore-verification.json'), {
    verified_at_utc: new Date().toISOString(),
    restored_contract: restored.contract,
    restored_audit: restored.audit,
    restored_counts: restored.preservation_counts,
    comparison: 'source-equivalent',
  })
  writeChecksums(bundle)

  run(supabase, ['stop', '--no-backup'])
  localStarted = false

  plaintextTar = resolve(temporaryRoot, artifactName.replace(/\.age$/, ''))
  run('tar', ['-C', bundle, '-czf', plaintextTar, '.'])
  const plaintextDigest = sha256(plaintextTar)
  const encryptedTemporary = resolve(temporaryRoot, artifactName)
  run(age, ['-r', recipient, '-o', encryptedTemporary, plaintextTar])
  if (!existsSync(encryptedTemporary) || statSync(encryptedTemporary).size === 0) {
    fail('age did not produce a non-empty encrypted artifact')
  }

  secureRemove(bundle, shredBinary)
  secureRemove(plaintextTar, shredBinary)
  plaintextTar = undefined
  renameSync(encryptedTemporary, finalArtifact)
  chmodSync(finalArtifact, 0o600)

  const summary = {
    artifact_format: 1,
    captured_at_utc: source.captured_at_utc,
    project_ref: arguments_.project_ref,
    repository_commit: source.repository_commit,
    source_contract: source.evidence.contract,
    audit: source.evidence.audit,
    encrypted_artifact: basename(finalArtifact),
    encrypted_sha256: sha256(finalArtifact),
    encrypted_size_bytes: statSync(finalArtifact).size,
    plaintext_tar_sha256_verified_before_encryption: plaintextDigest,
    restore_rehearsal: 'passed-source-equivalent',
    plaintext_cleanup: 'shredded',
  }
  writeJson(finalEvidence, summary)
  chmodSync(finalEvidence, 0o600)
  rmSync(temporaryRoot, { recursive: true })
  temporaryRoot = undefined

  console.log(`Verified encrypted backup: ${finalArtifact}`)
  console.log(`Recovery evidence: ${finalEvidence}`)
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
} finally {
  if (localStarted) {
    try {
      execFileSync(process.env.SUPABASE_BIN || 'supabase', ['stop', '--no-backup'], {
        cwd: repositoryRoot,
        stdio: 'inherit',
      })
    } catch {
      console.error('ERROR: disposable Supabase cleanup failed')
      process.exitCode = 1
    }
  }
  if (plaintextTar && existsSync(plaintextTar) && shredBinary) {
    try {
      secureRemove(plaintextTar, shredBinary)
    } catch {
      console.error(`ERROR: plaintext tar cleanup failed: ${plaintextTar}`)
      process.exitCode = 1
    }
  }
  if (temporaryRoot && existsSync(temporaryRoot) && shredBinary) {
    try {
      secureRemove(temporaryRoot, shredBinary)
    } catch {
      console.error(`ERROR: plaintext staging cleanup failed: ${temporaryRoot}`)
      process.exitCode = 1
    }
  }
}
