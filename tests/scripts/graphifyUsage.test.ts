import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

function runGit(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

describe('Graphify navigation consumption', () => {
  it('provides one bounded, pinned entrypoint for querying a portable graph', () => {
    const wrapper = read('scripts/agent-tools/graphify-query.sh')

    expect(wrapper).toContain("require('./config/agent-tools.json').graphify.version")
    expect(wrapper).toContain('origin/graphify-navigation')
    expect(wrapper).toContain('${snapshot_ref}:README.md')
    expect(wrapper).toContain('${snapshot_ref}:graph.json')
    expect(wrapper).toContain('graphify-input-fingerprint.mjs')
    expect(wrapper).toContain('--allow-stale')
    expect(wrapper).toContain('--graph')
    expect(wrapper).toContain('nodes')
    expect(wrapper).toContain('edges')
    expect(wrapper).toContain('query|explain|affected)')
    expect(wrapper).toContain('god-nodes)')
    expect(wrapper).toContain("GRAPHIFY_QUERY_BUDGET:-1200")
    expect(wrapper).toContain('uvx --from')
    expect(wrapper).not.toContain('OPENAI_API_KEY')
    expect(wrapper).not.toContain('OMNIROUTE_API_KEY')
  })

  it('fingerprints graph inputs rather than unrelated repository commits', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'predictor-graphify-inputs-'))
    const fingerprintScript = resolve(
      repositoryRoot,
      'scripts/agent-tools/graphify-input-fingerprint.mjs',
    )

    try {
      runGit(fixture, 'init')
      runGit(fixture, 'config', 'user.email', 'graphify-test@example.invalid')
      runGit(fixture, 'config', 'user.name', 'Graphify test')
      runGit(fixture, 'config', 'commit.gpgsign', 'false')

      mkdirSync(join(fixture, 'src'), { recursive: true })
      mkdirSync(join(fixture, '.github', 'workflows'), { recursive: true })
      writeFileSync(join(fixture, 'src', 'app.ts'), 'export const value = 1\n')
      writeFileSync(
        join(fixture, '.github', 'workflows', 'production-rehearsal.yml'),
        'name: unrelated workflow\n',
      )
      runGit(fixture, 'add', '-A')
      runGit(fixture, 'commit', '-m', 'initial graph inputs')

      const fingerprint = () =>
        execFileSync('node', [fingerprintScript, '--ref', 'HEAD'], {
          cwd: fixture,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim()

      const initial = fingerprint()
      expect(initial).toMatch(/^sha256:[0-9a-f]{64}$/)

      writeFileSync(
        join(fixture, '.github', 'workflows', 'production-rehearsal.yml'),
        'name: unrelated workflow\njobs: {}\n',
      )
      runGit(fixture, 'add', '-A')
      runGit(fixture, 'commit', '-m', 'change unrelated workflow')
      expect(fingerprint()).toBe(initial)

      writeFileSync(join(fixture, 'src', 'app.ts'), 'export const value = 2\n')
      runGit(fixture, 'add', '-A')
      runGit(fixture, 'commit', '-m', 'change indexed source')
      expect(fingerprint()).not.toBe(initial)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('makes broad-change navigation evidence visible in pull requests', () => {
    const template = read('.github/pull_request_template.md')

    expect(template).toContain('## Navigation evidence')
    expect(template).toContain('Graphify / Serena / repository search')
    expect(template).toContain('Graph source SHA')
    expect(template).toContain('Key paths or symbols')
    expect(template).toContain('Why not used')
  })

  it('teaches graph producers how to hand their artifact to consumers', () => {
    const workflow = read('.github/workflows/graphify-navigation.yml')
    const runbook = read('docs/ops/graphify-navigation.md')
    const toolchain = read('docs/ops/developer-toolchain.md')
    const skill = read('.agents/skills/predictor-graph-navigation/SKILL.md')

    expect(workflow).toContain('scripts/agent-tools/graphify-query.sh')
    expect(workflow).toContain('GRAPHIFY_INPUT_FINGERPRINT')
    expect(runbook).toContain('bash scripts/agent-tools/graphify-query.sh')
    expect(toolchain).toContain('bash scripts/agent-tools/graphify-query.sh')
    expect(skill).toContain('bash scripts/agent-tools/graphify-query.sh')
  })
})
