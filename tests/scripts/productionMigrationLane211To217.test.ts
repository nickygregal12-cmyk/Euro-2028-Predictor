import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Production has no general lane and never will: each boundary gets its own
 * reviewed, pinned pair. The cost of that rule is that a pair goes out of date
 * the moment another migration lands, and the temptation is then to widen the
 * old pair in place rather than re-review it.
 *
 * These assertions pin what the 211-to-217 pair is only safe inside. They read
 * the workflows rather than trusting their names, in the same spirit as
 * `developmentFastLaneRollout.test.ts`.
 */

const root = process.cwd()
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8')

const REHEARSAL_PATH = '.github/workflows/production-211-to-217-rehearsal.yml'
const ROLLOUT_PATH = '.github/workflows/production-211-to-217-rollout.yml'
const VERIFIER_PATH = 'scripts/database-rollout/verify-production-211-to-217.mjs'
const PRESERVED_PATH = 'scripts/database-rollout/production-211-to-217-preserved-state.sql'
const BOUNDARY_PATH = 'scripts/database-rollout/production-211-to-217-boundary-state.sql'

const rehearsal = read(REHEARSAL_PATH)
const rollout = read(ROLLOUT_PATH)
const verifier = read(VERIFIER_PATH)

const DEVELOPMENT_REF = 'iouzoutneyjpugbbtdem'
const PRODUCTION_REF = 'vkfnsqdyhvtwyqkisxhk'

const BOUNDARY_FILES = [
  '20260820130000_matchweek_card_publishes_the_fixture_lock.sql',
  '20260820150000_drop_unmeasured_sportmonks_tokens.sql',
  '20260820170000_confirmation_tracks_current_card.sql',
  '20260823001000_ai_canonical_value_currency.sql',
  '20260823120000_reminder_dispatch_wiring.sql',
  '20260824090000_web_push_channel.sql',
]

const DESTRUCTIVE_FILES = [
  '20260820150000_drop_unmeasured_sportmonks_tokens.sql',
  '20260824090000_web_push_channel.sql',
]

describe('the lane is pinned to one boundary and names it by filename', () => {
  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s pins source 211 and target 217', (_label, workflow) => {
    expect(workflow).toContain("SOURCE_CONTRACT: '211'")
    expect(workflow).toContain("SOURCE_VERSION: '20260820090000'")
    expect(workflow).toContain("TARGET_CONTRACT: '217'")
    expect(workflow).toContain("TARGET_VERSION: '20260824090000'")
    expect(workflow).toContain('TARGET_NAME: web_push_channel')
  })

  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s names all six contracts by filename, not by number', (_label, workflow) => {
    // `216` is a typo away from `217`. A filename is not.
    for (const file of BOUNDARY_FILES) expect(workflow).toContain(file)
    expect(workflow).toContain('boundary is not exactly Contracts 212 through 217')
  })

  it('every file the lane names exists exactly once in the migration tree', () => {
    for (const file of BOUNDARY_FILES) {
      expect(existsSync(resolve(root, 'supabase/migrations', file))).toBe(true)
    }
  })

  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s refuses a repository that is not exactly 217 migrations', (_label, workflow) => {
    // This is what makes the earlier 211-to-213 pair unrunnable rather than
    // merely out of date, and it is the property worth keeping.
    expect(workflow).toContain("git ls-files 'supabase/migrations/*.sql' | wc -l")
    expect(workflow).toMatch(/\[ "\$\{committed\}" = "\$\{TARGET_CONTRACT\}" \]/)
    expect(workflow).toMatch(/\[ "\$\{declared\}" = "\$\{TARGET_CONTRACT\}" \]/)
  })
})

describe('the lane cannot reach the wrong environment', () => {
  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s refuses the Development project ref by name', (_label, workflow) => {
    expect(workflow).toContain(`FORBIDDEN_DEVELOPMENT_REF: ${DEVELOPMENT_REF}`)
    expect(workflow).toContain(`EXPECTED_PROJECT_REF: ${PRODUCTION_REF}`)
    expect(workflow).toContain('ERROR: that is Development.')
  })

  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s checks the SECRET resolves to Production, not just the typed input', (_label, workflow) => {
    // The dispatcher types a ref; the secret is what psql actually connects to.
    expect(workflow).toContain('ERROR: Production secret resolves to Development.')
    expect(workflow).toContain('ERROR: Production secret does not name Production.')
  })

  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s runs only from main, at exact origin/main, with a clean checkout', (_label, workflow) => {
    expect(workflow).toContain("[ \"${GITHUB_REF}\" = 'refs/heads/main' ]")
    expect(workflow).toContain('ERROR: HEAD is not exact main.')
    expect(workflow).toContain('ERROR: checkout is dirty.')
  })
})

