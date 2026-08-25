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
  isTaskBranch,
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
    for (const [operation, granted] of Object.entries<{ requiresTaskBranch?: boolean }>(policy().operations)) {
      const context = granted.requiresTaskBranch ? { branch: 'feat/sample' } : {}
      expect(decideOperation(policy(), identity(), operation, context), operation).toMatchObject({ allowed: true })
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
      expect(decideOperation(broken, identity(), 'branch.push', { branch: 'feat/x' }).allowed).toBe(false)
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
    expect(decideOperation(policy(), brokenIdentity, 'branch.push', { branch: 'feat/x' })).toMatchObject({ allowed: false })
  })

  it('denies write operations when the acting lane holds only read authority', () => {
    const readOnly = identity()
    readOnly.lanes.repository.authority = 'READ_ONLY'
    expect(decideOperation(policy(), readOnly, 'branch.push', { branch: 'feat/x' })).toMatchObject({ allowed: false })
    expect(decideOperation(policy(), readOnly, 'ci.read')).toMatchObject({ allowed: true })
  })
})

describe('declared constraints are checked, not described', () => {
  it('refuses a branch-scoped operation asked with no branch at all', () => {
    // Otherwise every constraint is satisfied by omitting the thing it
    // constrains. The first version of this policy carried the rule as prose
    // that decideOperation never received.
    for (const operation of ['branch.create', 'commit.create', 'branch.push', 'pr.create', 'pr.update']) {
      const verdict = decideOperation(policy(), identity(), operation)
      expect(verdict.allowed, operation).toBe(false)
      expect(verdict.reason).toContain('none was supplied')
    }
  })

  it('refuses protected and bare branch names', () => {
    for (const branch of ['main', 'master', 'HEAD', 'scratch', '', '/leading', 'trailing/',
      '-oops/x', 'a/../b', 'has space/x', null, undefined, 42]) {
      expect(isTaskBranch(branch as never), JSON.stringify(branch)).toBe(false)
      expect(decideOperation(policy(), identity(), 'branch.push', { branch }).allowed, JSON.stringify(branch)).toBe(false)
    }
  })

  it('accepts a namespaced task branch', () => {
    for (const branch of ['feat/x', 'fix/a-b', 'claude/predictor-control-plane-continue-0sm1nn']) {
      expect(isTaskBranch(branch), branch).toBe(true)
      expect(decideOperation(policy(), identity(), 'branch.push', { branch }).allowed, branch).toBe(true)
    }
  })

  it('checks the branch before the identity, so a malformed request fails the same either way', () => {
    const privileged = identity()
    privileged.lanes.repository.authority = 'REPOSITORY_WRITE'
    expect(decideOperation(privileged, identity(), 'branch.push', { branch: 'main' }).allowed).toBe(false)
  })
})

