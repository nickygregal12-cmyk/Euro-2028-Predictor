import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

export const DEVELOPMENT_PROJECT_REF = 'iouzoutneyjpugbbtdem'
export const PRODUCTION_PROJECT_REF = 'vkfnsqdyhvtwyqkisxhk'
export const EXPECTED_SUPABASE_VERSION = '2.84.2'
export const STAGE_C1_VERSION = '20260730235602'
export const STAGE_C1_SHA256 =
  '010eff888e9a5884d40467802e13a2997ddaa8827e9cf44d659154972e13b656'

export const repositoryRoot = resolve(import.meta.dirname, '../..')

export function fail(message) {
  throw new Error(message)
}

export function parseArguments(argv, { baseline = false } = {}) {
  const result = { help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      result.help = true
      continue
    }
    if (argument === '--project-ref' || argument === '--output' || argument === '--baseline') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`Missing value for ${argument}`)
      result[argument.slice(2).replace('-', '_')] = value
      index += 1
      continue
    }
    fail(`Unknown argument: ${argument}`)
  }

  if (result.help) return result
  if (!result.project_ref) fail('Pass --project-ref iouzoutneyjpugbbtdem')
  if (!result.output) fail('Pass --output to a new evidence file outside the repository')
  if (baseline && !result.baseline) fail('Pass --baseline to the canonical preflight artifact')
  return result
}

export function run(binary, arguments_, options = {}) {
  return execFileSync(binary, arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.quietStderr ? 'pipe' : 'inherit'],
    ...options,
  }).trim()
}

function git(...arguments_) {
  return run('git', arguments_)
}

function pathInside(parent, child) {
  const pathFromParent = relative(parent, child)
  return pathFromParent === '' || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== '..')
}

function canonicalOutputPath(path) {
  if (!isAbsolute(path)) fail('--output must be an absolute path')
  if (existsSync(path)) fail(`Refusing to overwrite existing evidence: ${path}`)

  const parent = dirname(path)
  mkdirSync(parent, { recursive: true, mode: 0o700 })
  if (lstatSync(parent).isSymbolicLink()) fail('--output parent must not be a symbolic link')
  const resolvedParent = realpathSync(parent)
  const resolvedRepository = realpathSync(repositoryRoot)
  if (pathInside(resolvedRepository, resolvedParent)) {
    fail('--output must be outside the repository')
  }
  return resolve(resolvedParent, path.slice(parent.length + 1))
}

function assertCleanExactMain() {
  const head = git('rev-parse', 'HEAD')
  const originMain = git('rev-parse', 'origin/main')
  if (head !== originMain) {
    fail(`Evidence must run from exact origin/main (${originMain}); current HEAD is ${head}`)
  }

  const dirty = git('status', '--porcelain=v1', '--untracked-files=all')
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.slice(3).startsWith('supabase/.temp/'))
  if (dirty.length > 0) fail('Repository working tree must be clean except for Supabase link metadata')
  return head
}

function assertCanonicalMigration() {
  const migrationFiles = git('ls-files', 'supabase/migrations/*.sql').split('\n').filter(Boolean)
  if (migrationFiles.length !== 65) {
    fail(`Expected 65 canonical migrations; found ${migrationFiles.length}`)
  }
  const migrationPath = resolve(
    repositoryRoot,
    `supabase/migrations/${STAGE_C1_VERSION}_stage_c1_competition_season_foundation.sql`,
  )
  const digest = createHash('sha256').update(readFileSync(migrationPath)).digest('hex')
  if (digest !== STAGE_C1_SHA256) {
    fail(`Stage C1 migration checksum mismatch: ${digest}`)
  }
}

function assertProjectRef(projectRef) {
  if (projectRef === PRODUCTION_PROJECT_REF) fail('Production is explicitly out of scope')
  if (projectRef !== DEVELOPMENT_PROJECT_REF) {
    fail(`Expected development project ${DEVELOPMENT_PROJECT_REF}; received ${projectRef}`)
  }
}