describe('Development is never second', () => {
  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s reads the Development record and refuses if it is below 217', (_label, workflow) => {
    expect(workflow).toContain(
      'Refuse to make Production the first hosted environment to see Contract 217',
    )
    expect(workflow).toContain("require('./config/development-hosted-contract.json').requiredMigrationCount")
    expect(workflow).toMatch(/\[ "\$\{dev_contract\}" -ge "\$\{TARGET_CONTRACT\}" \]/)
  })
})

describe('the rehearsal rehearses and never writes Production', () => {
  it('pushes only to the disposable local copy', () => {
    const pushes = rehearsal.match(/supabase db push[^\n]*/g) ?? []
    expect(pushes.length).toBeGreaterThan(0)
    for (const push of pushes) {
      expect(push).toContain('LOCAL_DB_URL')
      expect(push).not.toContain('SUPABASE_PROD_DB_URL')
    }
  })

  it('reads Production only to dump it, and proves it is at 211 first', () => {
    expect(rehearsal).toContain('Confirm Production is exactly 211 before dumping it')
    expect(rehearsal).toContain('supabase db dump')
  })

  it('runs every boundary suite plus the two it must not break', () => {
    for (const suite of [
      '258_matchweek_card_publishes_the_fixture_lock',
      '259_unmeasured_provider_tokens_fail_closed',
      '260_current_card_confirmation',
      '261_ai_canonical_value_currency',
      '262_reminder_dispatch_wiring',
      '263_web_push_channel',
      // Regression: the contracts Production already holds must still stand.
      '255_provider_fixture_lifecycle',
      '257_provider_deadline_watch_tier',
    ]) {
      expect(rehearsal).toContain(`supabase/tests/${suite}.sql`)
      expect(existsSync(resolve(root, `supabase/tests/${suite}.sql`))).toBe(true)
    }
    // A suite that errors and a suite that reports failures are different
    // things, and only one of them makes the CLI exit non-zero.
    expect(rehearsal).toContain("grep -q 'Result: PASS'")
  })

  it('runs every suite and fails at the end, rather than dying at the first', () => {
    // Stopping at the first failure costs a whole rehearsal cycle per failing
    // suite — a dump and restore of Production is four minutes — and hides how
    // many suites are unhappy, so a second failure reads as a regression
    // introduced by the fix for the first.
    expect(rehearsal).toContain('failed=1')
    expect(rehearsal).toContain('[ "${failed}" -eq 0 ]')
    expect(rehearsal).toContain('suite-results.txt')
  })

  it('names the failing suite in an annotation, not only in the artifact', () => {
    // The evidence artifact lives on blob storage. An operator or agent whose
    // egress policy denies that host could otherwise see THAT the suites failed
    // without being able to see WHICH — which is how this assertion came to
    // exist.
    expect(rehearsal).toContain('::error file=${REL}::')
    expect(rehearsal).toContain('GITHUB_STEP_SUMMARY')
  })
})

