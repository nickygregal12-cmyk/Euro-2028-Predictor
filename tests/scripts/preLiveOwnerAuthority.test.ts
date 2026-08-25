import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ALWAYS_DENIED,
  decideOperation,
  deniedOperations,
  evaluateAuthorityPolicy,
} from '../../scripts/control-plane/authority.mjs'

const root = process.cwd()
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const policy = () => read('config/pre-live-owner-authority.json')
const identity = () => read('config/control-plane-identity.json')

describe('the tracked PRE_LIVE_OWNER policy', () => {
  it('is coherent and acts as a recorded identity lane', () => {
    expect(evaluateAuthorityPolicy(policy())).toMatchObject({ ok: true, problems: [] })
    expect(Object.keys(identity().lanes)).toContain(policy().lane)
  })

  it('grants the bounded repository operations and nothing beyond them', () => {
    expect(Object.keys(policy().operations).sort()).toEqual([
      'branch.create', 'branch.push', 'ci.read', 'commit.create',
      'pr.create', 'pr.update', 'repository.read', 'review.read',
    ])
  })

  it('permits every granted operation to the lane that actually exists today', () => {
    for (const operation of Object.keys(policy().operations)) {
      expect(decideOperation(policy(), identity(), operation), operation).toMatchObject({ allowed: true })
    }
  })
})

describe('the refusals live in code, not in the record', () => {
  it('never grants direct push, protection, ruleset, merge, Production or secrets', () => {
    for (const operation of [
      'main.push', 'branch.force-push', 'protection.update', 'ruleset.update',
      'pr.merge', 'production.mutate', 'secret.mutate', 'hosted.write', 'authority.expand',
    ]) {
      expect(Object.hasOwn(ALWAYS_DENIED, operation), operation).toBe(true)
      expect(decideOperation(policy(), identity(), operation), operation).toMatchObject({ allowed: false })
    }
  })

  it('cannot have a code-owned refusal removed or reworded by editing the record', () => {
    const forged = policy()
    forged.additionalDenied = { 'ruleset.update': 'actually this is fine now' }
    expect(deniedOperations(forged)['ruleset.update']).toBe(ALWAYS_DENIED['ruleset.update'])
    expect(decideOperation(forged, identity(), 'ruleset.update')).toMatchObject({ allowed: false })

    const dropped = policy()
    delete dropped.additionalDenied
    expect(decideOperation(dropped, identity(), 'main.push')).toMatchObject({ allowed: false })
  })

  it('refuses a policy that tries to grant a permanently denied operation', () => {
    const forged = policy()
    forged.operations['ruleset.update'] = { requires: 'REPOSITORY_WRITE' }
    expect(evaluateAuthorityPolicy(forged).ok).toBe(false)
    expect(evaluateAuthorityPolicy(forged).problems.join(' ')).toContain('permanently denied')
    expect(decideOperation(forged, identity(), 'ruleset.update')).toMatchObject({ allowed: false })
  })

  it('refuses a denied operation before consulting the identity at all', () => {
    // Order is the design: no identity, however privileged or however recorded,
    // reaches past a permanent refusal.
    for (const record of [null, undefined, {}, { lanes: { repository: {
      authority: 'DEPLOYMENT_EXECUTOR', identityClass: 'MACHINE',
      credential: { kind: 'env', name: 'X' },
      expectedActor: { login: 'superuser', id: 1, type: 'Bot' },
    } } }]) {
      expect(decideOperation(policy(), record, 'production.mutate'), JSON.stringify(record))
        .toMatchObject({ allowed: false })
    }
  })
})

describe('an operation absent from the allowlist is denied', () => {
  it('denies anything the policy does not name', () => {
    for (const operation of [
      'branch.delete', 'workflow.dispatch', 'release.publish', 'gh.api', '', 'pr.createOrWhatever',
    ]) {
      const verdict = decideOperation(policy(), identity(), operation)
      expect(verdict.allowed, operation).toBe(false)
      expect(verdict.reason).toContain('not an operation this policy grants')
    }
  })

  it('fails closed on an unreadable or empty policy', () => {
    for (const broken of [null, undefined, 'policy', {}, { mode: 'PRE_LIVE_OWNER', lane: 'repository', operations: {} }]) {
      expect(evaluateAuthorityPolicy(broken as never).ok, JSON.stringify(broken)).toBe(false)
      expect(decideOperation(broken, identity(), 'branch.push').allowed).toBe(false)
    }
  })

  it('keeps deployment authority out of scope for this mode entirely', () => {
    const overreaching = policy()
    overreaching.operations['migration.apply'] = { requires: 'DEPLOYMENT_EXECUTOR' }
    expect(evaluateAuthorityPolicy(overreaching).ok).toBe(false)
    expect(evaluateAuthorityPolicy(overreaching).problems.join(' ')).toContain('out-of-scope authority')
  })

  it('denies every operation when the identity record is incoherent', () => {
    const brokenIdentity = identity()
    brokenIdentity.lanes.repository.authority = 'DEPLOYMENT_EXECUTOR'
    expect(decideOperation(policy(), brokenIdentity, 'branch.push')).toMatchObject({ allowed: false })
  })

  it('denies write operations when the acting lane holds only read authority', () => {
    const readOnly = identity()
    readOnly.lanes.repository.authority = 'READ_ONLY'
    expect(decideOperation(policy(), readOnly, 'branch.push')).toMatchObject({ allowed: false })
    expect(decideOperation(policy(), readOnly, 'ci.read')).toMatchObject({ allowed: true })
  })
})