function assertDevelopmentDatabaseUrl(rawUrl) {
  if (!rawUrl) fail('SUPABASE_DEV_DB_URL is required in db-url target mode')
  if (rawUrl.includes(PRODUCTION_PROJECT_REF)) {
    fail('SUPABASE_DEV_DB_URL references production; refusing to continue')
  }
  if (!rawUrl.includes(DEVELOPMENT_PROJECT_REF)) {
    fail(`SUPABASE_DEV_DB_URL must reference development project ${DEVELOPMENT_PROJECT_REF}`)
  }

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    fail('SUPABASE_DEV_DB_URL is not a valid PostgreSQL URL')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('SUPABASE_DEV_DB_URL must use the postgres or postgresql protocol')
  }

  const databaseIdentity = `${parsed.hostname} ${decodeURIComponent(parsed.username)}`
  if (!databaseIdentity.includes(DEVELOPMENT_PROJECT_REF)) {
    fail('SUPABASE_DEV_DB_URL hostname or username does not prove the development project ref')
  }

  // The direct db.<ref>.supabase.co endpoint resolves only to IPv6, which
  // GitHub Actions runners cannot reach — runs 30725333555 and 30725505316
  // both dialed it and died at connect. Requiring the Session pooler here
  // turns that late network failure into an immediate, named refusal.
  if (!parsed.hostname.endsWith('.pooler.supabase.com')) {
    fail(
      'SUPABASE_DEV_DB_URL must be the Session pooler URI (*.pooler.supabase.com); ' +
        'the direct database endpoint is IPv6-only and unreachable from GitHub Actions',
    )
  }
}

export function databaseTargetArguments(projectRef) {
  assertProjectRef(projectRef)
  const mode = process.env.STAGE_C1_TARGET_MODE || 'linked'
  if (mode === 'db-url') {
    const databaseUrl = process.env.SUPABASE_DEV_DB_URL?.trim()
    assertDevelopmentDatabaseUrl(databaseUrl)
    return ['--db-url', databaseUrl]
  }
  if (mode !== 'linked') fail(`Unknown STAGE_C1_TARGET_MODE: ${mode}`)

  const linkedRefPath = resolve(repositoryRoot, 'supabase/.temp/project-ref')
  if (!existsSync(linkedRefPath)) fail('Run supabase link for the approved development project first')
  const linkedRef = readFileSync(linkedRefPath, 'utf8').trim()
  if (linkedRef !== projectRef) fail(`Linked project is ${linkedRef}; expected ${projectRef}`)
  return ['--linked']
}

function supabaseBinary() {
  return process.env.SUPABASE_BIN || 'supabase'
}

function assertSupabaseVersion(binary) {
  const versionOutput = run(binary, ['--version'])
  if (!versionOutput.includes(EXPECTED_SUPABASE_VERSION)) {
    fail(`Supabase CLI ${EXPECTED_SUPABASE_VERSION} is required; found ${versionOutput}`)
  }
  return versionOutput
}

function extractPayload(raw, column) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    fail(`Supabase query did not return JSON: ${error.message}`)
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0]?.[column]) {
    fail(`Expected exactly one ${column} result row`)
  }
  return parsed[0][column]
}

/**
 * The evidence SQL files are two top-level statements: a fail-closed DO
 * assertion block, then the single-row payload SELECT. `supabase db query
 * --db-url` sends the file as one prepared statement, and Postgres refuses
 * multiple commands in a prepared statement (SQLSTATE 42601, observed on run
 * 30764596752 — the first run to get past the connection). psql executes the
 * same unchanged file over the simple protocol: the DO block still aborts the
 * run on any assertion failure via ON_ERROR_STOP, and the payload SELECT is
 * the only output row. Linked mode keeps the CLI path, which executes through
 * the platform API and accepts the multi-statement file.
 */