describe('the rollout is gated on the rehearsal that actually rehearsed it', () => {
  it('requires both a backup and a rehearsal run id', () => {
    expect(rollout).toContain('backup_run_id:')
    expect(rollout).toContain('rehearsal_run_id:')
    expect(rollout).toContain('.github/workflows/production-211-to-217-rehearsal.yml')
    expect(rollout).toContain('.github/workflows/production-backup.yml')
  })

  it('requires the rehearsal head to be the EXACT rollout head, not an ancestor', () => {
    // A rehearsal of a different tree has rehearsed a different migration set.
    expect(rollout).toContain('[ "${rehearsal_sha}" = "$(git rev-parse HEAD)" ]')
    expect(rollout).toContain('is not rollout head')
  })

  it('requires the backup to precede the rehearsal and still hold its artifact', () => {
    expect(rollout).toContain('ERROR: backup does not precede rehearsal.')
    expect(rollout).toContain('production-backup-encrypted')
    expect(rollout).toContain('.expired == false')
  })

  it('requires one acknowledgement per destructive contract, not one for the batch', () => {
    // A single tick-box would let the second destructive contract through on
    // the strength of having read the first.
    for (const file of DESTRUCTIVE_FILES) {
      expect(rollout).toContain(`ACKNOWLEDGE-DESTRUCTIVE-${file}`)
    }
    expect(rollout).toContain('destructive_acknowledgement_213:')
    expect(rollout).toContain('destructive_acknowledgement_217:')
    expect(rollout).toContain('ERROR: Contract 213 acknowledgement mismatch.')
    expect(rollout).toContain('ERROR: Contract 217 acknowledgement mismatch.')
  })

  it('proves the dry run is the boundary before it applies anything', () => {
    const applyStep = rollout.slice(rollout.indexOf('Dry run and apply exactly'))
    expect(applyStep.indexOf('--dry-run')).toBeLessThan(
      applyStep.indexOf('supabase db push --db-url "${SUPABASE_PROD_DB_URL}"\n'),
    )
    expect(rollout).toContain('ERROR: Production dry run is not exactly Contracts 212 through 217.')
  })
})

describe('the additive guard is a report on both destructive contracts', () => {
  it.each([
    ['rehearsal', rehearsal],
    ['rollout', rollout],
  ])('%s proves 213 AND 217 are both refused, not just one', (_label, workflow) => {
    expect(workflow).toContain('unexpectedly passed the additive guard')
    expect(workflow).toMatch(/for destructive in "\$\{CONTRACT_213\}" "\$\{CONTRACT_217\}"/)
    expect(workflow).toMatch(
      /for additive in "\$\{CONTRACT_212\}" "\$\{CONTRACT_214\}" "\$\{CONTRACT_215\}" "\$\{CONTRACT_216\}"/,
    )
  })
})

