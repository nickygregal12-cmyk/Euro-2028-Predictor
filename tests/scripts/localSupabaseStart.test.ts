import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The disposable-Supabase start step, and the line between an infrastructure
 * failure and a real one.
 *
 * Three jobs bring up a local Supabase — the two in `database-parity.yml` and
 * the authenticated browser suite. Over one working session that step failed
 * three times for reasons unrelated to any change under test: twice on the
 * storage health check, once on a port collision on 54322 straight after the
 * CLI's own `Starting database... / Stopping containers...` sequence.
 *
 * Each cost a re-run, and each produced a red check that looked exactly like a
 * real failure. In the same session a GENUINE pgTAP failure appeared on the same
 * job, and the only thing distinguishing them was whether `/tmp/pgtap.log` had
 * been uploaded — the tests had run in one case and never started in the other.
 * That is too fine a distinction to leave to whoever reads the tick, because
 * "probably the flake again" is a habit that eventually waves a real failure
 * through.
 *
 * So the start is retried, and this file guards the two properties that make
 * that safe rather than dangerous:
 *
 *   1. only the START is retried — never a migration, a lint or a test;
 *   2. a start that fails every attempt still fails the job.
 *
 * A retry that swallows its final failure is worse than no retry, because it
 * converts a broken stack into a green tick.
 */

const repositoryRoot = process.cwd()

const action = readFileSync(
  resolve(repositoryRoot, '.github/actions/start-local-supabase/action.yml'),
  'utf8',
)

/**
 * The shell body only, with the explanatory header stripped.
 *
 * The first draft of this file asserted `toMatch(/exit 1/)` against the whole
 * document. That passed on the COMMENT which says "the final `exit 1` is
 * deliberate" — so replacing the real `exit 1` with `exit 0`, the single
 * mutation that turns a stack which never started into a green tick, did not
 * fail anything. The guard was satisfied by its own prose.
 *
 * Everything below reads the script, not the explanation.
 */
const script = action.slice(action.indexOf('run: |'))
const databaseParity = readFileSync(
  resolve(repositoryRoot, '.github/workflows/database-parity.yml'),
  'utf8',
)
const browserE2E = readFileSync(
  resolve(repositoryRoot, '.github/workflows/browser-e2e.yml'),
  'utf8',
)

const WORKFLOWS = [
  ['database-parity.yml', () => databaseParity],
  ['browser-e2e.yml', () => browserE2E],
] as const

describe('every job starts Supabase through the retrying action', () => {
  it.each(WORKFLOWS)('%s uses the composite action', (_name, source) => {
    expect(source()).toContain('uses: ./.github/actions/start-local-supabase')
  })

  it.each(WORKFLOWS)('%s has no bare supabase start left', (_name, source) => {
    // A bare start is the thing being replaced. One left behind would flake on
    // exactly the schedule the others no longer do, and look identical.
    expect(source()).not.toMatch(/run:\s*supabase start\s*$/m)
  })

  it('covers all three starting jobs', () => {
    const uses = [databaseParity, browserE2E]
      .join('\n')
      .match(/uses: \.\/\.github\/actions\/start-local-supabase/g)
    expect(uses, 'expected local-supabase, migration-transition and authenticated-browser').toHaveLength(3)
  })
})

describe('the retry cannot become a swallow', () => {
  it('fails the job when every attempt fails', () => {
    // The load-bearing line. Without it a stack that never came up reports
    // success and every downstream step runs against nothing.
    expect(script).toMatch(/\n\s+exit 1\s*$/)
    expect(script).toMatch(/did not start after \$\{attempts\} attempts/)

    // Ordering matters as much as presence: the non-zero exit must be the last
    // thing the script does, after the loop has given up. An `exit 1` sitting
    // above the retry loop would fail on the first attempt instead of the last.
    const giveUp = script.indexOf('did not start after')
    const lastExit = script.lastIndexOf('exit 1')
    expect(giveUp).toBeGreaterThan(-1)
    expect(lastExit, 'the final exit does not follow the give-up message').toBeGreaterThan(giveUp)
  })

  it('has exactly one successful exit, on the started path', () => {
    // Two `exit 0`s would mean one of them is on a failure path.
    expect([...script.matchAll(/\bexit 0\b/g)]).toHaveLength(1)
    const success = script.indexOf('exit 0')
    expect(script.slice(0, success)).toMatch(/Local Supabase started on attempt/)
  })

  it('does not mask the final failure with a swallow', () => {
    // `|| true` is legitimate on the intermediate `supabase stop` — there may be
    // nothing to stop — but must never reach the start itself.
    expect(script).not.toMatch(/supabase start[^\n]*\|\|\s*true/)
  })

  it('retries a bounded number of times rather than looping', () => {
    expect(script).toMatch(/attempts=3/)
    expect(script).toMatch(/for attempt in \$\(seq 1 "\$\{attempts\}"\)/)
  })

  it('stops and backs off between attempts, because the port is released late', () => {
    // The observed collision was the CLI racing its own container for 54322.
    // Retrying without stopping first would hit the same port every time.
    expect(script).toMatch(/supabase stop --no-backup \|\| true/)
    expect(script).toMatch(/sleep \$\(\( attempt \* 10 \)\)/)
  })

  it('retries only the start', () => {
    // Nothing else belongs inside the loop. A retried migration or test would
    // turn a real, reproducible failure into an intermittent one.
    for (const command of ['db reset', 'db lint', 'test db', 'playwright']) {
      expect(script, `the retry wraps ${command}`).not.toContain(command)
    }
  })
})

describe('a failed run still says which kind of failure it was', () => {
  it('keeps uploading the pgTAP log on failure', () => {
    // This artifact is the only reliable signal separating "the tests ran and
    // something is wrong" from "the stack never came up". Losing it would make
    // the two indistinguishable.
    expect(databaseParity).toMatch(/name: pgtap-failure-log/)
    expect(databaseParity).toMatch(/if: failure\(\)/)
    expect(databaseParity).toMatch(/path: \/tmp\/pgtap\.log/)
  })

  it('says so in the action when the start is what failed', () => {
    expect(script).toMatch(/not a test failure/)
  })
})
