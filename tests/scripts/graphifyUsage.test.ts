import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('Graphify navigation consumption', () => {
  it('provides one bounded, pinned entrypoint for querying a portable graph', () => {
    const wrapper = read('scripts/agent-tools/graphify-query.sh')

    expect(wrapper).toContain("require('./config/agent-tools.json').graphify.version")
    expect(wrapper).toContain('origin/graphify-navigation')
    expect(wrapper).toContain('${snapshot_ref}:README.md')
    expect(wrapper).toContain('${snapshot_ref}:graph.json')
    expect(wrapper).toContain('--allow-stale')
    expect(wrapper).toContain('--graph')
    expect(wrapper).toContain('nodes')
    expect(wrapper).toContain('edges')
    expect(wrapper).toContain('query|explain)')
    expect(wrapper).toContain('path)')
    expect(wrapper).toContain('uvx --from')
    expect(wrapper).not.toContain('OPENAI_API_KEY')
    expect(wrapper).not.toContain('OMNIROUTE_API_KEY')
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
    expect(runbook).toContain('bash scripts/agent-tools/graphify-query.sh')
    expect(toolchain).toContain('bash scripts/agent-tools/graphify-query.sh')
    expect(skill).toContain('bash scripts/agent-tools/graphify-query.sh')
  })
})
