import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  deriveProductionHostedExpectations,
  formatGithubEnv,
} from '../../scripts/production-hosted-contract-expectations.mjs'

function fixture(record: Record<string, unknown>, migrations: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'production-hosted-contract-'))
  mkdirSync(join(root, 'config'), { recursive: true })
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true })
  writeFileSync(
    join(root, 'config', 'production-hosted-contract.json'),
    JSON.stringify(record),
  )
  for (const migration of migrations) {
    writeFileSync(join(root, 'supabase', 'migrations', migration), '-- fixture\n')
  }
  return root
}

const record = {
  projectRef: 'production-ref',
  requiredMigrationCount: 2,
  latestMigrationVersion: '20260102000000',
  latestMigrationName: 'second',
  promotionAuthorised: false,
}

const migrations = [
  '20260101000000_first.sql',
  '20260102000000_second.sql',
  '20260103000000_repository_only.sql',
]

describe('production hosted contract expectations', () => {
  it('derives the hosted boundary rather than the repository tip', () => {
    const expectations = deriveProductionHostedExpectations({
      root: fixture(record, migrations),
    })

    expect(expectations).toEqual({
      projectRef: 'production-ref',
      migrationCount: 2,
      latestMigrationVersion: '20260102000000',
      latestMigrationName: 'second',
    })
    expect(formatGithubEnv(expectations)).toContain('EXPECTED_MIGRATION_COUNT=2')
  })

  it('fails when the recorded migration name does not match the canonical chain', () => {
    expect(() =>
      deriveProductionHostedExpectations({
        root: fixture({ ...record, latestMigrationName: 'wrong' }, migrations),
      }),
    ).toThrow(/does not match the canonical migration/)
  })

  it('fails when the hosted record claims more migrations than the repository contains', () => {
    expect(() =>
      deriveProductionHostedExpectations({
        root: fixture({ ...record, requiredMigrationCount: 4 }, migrations),
      }),
    ).toThrow(/repository contains only 3/)
  })

  it('refuses a record that implies promotion is authorised', () => {
    expect(() =>
      deriveProductionHostedExpectations({
        root: fixture({ ...record, promotionAuthorised: true }, migrations),
      }),
    ).toThrow(/must not imply production promotion is authorised/)
  })
})
