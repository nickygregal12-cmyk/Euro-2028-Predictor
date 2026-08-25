import { execFileSync, spawnSync } from 'node:child_process'
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

describe('a record cannot award itself machine identity', () => {
  const escalate = () => {
    const forged = record()
    forged.lanes.deployment.identityClass = 'MACHINE'
    forged.lanes.deployment.authority = 'DEPLOYMENT_EXECUTOR'
    forged.lanes.deployment.credential = { kind: 'env', name: 'ANY_TOKEN' }
    forged.lanes.deployment.expectedActor = record().lanes.repository.expectedActor
    return forged
  }

  it('rejects a MACHINE lane naming an actor another lane records as the owner', () => {
    // Before this, exactly this edit passed the offline check — the one CI runs
    // — and was granted DEPLOYMENT_EXECUTOR through the gate that exists to
    // stop authority being self-granted.
    const verdict = evaluateIdentityRecord(escalate())
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.join(' ')).toContain('claims MACHINE but names an actor another lane records as owner-attributed')
  })

  it('rejects lanes declared distinct that name the same actor, without a live run', () => {
    expect(evaluateIdentityRecord(escalate()).problems.join(' '))
      .toContain('declared distinct but name the same actor id')
  })

  it('refuses the escalated authority at the dispatcher entry point too', () => {
    // Blocking the merge is not enough: authorityForLane may be handed a record
    // that never went through a gate.
    expect(authorityForLane(escalate(), 'deployment', 'DEPLOYMENT_EXECUTOR')).toMatchObject({ allowed: false })
    expect(authorityForLane(escalate(), 'repository', 'REPOSITORY_WRITE')).toMatchObject({ allowed: false })
  })

  it('still admits a genuinely distinct machine actor', () => {
    const provisioned = record()
    provisioned.lanes.deployment.identityClass = 'MACHINE'
    provisioned.lanes.deployment.authority = 'DEPLOYMENT_EXECUTOR'
    provisioned.lanes.deployment.credential = { kind: 'env', name: 'GITHUB_DEPLOYMENT_TOKEN' }
    provisioned.lanes.deployment.expectedActor = { login: 'predictor-deployer', id: 999001, type: 'Bot' }

    expect(evaluateIdentityRecord(provisioned).ok).toBe(true)
    expect(authorityForLane(provisioned, 'deployment', 'DEPLOYMENT_EXECUTOR')).toMatchObject({ allowed: true })
  })
})

describe('each lane declares the credential it is proved from', () => {
  it('names a machine-readable source rather than describing one in prose', () => {
    const lanes = record().lanes
    expect(lanes.verification.credential).toEqual({ kind: 'env', name: 'GITHUB_MCP_TOKEN' })
    expect(lanes.repository.credential).toEqual({ kind: 'command', argv: ['gh', 'auth', 'token'] })
    expect(lanes.deployment.credential).toEqual({ kind: 'none' })
  })

  it('rejects a malformed or absent credential declaration', () => {
    for (const credential of [undefined, {}, { kind: 'env' }, { kind: 'env', name: '' },
      { kind: 'command' }, { kind: 'command', argv: [] }, { kind: 'command', argv: [''] }, { kind: 'ambient' }]) {
      const broken = record()
      broken.lanes.repository.credential = credential
      expect(evaluateIdentityRecord(broken).ok, JSON.stringify(credential)).toBe(false)
    }
  })

  it('keeps credential presence and provisioning in step in both directions', () => {
    const orphan = record()
    orphan.lanes.repository.credential = { kind: 'none' }
    expect(evaluateIdentityRecord(orphan).problems.join(' ')).toContain('declares no credential to resolve it from')

    const premature = record()
    premature.lanes.deployment.credential = { kind: 'env', name: 'GITHUB_DEPLOYMENT_TOKEN' }
    expect(evaluateIdentityRecord(premature).problems.join(' ')).toContain('UNPROVISIONED yet declares a credential')
  })

  it('resolves a lane only from its declared source, never an ambient fallback', () => {
    // The regression: with generic fallbacks, both provisioned lanes resolved
    // from one ambient GITHUB_TOKEN on a host with no `gh`, and one credential
    // verified twice was reported as two lanes proved.
    // spawnSync, not execFileSync: an unresolved lane exits non-zero by design,
    // and that exit code is the assertion, not an error to swallow.
    const run = spawnSync('node', ['scripts/check-machine-identity.mjs', '--live'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_MCP_TOKEN: '', GH_TOKEN: 'ghp_ambient', GITHUB_TOKEN: 'ghp_ambient' },
    })
    const output = `${run.stdout}${run.stderr}`
    expect(run.status).not.toBe(0)
    expect(output).not.toContain('ghp_ambient')
    expect(output).toMatch(/UNRESOLVED\s+repository/)
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
    // Declared distinct and recorded as different actors, so the record itself
    // is coherent. What is being tested is drift: both credentials rotated onto
    // one account, which only the live half can see.
    const lane = (login: string, id: number) => ({
      authority: 'READ_ONLY',
      identityClass: 'MACHINE',
      credential: { kind: 'env', name: `TOKEN_${id}` },
      expectedActor: { login, id, type: 'Bot' },
    })
    const shared = { lanes: { a: lane('bot-a', 5), b: lane('bot-b', 6) }, distinctFrom: { a: ['b'] } }
    expect(evaluateIdentityRecord(shared).ok).toBe(true)

    const collided = { readable: true, login: 'bot-a', id: 5, type: 'Bot' }
    // b resolving to a's actor is first a mismatch against b's own record; the
    // point is that it does not pass.
    expect(evaluateObservedIdentity(shared, { a: collided, b: collided }).ok).toBe(false)

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
