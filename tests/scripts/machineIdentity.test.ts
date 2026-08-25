import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  authorityCeiling,
  authorityForLane,
  evaluateIdentityRecord,
  evaluateObservedIdentity,
} from '../../scripts/control-plane/identity.mjs'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const record = () => JSON.parse(read('config/control-plane-identity.json'))

const OWNER = { readable: true, login: 'nickygregal12-cmyk', id: 289518917, type: 'User' }

describe('tracked machine identity record', () => {
  it('is internally coherent', () => {
    expect(evaluateIdentityRecord(record())).toMatchObject({ ok: true, problems: [] })
  })

  it('admits that no distinct machine actor exists yet, rather than implying one does', () => {
    const lanes = record().lanes
    expect(lanes.verification.identityClass).toBe('OWNER_ATTRIBUTED')
    expect(lanes.repository.identityClass).toBe('OWNER_ATTRIBUTED')
    expect(lanes.deployment.identityClass).toBe('UNPROVISIONED')
    expect(lanes.deployment.expectedActor).toBeNull()
    expect(lanes.deployment.authority).toBe('NONE')
  })

  it('names no credential value anywhere, only where a credential is read from', () => {
    const raw = read('config/control-plane-identity.json')
    expect(raw).not.toMatch(/(?:sk-or-|gh[opsu]_|github_pat_|sbp_|phx_)[A-Za-z0-9_-]{8,}/)
  })
})

describe('authority is a function of identity', () => {
  it('ceilings each identity class', () => {
    expect(authorityCeiling('UNPROVISIONED')).toBe('NONE')
    expect(authorityCeiling('OWNER_ATTRIBUTED')).toBe('REPOSITORY_WRITE')
    expect(authorityCeiling('MACHINE')).toBe('DEPLOYMENT_EXECUTOR')
    expect(authorityCeiling('SOMETHING_ELSE')).toBeNull()
  })

  it('refuses deployment authority to the owner-attributed lanes that exist today', () => {
    const tracked = record()
    expect(authorityForLane(tracked, 'repository', 'REPOSITORY_WRITE')).toMatchObject({ allowed: true })
    expect(authorityForLane(tracked, 'verification', 'READ_ONLY')).toMatchObject({ allowed: true })

    for (const lane of ['verification', 'repository', 'deployment']) {
      expect(authorityForLane(tracked, lane, 'DEPLOYMENT_EXECUTOR').allowed, lane).toBe(false)
    }
    expect(authorityForLane(tracked, 'verification', 'REPOSITORY_WRITE').allowed).toBe(false)
    expect(authorityForLane(tracked, 'deployment', 'READ_ONLY').allowed).toBe(false)
    expect(authorityForLane(tracked, 'nonexistent', 'READ_ONLY').allowed).toBe(false)
  })

  it('re-derives the ceiling rather than trusting an edited record', () => {
    // The attack this closes: raise the number in the file and hope the
    // dispatcher reads it. The class still says who the actor is.
    const forged = record()
    forged.lanes.repository.authority = 'DEPLOYMENT_EXECUTOR'

    expect(evaluateIdentityRecord(forged).ok).toBe(false)
    expect(evaluateIdentityRecord(forged).problems.join(' ')).toContain('ceilings at REPOSITORY_WRITE')
    expect(authorityForLane(forged, 'repository', 'DEPLOYMENT_EXECUTOR').allowed).toBe(false)
  })

  it('rejects unknown classes and authorities instead of ignoring them', () => {
    const unknownClass = record()
    unknownClass.lanes.repository.identityClass = 'TRUSTED'
    expect(evaluateIdentityRecord(unknownClass).ok).toBe(false)

    const unknownAuthority = record()
    unknownAuthority.lanes.repository.authority = 'ADMIN'
    expect(evaluateIdentityRecord(unknownAuthority).ok).toBe(false)
  })

  it('fails closed on a record it cannot read at all', () => {
    for (const bad of [null, undefined, {}, { lanes: null }, 'lanes']) {
      expect(evaluateIdentityRecord(bad as never).ok, JSON.stringify(bad)).toBe(false)
    }
    expect(evaluateIdentityRecord({ lanes: {} }).ok).toBe(false)
  })

  it('requires a provisioned lane to name an actor and an unprovisioned lane not to', () => {
    const orphan = record()
    orphan.lanes.repository.expectedActor = null
    expect(evaluateIdentityRecord(orphan).problems.join(' ')).toContain('no expected actor')

    const premature = record()
    premature.lanes.deployment.expectedActor = { login: 'deployer', id: 1, type: 'Bot' }
    expect(evaluateIdentityRecord(premature).problems.join(' ')).toContain('UNPROVISIONED yet names an expected actor')
  })
})

