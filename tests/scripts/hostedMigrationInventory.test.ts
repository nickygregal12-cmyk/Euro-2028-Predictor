import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `scripts/check-hosted-migration-inventory.mjs` compares the three contract
 * records against each other and against the inventory document.
 *
 * The gate this suite exists for is the ORDERING one. ADR 0024 says Production
 * must never be the first hosted environment to see a migration, and until
 * 18 August 2026 nothing checked that: the only comparisons made were against
 * the repository, so the pair could sit at development 189 / production 190 --
 * Production a contract ahead -- and the script reported "aligned". A gate that
 * has never been observed to fail is indistinguishable from no gate, so each
 * assertion below is driven by a fixture built to break exactly one of them.
 */

const SCRIPT = join(process.cwd(), 'scripts/check-hosted-migration-inventory.mjs')

function fixture(options: {
  repository?: number
  development?: number
  production?: number
  promotionAuthorised?: boolean
}): string {
  const repository = options.repository ?? 198
  const development = options.development ?? 190
  const production = options.production ?? 190
  const root = mkdtempSync(join(tmpdir(), 'hosted-inventory-'))

  mkdirSync(join(root, 'config'), { recursive: true })
  mkdirSync(join(root, 'docs/ops'), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })

  writeFileSync(
    join(root, 'config/deployment-contract.json'),
    JSON.stringify({ requiredMigrationCount: repository }),
  )
  writeFileSync(
    join(root, 'config/development-hosted-contract.json'),
    JSON.stringify({ projectRef: 'iouzoutneyjpugbbtdem', requiredMigrationCount: development }),
  )
  writeFileSync(
    join(root, 'config/production-hosted-contract.json'),
    JSON.stringify({
      requiredMigrationCount: production,
      promotionAuthorised: options.promotionAuthorised ?? false,
    }),
  )
  writeFileSync(
    join(root, 'docs/ops/ops-pending-migrations.md'),
    [
      'config/development-hosted-contract.json',
      `| Development Supabase \`iouzoutneyjpugbbtdem\` | **${development}** |`,
      `| Production Supabase | **${production}** |`,
      'historic Netlify project `euro28-predictor-dev` is out of scope',
    ].join('\n'),
  )
  copyFileSync(SCRIPT, join(root, 'scripts/check-hosted-migration-inventory.mjs'))
  return root
}

function run(root: string): { ok: boolean; output: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['scripts/check-hosted-migration-inventory.mjs'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return { ok: true, output: stdout }
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string }
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` }
  }
}

describe('the hosted migration inventory gate', () => {
  it('passes on a coherent set of records', () => {
    // The control. Without it, a check that failed on EVERY fixture would look
    // exactly like a check that catches everything below.
    const result = run(fixture({}))
    expect(result.output).toContain('aligned')
    expect(result.ok).toBe(true)
  })

  it('refuses records where production leads development', () => {
    // The exact pair that stood in this repository and passed: Production one
    // contract ahead of Development.
    const result = run(fixture({ development: 189, production: 190 }))
    expect(result.ok).toBe(false)
    expect(result.output).toContain('Production must not be the first hosted environment')
  })

  it('accepts development level with production, and development ahead of it', () => {
    // Ahead is the normal state between a development rollout and the
    // production promotion that follows it; only BEHIND is the violation.
    expect(run(fixture({ development: 190, production: 190 })).ok).toBe(true)
    expect(run(fixture({ development: 198, production: 190 })).ok).toBe(true)
  })

  it('refuses development leading the repository', () => {
    const result = run(fixture({ repository: 190, development: 198, production: 190 }))
    expect(result.ok).toBe(false)
    expect(result.output).toContain('cannot lead repository contract')
  })

  it('refuses a record that authorises production promotion', () => {
    const result = run(fixture({ promotionAuthorised: true }))
    expect(result.ok).toBe(false)
    expect(result.output).toContain('fail-closed')
  })
})