describe('the owner wrappers', () => {
  function run(script: string, args: string[], branch: string, options: {
    upstream?: string
    pushUrls?: string[]
    rewrite?: boolean
    ghRepo?: string
  } = {}) {
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
if [[ "$1 $2" == "remote get-url" ]]; then printf '%s\\n' $FAKE_PUSH_URLS; exit 0; fi
if [[ "$1 $2" == "config --get-regexp" ]]; then [[ "$FAKE_REWRITE" == yes ]]; exit; fi
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
        FAKE_REMOTE: options.upstream ?? '',
        FAKE_PUSH_URLS: (options.pushUrls ?? ['https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git']).join(' '),
        FAKE_REWRITE: options.rewrite ? 'yes' : 'no',
        ...(options.ghRepo ? { GH_REPO: options.ghRepo } : {}),
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
    const result = run(PUSH, [], 'feat/owner-safe', { upstream: 'upstream' })
    expect(result.status).not.toBe(0)
    expect(result.calls).toBe('')
  })

  it('fixes the pull-request base and head rather than accepting them', () => {
    const created = run(PR, ['create', '--title', 'Safe', '--body', 'Body'], 'feat/owner-safe')
    expect(created.status).toBe(0)
    expect(created.calls).toBe(
      'gh <pr> <create> <--repo> <nickygregal12-cmyk/Euro-2028-Predictor> <--base> <main>'
      + ' <--head> <feat/owner-safe> <--title> <Safe> <--body> <Body>\n',
    )

    const updated = run(PR, ['update', '--title', 'Updated'], 'feat/owner-safe')
    expect(updated.status).toBe(0)
    expect(updated.calls).toBe(
      'gh <pr> <edit> <feat/owner-safe> <--repo> <nickygregal12-cmyk/Euro-2028-Predictor> <--title> <Updated>\n')
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

  it('refuses when origin points somewhere other than the tracked repository', () => {
    // The ref was pinned and the repository was not: `git push origin` resolves
    // through remote.origin.pushurl, which one line of git config can set.
    for (const pushUrls of [
      ['https://github.com/attacker/evil.git'],
      ['git@github.com:attacker/evil.git'],
      ['https://evil.example/nickygregal12-cmyk/Euro-2028-Predictor.git'],
      ['https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git', 'https://github.com/attacker/evil.git'],
      [],
    ]) {
      const result = run(PUSH, [], 'feat/owner-safe', { pushUrls })
      expect(result.status, JSON.stringify(pushUrls)).not.toBe(0)
      expect(result.calls, JSON.stringify(pushUrls)).toBe('')
    }
  })

  it('accepts the tracked repository over either transport', () => {
    for (const url of [
      'https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git',
      'https://github.com/nickygregal12-cmyk/Euro-2028-Predictor',
      'git@github.com:nickygregal12-cmyk/Euro-2028-Predictor.git',
    ]) {
      expect(run(PUSH, [], 'feat/owner-safe', { pushUrls: [url] }).status, url).toBe(0)
    }
  })

  it('sees through URL rewrites, which is why there is no separate refusal for them', () => {
    // The wrapper used to refuse outright when any url.*.insteadOf existed.
    // That broke the legitimate SSH-to-HTTPS rewrite that proxied and CI
    // checkouts normally configure — it stopped the wrapper pushing at all in
    // such an environment — while adding nothing, because the URL check already
    // sees the rewritten target.
    //
    // This pins that assumption with real git rather than a fake. If git ever
    // stopped expanding rewrites here, the removal above would no longer be
    // safe, and this fails rather than the boundary quietly opening.
    // The configured remote is a parameter, not a constant. An earlier version
    // fixed it at HTTPS and then asserted that an `insteadOf git@github.com:`
    // rule produced HTTPS — which it did, by never matching. That assertion held
    // whether or not the rule existed, so it demonstrated nothing while reading
    // as the proof that licensed removing a security guard.
    const HTTPS = 'https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git'
    const SSH = 'git@github.com:nickygregal12-cmyk/Euro-2028-Predictor.git'

    const expandedPushUrl = (remote: string, configure: string[][]) => {
      const dir = mkdtempSync(resolve(tmpdir(), 'predictor-rewrite-'))
      // Every command is checked. A silently failing `git config` would leave
      // the rule unset and let the case pass for the wrong reason, which is the
      // same failure in a different place.
      // Isolated from the host's own git configuration. The first version of
      // this inherited it and read whatever rewrites the machine happened to
      // have — which on the container that wrote it already carried the very
      // SSH-to-HTTPS rule under test, so the control case failed and would have
      // behaved differently again in CI. A test of rewrite handling cannot
      // depend on ambient rewrites.
      //
      // Clearing GIT_CONFIG_GLOBAL/SYSTEM is not enough: git also reads config
      // from GIT_CONFIG_COUNT plus GIT_CONFIG_KEY_n/VALUE_n, and that is how
      // this rewrite reaches git in a proxied environment — which is exactly
      // the configuration that made the removed guard fire. Setting the count
      // to zero is what actually silences it.
      const isolated = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_CONFIG_')),
      )
      isolated.GIT_CONFIG_GLOBAL = '/dev/null'
      isolated.GIT_CONFIG_SYSTEM = '/dev/null'
      isolated.GIT_CONFIG_COUNT = '0'
      const git = (...args: string[]) => {
        const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: isolated })
        if (result.status !== 0) {
          throw new Error(`git ${args.join(' ')} failed (${result.status}): ${result.stderr}`)
        }
        return result.stdout.trim()
      }
      git('init', '-q', '.')
      git('remote', 'add', 'origin', remote)
      for (const args of configure) git('config', ...args)
      return git('remote', 'get-url', '--push', '--all', 'origin')
    }

    // The benign case starts from SSH, so the rewrite has something to match and
    // the HTTPS result is evidence of expansion rather than of the input.
    expect(expandedPushUrl(SSH, [])).toBe(SSH)
    expect(expandedPushUrl(SSH, [['url.https://github.com/.insteadOf', 'git@github.com:']])).toBe(HTTPS)

    // A rewrite retargeting github.com is visible as the other host.
    expect(expandedPushUrl(HTTPS, [['url.https://evil.example/.insteadOf', 'https://github.com/']]))
      .toContain('evil.example')
    // ...and so is the push-specific form, which only affects pushes.
    expect(expandedPushUrl(HTTPS, [['url.https://evil.example/.pushInsteadOf', 'https://github.com/']]))
      .toContain('evil.example')
  })

  it('still refuses a rewritten target, because the expanded URL is what is checked', () => {
    // The expansion above means an attacker rewrite arrives here as a wrong URL.
    const result = run(PUSH, [], 'feat/owner-safe', {
      pushUrls: ['https://evil.example/nickygregal12-cmyk/Euro-2028-Predictor.git'],
    })
    expect(result.status).not.toBe(0)
    expect(result.calls).toBe('')
  })

  it('pins the pull-request repository against an inherited GH_REPO', () => {
    // Excluding --repo from the caller's arguments was not enough: gh reads
    // GH_REPO from the environment, so an inherited value redirected create and
    // edit while the wrapper reported it had fixed base and head.
    const created = run(PR, ['create', '--title', 'T'], 'feat/owner-safe', { ghRepo: 'attacker/evil' })
    expect(created.status).toBe(0)
    expect(created.calls).toContain('<--repo> <nickygregal12-cmyk/Euro-2028-Predictor>')
    expect(created.calls).not.toContain('attacker/evil')

    const updated = run(PR, ['update', '--title', 'T'], 'feat/owner-safe', { ghRepo: 'attacker/evil' })
    expect(updated.calls).toContain('<--repo> <nickygregal12-cmyk/Euro-2028-Predictor>')
  })

  it('enforces the same boundaries for commits', () => {
    const COMMIT = 'scripts/agent-tools/owner-commit.sh'
    expect(run(COMMIT, ['--message', 'safe'], 'feat/owner-safe').status).toBe(0)
    for (const [args, branch] of [[['--message', 'x'], 'main'], [['--message', 'x'], ''],
      [['--amend'], 'feat/x'], [['--author', 'x'], 'feat/x'], [[], 'feat/x']] as Array<[string[], string]>) {
      const result = run(COMMIT, args, branch)
      expect(result.status, `${branch} ${args.join(' ')}`).not.toBe(0)
      expect(result.calls).toBe('')
    }
  })

  it('works from a repository subdirectory', () => {
    // The authority CLI read its config relative to the caller's cwd, so every
    // authorised push failed with ENOENT from anywhere but the root.
    const result = spawnSync('bash', [resolve(root, PUSH)], {
      cwd: resolve(root, 'src'),
      env: { ...process.env, PATH: process.env.PATH },
      encoding: 'utf8',
    })
    expect(`${result.stdout}${result.stderr}`).not.toContain('ENOENT')
  })

  it('creates only task branches, through the policy', () => {
    const BRANCH = 'scripts/agent-tools/owner-branch.sh'
    const ok = run(BRANCH, ['feat/new-task'], 'feat/current')
    expect(ok.status).toBe(0)
    expect(ok.calls).toBe('git <switch> <--create> <feat/new-task>\n')

    for (const name of ['main', 'master', 'scratch', '-x', 'a/../b', '']) {
      const result = run(BRANCH, [name], 'feat/current')
      expect(result.status, name).not.toBe(0)
      expect(result.calls, name).toBe('')
    }
    expect(run(BRANCH, [], 'feat/current').status).not.toBe(0)
    expect(run(BRANCH, ['feat/a', 'feat/b'], 'feat/current').status).not.toBe(0)
  })

  it('routes every git write through a wrapper rather than leaving it direct', () => {
    // The wrappers only enforce if something makes them the way through. With
    // `git commit*: allow` the gate was optional, and an optional gate is not one.
    const builder = readFileSync(resolve(root, '.opencode/agents/predictor-builder.md'), 'utf8')
    for (const denied of ['"git commit*": deny', '"git push*": deny', '"gh pr create*": deny']) {
      expect(builder, denied).toContain(denied)
    }
    expect(builder).toContain('"bash scripts/agent-tools/*": allow')
  })

  it('carries no test-only branch in the production scripts', () => {
    // #1041's wrappers ended with `if [ -n "${FAKE_LOG:-}" ]` — production code
    // taking a branch from a variable that exists only for a test.
    for (const script of [PUSH, PR, 'scripts/agent-tools/owner-commit.sh',
      'scripts/agent-tools/owner-branch.sh']) {
      const source = readFileSync(resolve(root, script), 'utf8')
      const code = source.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n')
      expect(code, script).not.toContain('FAKE_LOG')
      expect(code, script).not.toContain('WRAPPER_TEST_LOG')
    }
  })
})
