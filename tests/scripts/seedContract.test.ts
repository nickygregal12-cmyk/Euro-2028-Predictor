import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEED_IDENTITIES,
  SEED_REQUIREMENTS,
  SEED_REVIEWED_AT_CONTRACT,
  seedIdentity,
} from '../../e2e/seed-contract'

/**
 * ADR 0024 requires development to be deterministically reseedable, and this
 * suite is the guard that makes a forgotten seed visible.
 *
 * Contract 66 moved the membership authority while the browser fixtures did
 * not move with it: every authenticated surface rendered empty and 33 specs
 * failed for one cause, discovered only after a full Browser E2E run. The
 * check below turns that into a fast, unmissable CI failure instead.
 */

const deploymentContract = JSON.parse(
  readFileSync(resolve(process.cwd(), 'config/deployment-contract.json'), 'utf8'),
) as { contractVersion: number }

const globalSetupSource = readFileSync(resolve(process.cwd(), 'e2e/global-setup.ts'), 'utf8')

describe('the seed contract tracks the schema', () => {
  it('has been re-verified at or after the current database contract', () => {
    // If this fails, the schema advanced and nobody confirmed a seeded user is
    // still functional on it. Re-verify, extend SEED_REQUIREMENTS and the
    // provisioning that satisfies them, then raise SEED_REVIEWED_AT_CONTRACT.
    // Raising it to silence this failure is the one thing that defeats it.
    expect(
      SEED_REVIEWED_AT_CONTRACT,
      `the repository is at database contract ${deploymentContract.contractVersion} but the ` +
        `development seed was last verified at ${SEED_REVIEWED_AT_CONTRACT}. A migration ` +
        'may have introduced a new gate on authenticated reads that the seed does not ' +
        'satisfy — which is exactly how contract 66 emptied every authenticated surface. ' +
        'Re-verify a seeded user, update e2e/seed-contract.ts, then raise the number.',
    ).toBeGreaterThanOrEqual(deploymentContract.contractVersion)
  })

  it('never claims to have been verified against a contract that does not exist', () => {
    expect(SEED_REVIEWED_AT_CONTRACT).toBeLessThanOrEqual(deploymentContract.contractVersion)
  })

  it('states what a seeded user actually needs', () => {
    expect(SEED_REQUIREMENTS.length).toBeGreaterThan(0)
    for (const requirement of SEED_REQUIREMENTS) {
      expect(requirement.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('the declared cast', () => {
  it('provides an administrator and at least two ordinary players', () => {
    const admins = SEED_IDENTITIES.filter((identity) => identity.adminCapabilities.length > 0)
    const players = SEED_IDENTITIES.filter((identity) => identity.adminCapabilities.length === 0)

    expect(admins).toHaveLength(1)
    expect(admins[0].key).toBe('admin')
    // Two ordinary players, because head-to-head, private-league and
    // membership journeys need a second real account rather than a
    // hand-rolled one per spec.
    expect(players.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps identities unique and locally scoped', () => {
    const emails = SEED_IDENTITIES.map((identity) => identity.email)
    expect(new Set(emails).size).toBe(emails.length)
    expect(new Set(SEED_IDENTITIES.map((identity) => identity.key)).size).toBe(
      SEED_IDENTITIES.length,
    )
    for (const email of emails) {
      // `.local` only: a seed that could address a real mailbox is a seed that
      // can email a real person.
      expect(email.endsWith('@euro28.local')).toBe(true)
    }
  })

  it('preserves the historical admin credentials so existing specs keep resolving', () => {
    expect(seedIdentity('admin').email).toBe('e2e@euro28.local')
  })
})

describe('global setup provisions from the contract', () => {
  it('imports the declared cast rather than hard-coding identities', () => {
    expect(globalSetupSource).toMatch(/from '\.\/seed-contract'/)
    expect(globalSetupSource).toMatch(/for \(const identity of SEED_IDENTITIES\)/)
  })

  it('declares no seed email of its own', () => {
    // Any `@euro28.local` literal in global setup is an identity that escaped
    // the contract, which is how the two drift apart again.
    const literals = globalSetupSource.match(/'[^']*@euro28\.local'/g) ?? []
    expect(literals).toEqual([])
  })
})
