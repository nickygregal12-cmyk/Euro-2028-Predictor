import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

interface AgentToolConfiguration {
  graphify: {
    package: string
    version: string
    extras: string[]
  }
  omniroute: {
    package: string
    version: string
    port: number
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8')) as T
}

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('online agent tooling', () => {
  const tools = readJson<AgentToolConfiguration>('config/agent-tools.json')

  it('pins Graphify and OmniRoute to exact versions in one canonical config', () => {
    expect(tools.graphify.package).toBe('graphifyy')
    expect(tools.omniroute.package).toBe('omniroute')
    expect(tools.graphify.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(tools.omniroute.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(tools.graphify.extras).toEqual(['sql', 'openai'])
    expect(tools.omniroute.port).toBe(20128)
  })

  it('keeps both tools out of application dependencies', () => {
    const manifest = readJson<{
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }>('package.json')
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    }

    expect(declared[tools.graphify.package]).toBeUndefined()
    expect(declared[tools.omniroute.package]).toBeUndefined()
  })

  it('provisions tools from the canonical pins without starting OmniRoute', () => {
    const bootstrap = read('scripts/agent-tools/bootstrap.sh')
    expect(bootstrap).toContain("require('./config/agent-tools.json')")
    expect(bootstrap).toContain('graphifyy[sql,openai]==${graphify_version}')
    expect(bootstrap).toContain('omniroute@${omniroute_version}')
    expect(bootstrap).not.toMatch(/(?:^|\n)\s*omniroute\s+--no-open/)
  })

  it('keeps semantic Graphify explicitly routed and opt-in', () => {
    const helper = read('scripts/agent-tools/graphify-deep-via-omniroute.sh')
    expect(helper).toContain('OMNIROUTE_API_KEY')
    expect(helper).toContain('GRAPHIFY_OMNIROUTE_MODEL')
    expect(helper).toContain('--backend openai')
    expect(helper).toContain('--mode deep')
  })

  it('makes the online environment use the bounded bootstrap and private forwarded port', () => {
    const devcontainer = readJson<{
      postCreateCommand?: string
      forwardPorts?: number[]
      portsAttributes?: Record<string, { label?: string }>
    }>('.devcontainer/devcontainer.json')

    expect(devcontainer.postCreateCommand).toBe(
      'bash scripts/agent-tools/bootstrap.sh',
    )
    expect(devcontainer.forwardPorts).toContain(20128)
    expect(devcontainer.portsAttributes?.['20128']?.label).toContain('OmniRoute')
  })
})
