import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

interface ToolEntry {
  package?: string
  repository?: string
  version: string
  mode: string
  port?: number
  python?: string
  extras?: string[]
}

type AgentToolConfiguration = Record<string, ToolEntry>

interface McpServer {
  command: string
  args: string[]
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8')) as T
}

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

function exactVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
}

describe('Predictor developer operating system', () => {
  const tools = readJson<AgentToolConfiguration>('config/agent-tools.json')

  it('keeps every supported tool on an exact central version', () => {
    expect(Object.keys(tools).sort()).toEqual(
      [
        'agentMail',
        'astGrep',
        'beads',
        'context7',
        'dependencyCruiser',
        'graphify',
        'lostPixel',
        'mergiraf',
        'omniroute',
        'reactScan',
        'repomix',
        'serena',
        'specKit',
        'uv',
        'weave',
      ].sort(),
    )

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.version, `${name} version must be exact`).toSatisfy(exactVersion)
      expect(tool.mode, `${name} must declare a lifecycle mode`).not.toBe('')
      expect(tool.package ?? tool.repository, `${name} must identify its source`).toBeDefined()
    }

    expect(tools.graphify?.extras).toEqual(['sql', 'openai'])
    expect(tools.omniroute?.port).toBe(20128)
    expect(tools.agentMail?.port).toBe(8765)
  })

  it('keeps every developer package outside application dependencies', () => {
    const manifest = readJson<{
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }>('package.json')
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    }

    for (const [name, tool] of Object.entries(tools)) {
      if (tool.package) {
        expect(
          declared[tool.package],
          `${name} (${tool.package}) must stay outside the application dependency graph`,
        ).toBeUndefined()
      }
    }
  })

  it('bootstraps the lightweight baseline without starting stateful services', () => {
    const bootstrap = read('scripts/agent-tools/bootstrap.sh')
    expect(bootstrap).toContain("require('./config/agent-tools.json')")
    expect(bootstrap).toContain('graphifyy[sql,openai]==${graphify_version}')
    expect(bootstrap).toContain('omniroute@${omniroute_version}')
    expect(bootstrap).toContain('serena-agent==${serena_version}')
    expect(bootstrap).toContain('specify-cli==${spec_kit_version}')
    expect(bootstrap).toContain('@ast-grep/cli@${ast_grep_version}')
    expect(bootstrap).toContain('@beads/bd@${beads_version}')

    expect(bootstrap).not.toContain('mcp_agent_mail')
    expect(bootstrap).not.toContain('cargo install')
    expect(bootstrap).not.toContain('bd init')
    expect(bootstrap).not.toMatch(/(?:^|\n)\s*omniroute\s+--no-open/)
  })

  it('keeps MCP retrieval tools pinned and developer-only', () => {
    const mcp = readJson<{ mcpServers: Record<string, McpServer> }>('.mcp.json')

    expect(mcp.mcpServers.serena?.command).toBe('serena')
    expect(mcp.mcpServers.serena?.args).toContain('start-mcp-server')
    expect(mcp.mcpServers.serena?.args).toContain('--project-from-cwd')

    const context7Args = mcp.mcpServers.context7?.args.join(' ') ?? ''
    const repomixArgs = mcp.mcpServers.repomix?.args.join(' ') ?? ''
    expect(context7Args).toContain(`${tools.context7?.package}@${tools.context7?.version}`)
    expect(repomixArgs).toContain(`${tools.repomix?.package}@${tools.repomix?.version}`)
    expect(repomixArgs).toContain('--mcp')
  })

  it('bounds Serena to repository authority and disables persistent memories', () => {
    const project = read('.serena/project.yml')
    expect(project).toContain('AGENTS.md')
    expect(project).toContain('NOW.md')
    expect(project).toContain('docs/history/**')
    expect(project).toContain('docs/quality/evidence/**')
    expect(project).toContain('ignored_memory_patterns:')
    expect(project).toContain('- ".*"')
  })

  it('keeps Beads local and Agent Mail explicitly opt-in', () => {
    const beads = read('scripts/agent-tools/beads-init.sh')
    expect(beads).toContain('bd init --stealth')

    const installAgentMail = read('scripts/agent-tools/install-agent-mail.sh')
    const agentMail = read('scripts/agent-tools/agent-mail.sh')
    expect(installAgentMail).toContain('mcp_agent_mail')
    expect(installAgentMail).toContain('checkout --detach "v${version}"')
    expect(agentMail).toContain('HTTP_HOST=127.0.0.1')
    expect(agentMail).toContain('HTTP_ALLOW_LOCALHOST_UNAUTHENTICATED=true')
  })

  it('keeps semantic merge policy clone-local and optional', () => {
    const installer = read('scripts/agent-tools/install-merge-tools.sh')
    const configure = read('scripts/agent-tools/configure-merge-driver.sh')

    expect(installer).toContain('mergiraf --version "$mergiraf_version"')
    expect(installer).toContain('checkout --detach "v${weave_version}"')
    expect(configure).toContain('.git/info/attributes')
    expect(configure).toContain('weave setup --local')
    expect(configure).toContain('merge.mergiraf.driver')
    expect(configure).not.toContain('attributes_file=".gitattributes"')
  })

  it('preserves Playwright as the blocking visual authority', () => {
    const visualWorkflow = read('.github/workflows/visual-contracts.yml')
    const lostPixel = read('lostpixel.config.js')

    expect(visualWorkflow).toContain('playwright.visual.config.ts')
    expect(visualWorkflow).not.toContain('lost-pixel')
    expect(lostPixel).toContain('generateOnly: true')
    expect(lostPixel).toContain('failOnDifference: false')
  })

  it('makes the online environment bounded rather than auto-starting services', () => {
    const devcontainer = readJson<{
      postCreateCommand?: string
      forwardPorts?: number[]
      features?: Record<string, { version?: string }>
      portsAttributes?: Record<string, { label?: string; onAutoForward?: string }>
    }>('.devcontainer/devcontainer.json')

    expect(devcontainer.postCreateCommand).toBe('bash scripts/agent-tools/bootstrap.sh')
    expect(devcontainer.features?.['ghcr.io/devcontainers/features/rust:1']).toBeDefined()
    expect(devcontainer.forwardPorts).toEqual(expect.arrayContaining([20128, 8765]))
    expect(devcontainer.portsAttributes?.['20128']?.label).toContain('OmniRoute')
    expect(devcontainer.portsAttributes?.['8765']?.label).toContain('Agent Mail')
    expect(devcontainer.portsAttributes?.['8765']?.onAutoForward).toBe('silent')
  })

  it('keeps deep Graphify, dependency checks and context packs explicitly routed', () => {
    const deepGraphify = read('scripts/agent-tools/graphify-deep-via-omniroute.sh')
    const architecture = read('scripts/agent-tools/architecture-check.sh')
    const contextPack = read('scripts/agent-tools/context-pack.sh')

    expect(deepGraphify).toContain('OMNIROUTE_API_KEY')
    expect(deepGraphify).toContain('--backend openai')
    expect(deepGraphify).toContain('--mode deep')
    expect(architecture).toContain("require('./config/agent-tools.json').dependencyCruiser.version")
    expect(contextPack).toContain("require('./config/agent-tools.json').repomix.version")
    expect(contextPack).toContain('.artifacts/context')
  })
})
