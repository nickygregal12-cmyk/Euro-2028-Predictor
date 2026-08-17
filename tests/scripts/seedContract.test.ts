import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEED_IDENTITIES,
  SEED_REQUIREMENTS,
  SEED_REVIEWED_AT_CONTRACT,
  seedIdentity,
} from '../../e2e/seed-contract'

const deploymentContract = JSON.parse(
  readFileSync(resolve(process.cwd(), 'config/deployment-contract.json'), 'utf8'),
) as { contractVersion: number }

const globalSetupSource = readFileSync(resolve(process.cwd(), 'e2e/global-setup.ts'), 'utf8')

describe('the seed contract tracks the schema', () => {
  it('has been re-verified at or after the current database contract', () => {
    expect(
      SEED_REVIEWED_AT_CONTRACT,
      `the repository is at database contract ${deploymentContract.contractVersion} but the ` +
        `development seed was last verified at ${SEED_REVIEWED_AT_CONTRACT}. A migration ` +
        'may have introduced a new gate on authenticated reads that the seed does not ' +
        'satisfy. Re-verify a seeded user, update e2e/seed-contract.ts, then raise the number.',
    ).toBeGreaterThanOrEqual(deploymentContract.contractVersion)
  })

  it('never claims verification against a contract that does not exist', () => {
    expect(SEED_REVIEWED_AT_CONTRACT).toBeLessThanOrEqual(deploymentContract.contractVersion)
  })

  it('states the contract-66 authenticated requirements explicitly', () => {
    expect(SEED_REQUIREMENTS).toEqual(
      expect.arrayContaining([
        'a confirmed auth account',
        'a profiles row carrying display_name and welcomed_at',
        'an active Original Predictor game membership for the seeded tournament season',
        'an entries row linked to its canonical game availability and membership',
      ]),
    )
  })
})

describe('the declared cast', () => {
  it('provides an administrator and at least two ordinary players', () => {
    const admins = SEED_IDENTITIES.filter((identity) => identity.adminCapabilities.length > 0)
    const players = SEED_IDENTITIES.filter((identity) => identity.adminCapabilities.length === 0)

    expect(admins).toHaveLength(1)
    expect(admins[0]?.key).toBe('admin')
    expect(players.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps identities unique and locally scoped', () => {
    const emails = SEED_IDENTITIES.map((identity) => identity.email)
    expect(new Set(emails).size).toBe(emails.length)
    expect(new Set(SEED_IDENTITIES.map((identity) => identity.key)).size).toBe(
      SEED_IDENTITIES.length,
    )
    for (const email of emails) expect(email.endsWith('@euro28.local')).toBe(true)
  })

  it('preserves the historical admin credentials', () => {
    expect(seedIdentity('admin').email).toBe('e2e@euro28.local')
  })
})

describe('global setup provisions from the contract', () => {
  it('imports and provisions the declared cast', () => {
    expect(globalSetupSource).toMatch(/from '\.\/seed-contract'/)
    expect(globalSetupSource).toMatch(/for \(const identity of SEED_IDENTITIES\)/)
  })

  it('declares no seed email of its own', () => {
    const literals = globalSetupSource.match(/'[^']*@euro28\.local'/g) ?? []
    expect(literals).toEqual([])
  })

  it('selects the Euro tournament explicitly and exercises the ordinary entry path', () => {
    expect(globalSetupSource).toContain(".eq('kind', 'tournament')")
    expect(globalSetupSource).toContain(".eq('name', 'UEFA Euro 2028')")
    expect(globalSetupSource).toContain(".from('entries')")
    expect(globalSetupSource).toContain(
      ".select('id, game_competition_id, game_membership_id')",
    )
    expect(globalSetupSource).not.toContain(".from('game_memberships')")
  })
})