function queryEvidencePayload(targetArguments, sqlPath, resultColumn) {
  if (targetArguments[0] === '--db-url') {
    const psql = process.env.PSQL_BIN || 'psql'
    const raw = run(psql, [
      targetArguments[1],
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--file',
      sqlPath,
    ])
    try {
      return JSON.parse(raw)
    } catch (error) {
      fail(`psql did not return the single ${resultColumn} JSON payload: ${error.message}`)
    }
  }
  const raw = run(supabaseBinary(), [
    'db',
    'query',
    ...targetArguments,
    '--file',
    sqlPath,
    '--output',
    'json',
    '--agent',
    'no',
  ])
  return extractPayload(raw, resultColumn)
}

export function collectEvidence({ projectRef, sqlPath, resultColumn, phase }) {
  const targetArguments = databaseTargetArguments(projectRef)
  const commit = assertCleanExactMain()
  assertCanonicalMigration()
  const cliVersion = assertSupabaseVersion(supabaseBinary())
  return {
    artifact_format: 1,
    captured_at_utc: new Date().toISOString(),
    phase,
    project_ref: projectRef,
    repository_commit: commit,
    supabase_cli_version: cliVersion,
    evidence: queryEvidencePayload(targetArguments, sqlPath, resultColumn),
  }
}

export function writeEvidence(path, artifact) {
  const outputPath = canonicalOutputPath(path)
  const temporaryPath = `${outputPath}.tmp-${process.pid}`
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    chmodSync(temporaryPath, 0o600)
    renameSync(temporaryPath, outputPath)
  } catch (error) {
    rmSync(temporaryPath, { force: true })
    throw error
  }
  return outputPath
}

function canonical(value) {
  return JSON.stringify(value)
}

function assertEqual(label, before, after) {
  if (canonical(before) !== canonical(after)) fail(`${label} differs from canonical preflight`)
}

function assertArraySubset(label, before, after, key) {
  const afterByKey = new Map(after.map((item) => [key(item), item]))
  for (const item of before) {
    const postflightItem = afterByKey.get(key(item))
    if (!postflightItem || canonical(postflightItem) !== canonical(item)) {
      fail(`${label} changed for ${key(item)}`)
    }
  }
}

export function readPreflightArtifact(path) {
  const artifact = JSON.parse(readFileSync(resolve(path), 'utf8'))
  if (artifact.artifact_format !== 1 || artifact.phase !== 'preflight') {
    fail('Baseline is not a canonical Stage C1 preflight artifact')
  }
  if (artifact.project_ref !== DEVELOPMENT_PROJECT_REF) fail('Baseline targets the wrong project')
  if (artifact.evidence?.contract?.count !== 64) fail('Baseline is not contract 64')
  return artifact
}

export function assertPreserved(preflightArtifact, postflightArtifact) {
  if (postflightArtifact.repository_commit !== preflightArtifact.repository_commit) {
    fail('Preflight and postflight must use the same exact main commit')
  }
  const before = preflightArtifact.evidence
  const after = postflightArtifact.evidence

  assertEqual('Audit history digest and count', before.audit, after.audit)
  assertEqual('Preservation row counts', before.preservation_counts, after.preservation_counts)
  assertEqual('Euro 2028 stable identity', before.euro_2028, after.euro_2028)
  assertEqual('Auth foreign-key deletion matrix', before.auth_foreign_keys, after.auth_foreign_keys)
  assertEqual('Direct ownership policies', before.ownership_policies, after.ownership_policies)
  assertEqual('Existing browser relation grants', before.browser_grants, after.browser_grants)
  assertArraySubset('Existing RLS state', before.rls_state, after.rls_state, (item) => item.table)
  assertArraySubset(
    'Existing function security',
    before.function_security,
    after.function_security,
    (item) => item.signature,
  )
  assertArraySubset(
    'Existing trigger binding',
    before.trigger_bindings,
    after.trigger_bindings,
    (item) => `${item.table}.${item.trigger}`,
  )
}

export function assertEquivalentBeforeState(expectedArtifact, observedArtifact) {
  const observed = {
    ...observedArtifact,
    repository_commit: expectedArtifact.repository_commit,
  }
  assertPreserved(expectedArtifact, observed)
}
