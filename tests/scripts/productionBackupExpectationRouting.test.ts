import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { deriveCliExpectations } from '../../scripts/deployment-contract-expectations.mjs'

function writeFixture(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'production-backup-routing-'))
  mkdirSync(resolve(root, 'config'), { recursive: true })
  mkdirSync(resolve(root, 'supabase/migrations'), { recursive: true })

  writeFileSync(
    resolve(root, 'config/deployment-contract.json'),
    JSON.stringify({
      contractVersion: 3,
      requiredMigrationCount: 3,
      requiredRpcSignatures: [],
    }),
  )
  writeFileSync(
    resolve(root, 'config/production-hosted-contract.json'),
    JSON.stringify({
      projectRef: 'production-project',
      requiredMigrationCount: 2,
      latestMigrationVersion: '20260102000000',
      latestMigrationName: 'second',
      promotionAuthorised: false,
    }),
  )

  for (const migration of [
    '20260101000000_first.sql',
    '20260102000000_second.sql',
    '20260103000000_third.sql',
  ]) {
    writeFileSync(resolve(root, 'supabase/migrations', migration), '-- fixture\n')
  }

  return root
}

describe('production backup expectation routing', () => {
  it('uses the hosted Production boundary for the manual backup workflow', () => {
    const { expectations, source } = deriveCliExpectations({
      workflowName: 'Production backup',
      bootstrapProjectRef: 'production-project',
      root: writeFixture(),
    })

    expect(source).toBe('hosted Production contract')
    expect(expectations).toEqual({
      projectRef: 'production-project',
      migrationCount: 2,
      latestMigrationVersion: '20260102000000',
      latestMigrationName: 'second',
    })
  })

  it('refuses a stale workflow bootstrap project ref before a backup can proceed', () => {
    expect(() =>
      deriveCliExpectations({
        workflowName: 'Production backup',
        bootstrapProjectRef: 'stale-production-project',
        root: writeFixture(),
      }),
    ).toThrow(/does not match the hosted Production contract/)
  })

  it('keeps every other production guard on the repository deployment contract', () => {
    const { expectations, source } = deriveCliExpectations({
      workflowName: 'Production smoke',
      bootstrapProjectRef: 'irrelevant-to-this-workflow',
      root: writeFixture(),
    })

    expect(source).toBe('repository deployment contract')
    expect(expectations).toEqual({
      contractVersion: 3,
      migrationCount: 3,
      latestMigrationVersion: '20260103000000',
      latestMigrationName: 'third',
    })
  })
})
