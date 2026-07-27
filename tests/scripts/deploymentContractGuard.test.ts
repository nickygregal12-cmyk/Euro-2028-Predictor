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

const matchingContract = String(deploymentContract.contractVersion)

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
          EURO28_DEPLOYED_DB_CONTRACT: matchingContract,
        }),
      ).not.toThrow()
    },
  )

  it.each(['production', 'deploy-preview', 'branch-deploy', 'dev'])(
    'rejects %s when the hosted database contract is behind',
    (context) => {
      expect(
        run({
          NETLIFY: 'true',
          CONTEXT: context,
          EURO28_DEPLOYED_DB_CONTRACT: String(
            Math.max(0, deploymentContract.contractVersion - 1),
          ),
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