describe('the rehearsal and the rollout ask the same question', () => {
  it('both run the same verifier and the same state SQL', () => {
    // A rehearsal that asks a different question from the rollout has
    // rehearsed nothing. The 211-to-213 pair inlined one 40-line SQL block four
    // times across two workflows; four copies of one question is four places
    // for it to drift.
    for (const workflow of [rehearsal, rollout]) {
      expect(workflow).toContain(PRESERVED_PATH)
      expect(workflow).toContain(BOUNDARY_PATH)
      expect(workflow).toContain(VERIFIER_PATH)
    }
    expect(existsSync(resolve(root, PRESERVED_PATH))).toBe(true)
    expect(existsSync(resolve(root, BOUNDARY_PATH))).toBe(true)
  })

  it('the preserved-state query is read before AND after, so it must be valid at 211', () => {
    const preserved = read(PRESERVED_PATH)
    // Anything contracts 212 to 217 CREATE belongs in the boundary file: reading
    // it on a 211 database raises, and the read that raises is the BEFORE one,
    // so the promotion fails at its first step with a confusing message.
    //
    // Checked as syntax rather than as a bare substring, because these names
    // legitimately appear in the fingerprint's exclusion list — as strings,
    // naming functions to skip, never as objects to touch. An earlier version of
    // this assertion could not tell those apart and failed on the exclusion
    // list itself.
    for (const relation of [
      'public.push_subscriptions',
      'predictor_internal.reminder_dispatch_runs',
      'ai.current_fixture_recommendations',
    ]) {
      expect(preserved).not.toContain(`from ${relation}`)
      expect(preserved).not.toContain(`'${relation}'::regclass`)
    }
    // A call, which a name in a string list is not.
    expect(preserved).not.toMatch(/reminder_sender_configuration\s*\(/)
    expect(preserved).not.toMatch(/season_card_confirmation_reference\s*\(/)
    // Contract 217's column, on a table that exists at 211.
    expect(preserved).not.toMatch(/\bchannel\b/)
  })
})

describe('the verifier checks what the ledger cannot answer', () => {
  it('proves the recreated function kept its grants and gained no browser role', () => {
    // Contract 217 drops and recreates `claim_due_reminders`, and a dropped
    // function takes its grants with it. This is the specific risk the
    // migration introduces and the ledger is silent about it.
    expect(verifier).toContain("eq('claim_service_role_execute', boundary.claim_service_role_execute, true)")
    expect(verifier).toContain("eq('claim_authenticated_execute', boundary.claim_authenticated_execute, false)")
    expect(verifier).toContain("eq('claim_anon_execute', boundary.claim_anon_execute, false)")
  })

  it('proves the sender arrives inert, so applying it sends nothing and pays nothing', () => {
    expect(verifier).toContain('sender_secrets_present')
    expect(verifier).toContain('sender_configured')
  })

  it('compares the fixture histogram whole rather than by total', () => {
    // A migration that invented a postponement would leave `season_fixtures`
    // unchanged while moving a fixture between statuses.
    expect(verifier).toContain("same('fixture_status_histogram'")
  })

  it('expects exactly one new cron job, because a second is as wrong as none', () => {
    expect(verifier).toContain("eq('cron_jobs', after.cron_jobs, Number(before.cron_jobs) + 1)")
  })

  it('reports every problem it found rather than the first', () => {
    expect(verifier).toContain('problems.join')
  })
})

/**
 * A verifier is only worth the run it gates if it FAILS when the thing it
 * guards is broken. These drive it with a synthetic 211-to-217 promotion and
 * then reintroduce, one at a time, the defect each assertion exists to catch.
 *
 * This is the same discipline the migrations themselves are held to — contract
 * 217's own in-transaction assertions were each proved non-vacuous by restoring
 * the defect they guard — applied to the postflight rather than to the apply.
 */
describe('the verifier fails when the promotion is wrong', () => {
  const VERIFIER = resolve(root, VERIFIER_PATH)

  const BEFORE = {
    migration_count: 211,
    latest_version: '20260820090000',
    latest_name: 'provider_deadline_watch_tier',
    auth_users: 1,
    profiles: 1,
    entries: 3,
    season_predictions: 16,
    match_predictions: 36,
    league_members: 1,
    season_fixtures: 578,
    reminder_deliveries: 0,
    ai_bets: 230,
    cron_jobs: 11,
    public_enabled: false,
    betting_public_enabled: false,
    fixture_status_histogram: { played: 12, scheduled: 566 },
    lifecycle_transition_count: 0,
    provider_status_observation_count: 0,
    poll_dials: { t1: [1440, 10, 15, 60, 720] },
    protected_function_fingerprint: 'abc123',
  }

  const AFTER = {
    ...BEFORE,
    migration_count: 217,
    latest_version: '20260824090000',
    latest_name: 'web_push_channel',
    // Contract 216 schedules exactly one job.
    cron_jobs: 12,
  }

  const BOUNDARY = {
    card_calls_lock_authority: true,
    card_publishes_lock_fields: true,
    buffer_authority_present: 1,
    dropped_tokens_remaining: 0,
    dropped_tokens_not_unknown: 0,
    measured_postponed_kind: 'postponed',
    cancelled_or_abandoned_mappings: 0,
    confirmation_reference_present: 1,
    confirm_calls_confirmation_reference: true,
    canonical_view_uses_canonical: true,
    dispatch_runs_rls: true,
    dispatch_job_schedule: '*/5 * * * *',
    dispatch_job_active: true,
    sender_configuration: { configured: false, secrets_present: false, job_active: true, error: null },
    push_subscriptions_rls: true,
    push_subscriptions_rows: 0,
    push_subscriptions_policies: 2,
    push_subscriptions_anon_grants: 0,
    push_subscriptions_authenticated_grants: 'delete,select',
    reminder_deliveries_channel_default: "'email'::text",
    reminder_deliveries_non_email: 0,
    claim_returns_channel: true,
    claim_service_role_execute: true,
    claim_authenticated_execute: false,
    claim_anon_execute: false,
    save_push_authenticated_execute: true,
    save_push_anon_execute: false,
    once_per_action_key: 'UNIQUE (user_id, action_key, reminder_kind)',
  }

  function runVerifier(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    boundary: Record<string, unknown>,
  ): { ok: boolean; output: string } {
    const dir = mkdtempSync(join(tmpdir(), 'verify-211-217-'))
    try {
      const paths = { BEFORE_FILE: 'before', AFTER_FILE: 'after', BOUNDARY_FILE: 'boundary' }
      const env: NodeJS.ProcessEnv = { ...process.env }
      for (const [variable, name] of Object.entries(paths)) {
        const file = join(dir, `${name}.json`)
        writeFileSync(file, JSON.stringify({ before, after, boundary }[name]))
        env[variable] = file
      }
      try {
        const output = execFileSync('node', [VERIFIER], { env, encoding: 'utf8', stdio: 'pipe' })
        return { ok: true, output }
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string }
        return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('passes a promotion that did exactly what the six contracts claim', () => {
    // Without this the failure cases below would prove nothing: a verifier that
    // rejects everything also rejects every defect.
    const { ok, output } = runVerifier(BEFORE, AFTER, BOUNDARY)
    expect(output).toContain('verification passed')
    expect(ok).toBe(true)
  })

  const BOUNDARY_DEFECTS: [string, Record<string, unknown>, string][] = [
    // The specific risk contract 217's `drop function` introduces.
    ['the recreated claim_due_reminders lost its service_role grant', { claim_service_role_execute: false }, 'claim_service_role_execute'],
    ['a browser role gained execute on claim_due_reminders', { claim_authenticated_execute: true }, 'claim_authenticated_execute'],
    ['anon gained execute on save_push_subscription', { save_push_anon_execute: true }, 'save_push_anon_execute'],
    // The reason this boundary is safe to apply before a sender exists.
    ['the sender arrived configured, so it would send and spend', { sender_configuration: { configured: true, secrets_present: true, job_active: true, error: null } }, 'sender_secrets_present'],
    ['push_subscriptions was exposed to anon', { push_subscriptions_anon_grants: 1 }, 'push_subscriptions_anon_grants'],
    ['a dropped SportMonks token still resolves to something', { dropped_tokens_not_unknown: 1 }, 'dropped_tokens_not_unknown'],
    ['the matchweek card stopped reading the lock authority', { card_calls_lock_authority: false }, 'card_calls_lock_authority'],
    ['the canonical currency guard is missing from the view', { canonical_view_uses_canonical: false }, 'canonical_view_uses_canonical'],
    // A missing constraint comes back as SQL null, not as a wrong string.
    ['the once-per-action key was widened away', { once_per_action_key: null }, 'once_per_action_key'],
  ]

  it.each(BOUNDARY_DEFECTS)('catches: %s', (_label, override, expectedKey) => {
    const { ok, output } = runVerifier(BEFORE, AFTER, { ...BOUNDARY, ...override })
    expect(ok).toBe(false)
    expect(output).toContain(expectedKey)
  })

  const PRESERVATION_DEFECTS: [string, Record<string, unknown>, string][] = [
    ['a fixture silently moved between statuses', { fixture_status_histogram: { played: 12, postponed: 1, scheduled: 565 } }, 'fixture_status_histogram'],
    ['a player-owned row disappeared', { match_predictions: 35 }, 'match_predictions'],
    ['an unrelated function was redefined', { protected_function_fingerprint: 'deadbeef' }, 'protected_function_fingerprint'],
    ['provider polling cadence was touched', { poll_dials: { t1: [360, 10, 15, 60, 720] } }, 'poll_dials'],
    ['two cron jobs appeared instead of one', { cron_jobs: 13 }, 'cron_jobs'],
    ['no cron job appeared at all', { cron_jobs: 11 }, 'cron_jobs'],
    ['the ledger stopped short of 217', { migration_count: 216 }, 'migration_count'],
    ['a publication gate opened during the promotion', { public_enabled: true }, 'public_enabled'],
  ]

  it.each(PRESERVATION_DEFECTS)('catches: %s', (_label, override, expectedKey) => {
    const { ok, output } = runVerifier(BEFORE, { ...AFTER, ...override }, BOUNDARY)
    expect(ok).toBe(false)
    expect(output).toContain(expectedKey)
  })

  it('reports every problem in one run rather than stopping at the first', () => {
    const { ok, output } = runVerifier(
      BEFORE,
      { ...AFTER, match_predictions: 35 },
      { ...BOUNDARY, claim_anon_execute: true },
    )
    expect(ok).toBe(false)
    expect(output).toContain('match_predictions')
    expect(output).toContain('claim_anon_execute')
  })
})
