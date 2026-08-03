import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ADR 0024 gives additive development migrations a fast lane. A fast lane is a
 * reduction in ceremony, and the risk in reducing ceremony is that the
 * reduction quietly widens — to destructive migrations, or to production.
 *
 * These assertions pin the boundaries the lane is only safe inside. They read
 * the workflow rather than trusting its name.
 */

const root = process.cwd()
const workflow = readFileSync(
  resolve(root, '.github/workflows/development-fast-lane-rollout.yml'),
  'utf8',
)
const checker = readFileSync(
  resolve(root, 'scripts/check-migration-additive.mjs'),
  'utf8',
)
const guarded = readFileSync(
  resolve(root, '.github/workflows/stage-c1-development-rollout.yml'),
  'utf8',
)

const DEVELOPMENT_REF = 'iouzoutneyjpugbbtdem'
const PRODUCTION_REF = 'vkfnsqdyhvtwyqkisxhk'

describe('the fast lane cannot reach production', () => {
  it('refuses the production project ref by name', () => {
    expect(workflow).toContain(`FORBIDDEN_PRODUCTION_REF: ${PRODUCTION_REF}`)
    expect(workflow).toContain('production has no fast lane')
  })

  it('accepts only the development project ref', () => {
    expect(workflow).toContain(`EXPECTED_PROJECT_REF: ${DEVELOPMENT_REF}`)
    expect(workflow).toMatch(/only development project .* is permitted/)
  })

  it('checks the secret itself resolves to development, not just the typed input', () => {
    // The dispatcher types a ref, but the secret is what the push actually
    // uses. A correct input with a misconfigured secret would otherwise apply
    // to whatever the secret points at.
    expect(workflow).toContain('the development secret resolves to the production project')
    expect(workflow).toContain('the development secret names neither known project')
  })

  it('never references a production secret', () => {
    expect(workflow).not.toMatch(/SUPABASE_PROD|PRODUCTION_DB_URL/)
  })
})

describe('the fast lane admits only additive migrations', () => {
  it('reads the pending migrations rather than trusting the dispatcher', () => {
    expect(workflow).toContain('supabase migration list')
    expect(workflow).toMatch(/git ls-files "supabase\/migrations\//)
  })

  it('delegates the additive decision to the tested checker', () => {
    // The decision used to be an inline grep over the whole migration file,
    // which refused contract 66 over a `delete from` inside the body of an RPC
    // the migration merely defines. It now lives in a script with unit tests
    // covering both directions of failure.
    expect(workflow).toContain('node scripts/check-migration-additive.mjs')
    expect(workflow).not.toMatch(/grep -Eiq .*drop\[\[:space:\]\]/)
  })

  it('refuses destructive statements and names the workflow that handles them', () => {
    // The vocabulary moved into the checker with the decision; assert it there
    // rather than pretending the workflow still carries it.
    for (const destructive of ['drop', 'truncate', 'delete']) {
      expect(checker.toLowerCase()).toContain(destructive)
    }
    expect(checker).toContain('Destructive migrations do not use the fast lane.')
    expect(checker).toContain('stage-c1-development-rollout.yml')
  })

  it('still snapshots before applying, as ADR 0024 requires even here', () => {
    expect(workflow).toContain('supabase db dump')
    expect(workflow).toMatch(/pre-apply/)
  })

  it('applies only after the additive proof and snapshot steps', () => {
    const proof = workflow.indexOf('prove the pending migrations are additive')
    const snapshot = workflow.indexOf('lightweight pre-apply snapshot')
    const apply = workflow.indexOf('Apply the pending migrations')

    expect(proof).toBeGreaterThan(-1)
    expect(snapshot).toBeGreaterThan(proof)
    expect(apply).toBeGreaterThan(snapshot)
  })
})

describe('the fast lane inherits the dispatch guards it did not relax', () => {
  it.each([
    ['runs only from main', 'refs/heads/main'],
    ['requires exact origin/main', 'is not exact origin/main'],
    ['requires a clean checkout', 'checkout is not clean'],
  ])('%s', (_label, marker) => {
    expect(workflow).toContain(marker)
    // The same guard exists in the full process; the fast lane drops ceremony,
    // not the checks that stop it running against the wrong tree.
    expect(guarded).toContain(marker)
  })

  it('requires an explicit confirmation phrase', () => {
    expect(workflow).toContain('APPLY-DEVELOPMENT-FAST-LANE')
    expect(workflow).toContain('confirmation phrase does not match')
  })

  it('is dispatch-only, so no push or schedule can trigger a hosted write', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s{2}(push|pull_request|schedule):/m)
  })
})

describe('the full guarded process is still available', () => {
  it('leaves the Stage C1 rollout workflow in place', () => {
    expect(guarded).toContain('name: Stage C1 development rollout')
    expect(guarded).toContain('BACKUP_AGE_PUBLIC_KEY')
  })
})

describe('it reads the pending versions out of the CLI table correctly', () => {
  /**
   * This parsing was never exercised until a real dispatch, and it was wrong:
   * it printed the human-readable TIME column instead of the version, so the
   * run reported a pending migration of "2026-08-0307:00:00" and then failed
   * to find a committed file for it. No database was touched — the step runs
   * before the snapshot and the apply — but the lane could not carry anything.
   *
   * The awk program is lifted out of the workflow and run against a realistic
   * table, so the assertion is about the code that actually ships.
   */
  const program = /awk -F'\|' '([\s\S]*?)' \/tmp\/migration-list\.txt/.exec(workflow)?.[1]

  function pendingFrom(table: string): string[] {
    expect(program, 'could not extract the awk program from the workflow').toBeTruthy()
    return execFileSync('awk', ['-F|', String(program)], { input: table, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  }

  const table = [
    '',
    '  LOCAL          | REMOTE         | TIME (UTC)          ',
    ' ----------------|----------------|---------------------',
    '  20260729154931 | 20260729154931 | 2026-07-29 15:49:31 ',
    '  20260730235602 | 20260730235602 | 2026-07-30 23:56:02 ',
    '  20260803070000 |                | 2026-08-03 07:00:00 ',
    '',
  ].join('\n')

  it('returns the 14-digit version, not the formatted time', () => {
    expect(pendingFrom(table)).toEqual(['20260803070000'])
  })

  it('names a file that exists in the repository', () => {
    // The failure mode was a version string no migration could match, so this
    // closes the loop the workflow itself closes.
    const [version] = pendingFrom(table)
    const files = execFileSync('git', ['ls-files', `supabase/migrations/${version}_*.sql`], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)

    expect(files).toHaveLength(1)
  })

  it('reports nothing pending when every migration is applied', () => {
    const applied = [
      '  LOCAL          | REMOTE         | TIME (UTC)          ',
      ' ----------------|----------------|---------------------',
      '  20260729154931 | 20260729154931 | 2026-07-29 15:49:31 ',
    ].join('\n')

    expect(pendingFrom(applied)).toEqual([])
  })

  it('ignores the header and rule rows rather than treating them as versions', () => {
    const headerOnly = [
      '  LOCAL          | REMOTE         | TIME (UTC)          ',
      ' ----------------|----------------|---------------------',
    ].join('\n')

    expect(pendingFrom(headerOnly)).toEqual([])
  })
})
