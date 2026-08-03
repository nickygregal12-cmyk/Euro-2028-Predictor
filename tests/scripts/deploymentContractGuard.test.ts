import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(
  process.cwd(),
  'scripts/validate-deployment-contract.mjs',
)
const deploymentContract = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'config/deployment-contract.json'),
    'utf8',
  ),
) as { contractVersion: number }
const currentContract = String(deploymentContract.contractVersion)

function run(overrides: NodeJS.ProcessEnv = {}) {
  return () =>
    execFileSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        NETLIFY: undefined,
        CONTEXT: undefined,
        EURO28_DEPLOYED_DB_CONTRACT: undefined,
        ...overrides,
      },
      encoding: 'utf8',
      stdio: 'pipe',
    })
}

describe('application/database deployment contract guard', () => {
  it('verifies the repository contract in ordinary CI/local builds', () => {
    expect(run()).not.toThrow()
  })

  it.each(['production', 'deploy-preview', 'branch-deploy', 'dev'])(
    'accepts %s when the hosted database contract matches',
    (context) => {
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: context,
          EURO28_DEPLOYED_DB_CONTRACT: currentContract,
        }),
      ).not.toThrow()
    },
  )

  it('rejects production when the hosted database contract is behind', () => {
    // Production is never waved through. This is the carve-out's boundary and
    // the reason the exception is scoped by name rather than by "not production
    // enough" reasoning.
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'production',
        EURO28_DEPLOYED_DB_CONTRACT: '20',
      }),
    ).toThrow()
  })

  it.each(['deploy-preview', 'branch-deploy', 'dev'])(
    'builds %s when the hosted database contract trails, and says what is unavailable',
    (context) => {
      // ADR 0024: a schema-advancing PR cannot reach a matching development
      // database before it merges, so failing this is a circular gate. The
      // build proceeds and reports the limitation.
      const output = run({
        NETLIFY: 'true',
        CONTEXT: context,
        EURO28_DEPLOYED_DB_CONTRACT: '20',
      })
      expect(output).not.toThrow()
      expect(output()).toContain('hosted database preview unavailable')
    },
  )

  it.each(['production', 'deploy-preview', 'branch-deploy', 'dev'])(
    'rejects %s when the hosted database contract is AHEAD of the application',
    (context) => {
      // Ahead is not a pre-rollout state: the target carries migrations this
      // build does not know about. That is a real mismatch in every context,
      // and the non-production allowance must not swallow it.
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: context,
          EURO28_DEPLOYED_DB_CONTRACT: String(deploymentContract.contractVersion + 1),
        }),
      ).toThrow()
    },
  )

  it('rejects Netlify builds without a declared hosted database contract', () => {
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'production',
      }),
    ).toThrow()
  })

  it('rejects non-numeric hosted database contracts', () => {
    expect(
      run({
        NETLIFY: 'true',
        CONTEXT: 'deploy-preview',
        EURO28_DEPLOYED_DB_CONTRACT: 'not-a-number',
      }),
    ).toThrow()
  })
})