describe('observed identity', () => {
  const proved = { verification: OWNER, repository: OWNER, deployment: { readable: false } }

  it('proves the lanes that resolve to exactly the recorded actor', () => {
    expect(evaluateObservedIdentity(record(), proved)).toMatchObject({ ok: true, problems: [] })
  })

  it('treats an unresolved provisioned lane as unproved, never as absent', () => {
    const verdict = evaluateObservedIdentity(record(), { ...proved, repository: { readable: false } })
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.join(' ')).toContain('an unproved identity is not a proved one')
    expect(verdict.lanes.find((lane) => lane.name === 'repository')?.state).toBe('UNRESOLVED')
  })

  it('rejects a lane whose credential was rotated to another account', () => {
    const verdict = evaluateObservedIdentity(record(), {
      ...proved,
      repository: { readable: true, login: 'someone-else', id: 42, type: 'User' },
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.lanes.find((lane) => lane.name === 'repository')?.state).toBe('MISMATCH')
  })

  it('rejects an unprovisioned lane that has quietly acquired a credential', () => {
    const verdict = evaluateObservedIdentity(record(), {
      ...proved,
      deployment: { readable: true, login: 'deploy-bot', id: 7, type: 'Bot' },
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.join(' ')).toContain("recorded UNPROVISIONED but resolved to deploy-bot")
    expect(verdict.lanes.find((lane) => lane.name === 'deployment')?.state).toBe('UNEXPECTED_CREDENTIAL')
  })

  it('enforces distinctness only once both lanes actually resolved', () => {
    const shared = {
      lanes: {
        a: { authority: 'READ_ONLY', identityClass: 'MACHINE', expectedActor: { login: 'bot', id: 5, type: 'Bot' } },
        b: { authority: 'READ_ONLY', identityClass: 'MACHINE', expectedActor: { login: 'bot', id: 5, type: 'Bot' } },
      },
      distinctFrom: { a: ['b'] },
    }
    const both = { readable: true, login: 'bot', id: 5, type: 'Bot' }
    expect(evaluateObservedIdentity(shared, { a: both, b: both }).problems.join(' '))
      .toContain('must be distinct actors')

    // Two lanes that both failed to resolve are not thereby distinct.
    const neither = evaluateObservedIdentity(shared, { a: { readable: false }, b: { readable: false } })
    expect(neither.problems.join(' ')).not.toContain('must be distinct actors')
    expect(neither.ok).toBe(false)
  })

  it('refuses to evaluate observations against an incoherent record', () => {
    const forged = record()
    forged.lanes.repository.authority = 'DEPLOYMENT_EXECUTOR'
    expect(evaluateObservedIdentity(forged, proved).ok).toBe(false)
  })
})

describe('check-machine-identity command', () => {
  it('reports the record without resolving actors or printing a credential', () => {
    const output = execFileSync('node', ['scripts/check-machine-identity.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_TOKEN: 'ghp_must_never_be_printed_0000000000' },
    })
    expect(output).toContain('OWNER_ATTRIBUTED')
    expect(output).toContain('UNPROVISIONED')
    expect(output).toContain('Re-run with --live')
    expect(output).not.toContain('ghp_must_never_be_printed_0000000000')
  })
})