describe('the owner wrappers', () => {
  function run(script: string, args: string[], branch: string, upstream?: string) {
    const home = mkdtempSync(resolve(tmpdir(), 'predictor-owner-wrapper-'))
    const bin = resolve(home, 'bin')
    mkdirSync(bin, { recursive: true })
    const log = resolve(home, 'calls.log')

    // The fakes read WRAPPER_TEST_LOG; the production scripts never mention it.
    writeFileSync(resolve(bin, 'git'), `#!/usr/bin/env bash
case "$1 $2" in
  "branch --show-current") printf '%s\\n' "$FAKE_BRANCH"; exit 0 ;;
  "rev-parse --show-toplevel") printf '%s\\n' "${root}"; exit 0 ;;
  "config --get") [[ -n "$FAKE_REMOTE" ]] && printf '%s\\n' "$FAKE_REMOTE"; exit 0 ;;
esac
{ printf 'git'; printf ' <%s>' "$@"; printf '\\n'; } >> "$WRAPPER_TEST_LOG"
`, { mode: 0o755 })
    writeFileSync(resolve(bin, 'gh'), `#!/usr/bin/env bash
{ printf 'gh'; printf ' <%s>' "$@"; printf '\\n'; } >> "$WRAPPER_TEST_LOG"
`, { mode: 0o755 })

    const result = spawnSync('bash', [script, ...args], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_BRANCH: branch,
        FAKE_REMOTE: upstream ?? '',
        WRAPPER_TEST_LOG: log,
      },
      encoding: 'utf8',
    })
    return { ...result, calls: existsSync(log) ? readFileSync(log, 'utf8') : '' }
  }

  const PUSH = 'scripts/agent-tools/owner-task-push.sh'
  const PR = 'scripts/agent-tools/owner-pr.sh'

  it('pushes only the branch it is standing on, to its own name', () => {
    const ok = run(PUSH, [], 'feat/owner-safe')
    expect(ok.status).toBe(0)
    expect(ok.calls).toBe('git <push> <--set-upstream> <origin> <feat/owner-safe>\n')
  })

  it('refuses protected, detached, non-namespaced branches and any argument', () => {
    for (const [args, branch] of [[[], 'main'], [[], 'master'], [[], ''], [[], 'scratch'],
      [['--force'], 'feat/x'], [['origin', 'main'], 'feat/x']] as Array<[string[], string]>) {
      const result = run(PUSH, args, branch)
      expect(result.status, `${branch} ${args.join(' ')}`).not.toBe(0)
      expect(result.calls).toBe('')
    }
  })

  it('refuses a non-origin upstream', () => {
    const result = run(PUSH, [], 'feat/owner-safe', 'upstream')
    expect(result.status).not.toBe(0)
    expect(result.calls).toBe('')
  })

  it('fixes the pull-request base and head rather than accepting them', () => {
    const created = run(PR, ['create', '--title', 'Safe', '--body', 'Body'], 'feat/owner-safe')
    expect(created.status).toBe(0)
    expect(created.calls).toBe(
      'gh <pr> <create> <--base> <main> <--head> <feat/owner-safe> <--title> <Safe> <--body> <Body>\n',
    )

    const updated = run(PR, ['update', '--title', 'Updated'], 'feat/owner-safe')
    expect(updated.status).toBe(0)
    expect(updated.calls).toBe('gh <pr> <edit> <feat/owner-safe> <--title> <Updated>\n')
  })

  it('forwards only allowlisted options, so an unnamed one is inert', () => {
    // The #1041 blocklist rejected --head/--base/--body-file by name. These are
    // refused for the opposite reason: they are not on the list.
    for (const args of [
      ['create', '--head', 'main'], ['create', '-H', 'main'], ['create', '--base', 'other'],
      ['create', '--body-file', '.env'], ['create', '--repo', 'someone/else'], ['create', '--web'],
      ['create', '--fill'], ['create', '--template', 'x'], ['create', 'positional'],
      ['create', '--title'], ['delete'],
    ]) {
      const result = run(PR, args, 'feat/owner-safe')
      expect(result.status, args.join(' ')).not.toBe(0)
      expect(result.calls, args.join(' ')).toBe('')
    }
  })

  it('accepts the options it does name', () => {
    const result = run(PR, ['create', '--title', 'T', '--body', 'B', '--label', 'l', '--draft'], 'feat/x')
    expect(result.status).toBe(0)
    expect(result.calls).toContain('<--draft>')
  })

  it('carries no test-only branch in the production scripts', () => {
    // #1041's wrappers ended with `if [ -n "${FAKE_LOG:-}" ]` — production code
    // taking a branch from a variable that exists only for a test.
    for (const script of [PUSH, PR]) {
      const source = readFileSync(resolve(root, script), 'utf8')
      const code = source.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n')
      expect(code, script).not.toContain('FAKE_LOG')
      expect(code, script).not.toContain('WRAPPER_TEST_LOG')
    }
  })
})
