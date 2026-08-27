import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const checker = resolve(repositoryRoot, 'scripts/check-agent-bash-allowlist.mjs')
const portPath = resolve(repositoryRoot, '.claude/hooks/agent-bash-allow.json')

interface Divergence {
  agent: string
  list: 'allow' | 'never'
  change: 'added' | 'removed'
  pattern: string
  reason: string
}

interface Profile {
  allow: string[]
  never: string[]
}

/** Run the checker against a repository state, returning its exit code. */
function runChecker(): { status: number; output: string } {
  try {
    const output = execFileSync('node', [checker], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
    return { status: 0, output }
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string }
    return { status: failure.status, output: failure.stdout + failure.stderr }
  }
}

/**
 * Read one agent's profile, failing if it is absent. A missing profile is not a
 * type nuisance: `allow-bash.py` denies every command for an agent it has no
 * profile for, so the agent would be inert rather than merely unguarded.
 */
function profileFor(agent: string): Profile {
  const port = JSON.parse(readFileSync(portPath, 'utf8')) as Record<string, Profile | undefined>
  const profile = port[agent]
  if (!profile) throw new Error(`${agent} has no allowlist profile`)
  return profile
}

describe('agent Bash allowlist parity', () => {
  it('matches the canonical OpenCode permission blocks', () => {
    const { status, output } = runChecker()
    expect(output).toContain('parity OK')
    expect(status).toBe(0)
  })

  it('covers every OpenCode agent', () => {
    const port = JSON.parse(readFileSync(portPath, 'utf8')) as Record<string, unknown>
    const agents = Object.keys(port).filter((key) => !key.startsWith('$'))
    expect(agents.sort()).toEqual([
      'predictor-builder',
      'predictor-conductor',
      'predictor-critic',
      'predictor-release-verifier',
      'predictor-visual-qa',
    ])
  })

  it('expresses no pattern with a `$`, because the hook refuses expansions outright', () => {
    // `allow-bash.py` denies any command containing `$`: an expansion is
    // rewritten by bash AFTER the matcher has judged the raw text, so a literal
    // rule can be split in half by one that contributes nothing. That denial is
    // what makes the reasoning in EXPANSION's comment true, and this is the
    // check that comment cites.
    //
    // The failure it catches is silent rather than loud. A pattern containing a
    // `$` would never match anything, because every command that could match it
    // is refused before the pattern is consulted -- so the author would see a
    // rule they believed was permissive, and a role quietly narrower than its
    // OpenCode original. Nothing else would complain.
    const port = JSON.parse(readFileSync(portPath, 'utf8')) as Record<string, unknown>
    const offenders: string[] = []
    for (const [key, value] of Object.entries(port)) {
      if (typeof value !== 'object' || value === null) continue
      const profile = value as { allow?: string[]; never?: string[] }
      for (const list of ['allow', 'never'] as const) {
        for (const pattern of profile[list] ?? []) {
          if (pattern.includes('$')) offenders.push(`${key}.${list}: ${pattern}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the builder git-write denials, which the owner-* wrappers depend on', () => {
    const never = profileFor('predictor-builder').never
    // If any of these stop being refused, config/pre-live-owner-authority.json
    // becomes advisory: the builder could reach past the wrapper to raw git.
    for (const pattern of ['git commit*', 'git push*', 'gh pr create*', 'gh pr merge*']) {
      expect(never).toContain(pattern)
    }
  })

  it('refuses the pathspec restore forms that discard uncommitted work', () => {
    const never = profileFor('predictor-builder').never
    expect(never).toContain('git checkout * -- *')
    expect(never).toContain('git checkout --*')
  })

  it('requires every divergence to carry a written reason', () => {
    const port = JSON.parse(readFileSync(portPath, 'utf8')) as { $divergences: Divergence[] }
    for (const divergence of port.$divergences) {
      expect(divergence.reason.length).toBeGreaterThan(20)
      expect(['allow', 'never']).toContain(divergence.list)
      expect(['added', 'removed']).toContain(divergence.change)
    }
  })

  it('keeps the read-only roles unable to run gates or mutate anything', () => {
    for (const agent of ['predictor-critic', 'predictor-conductor', 'predictor-visual-qa']) {
      const allow = profileFor(agent).allow.join('\n')
      expect(allow).not.toMatch(/^git (commit|push|add)/m)
    }
    // The critic in particular gathers no executable evidence; that is the
    // release verifier's job, and the split is deliberate.
    expect(profileFor('predictor-critic').allow.join('\n')).not.toContain('npm test')
  })
})
