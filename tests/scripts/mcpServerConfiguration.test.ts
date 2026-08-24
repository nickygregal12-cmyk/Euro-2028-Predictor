import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

interface McpConfiguration {
  readonly mcpServers: Record<
    string,
    { readonly command: string; readonly args: readonly string[] }
  >
}

interface ToolRegistry {
  playwrightMcp: { package: string; version: string }
  chromeDevtoolsMcp: { package: string; version: string }
  serena: { package: string; version: string }
  context7: { package: string; version: string }
  repomix: { package: string; version: string }
}

interface OpenCodeConfiguration {
  readonly mcp: Record<string, {
    readonly type: 'local' | 'remote'
    readonly command?: readonly string[]
    readonly url?: string
    readonly headers?: Record<string, string>
    readonly oauth?: boolean | Record<string, unknown>
  }>
  readonly tools: Record<string, boolean>
}

function json<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8')) as T
}

function mcpConfiguration(): McpConfiguration {
  return json<McpConfiguration>('.mcp.json')
}

function packageManifest(): {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
} {
  return json('package.json')
}

function splitSpecifier(specifier: string): { name: string; version: string } {
  const separator = specifier.lastIndexOf('@')
  expect(separator, `unversioned specifier ${specifier}`).toBeGreaterThan(0)
  return {
    name: specifier.slice(0, separator),
    version: specifier.slice(separator + 1),
  }
}

function npxSpecifier(args: readonly string[]): string {
  const yIndex = args.indexOf('-y')
  const specifier = yIndex >= 0 ? args[yIndex + 1] : undefined
  expect(specifier, `no pinned npx package in ${JSON.stringify(args)}`).toBeDefined()
  return specifier as string
}

const BROWSER_SERVERS = {
  playwright: '@playwright/mcp',
  'chrome-devtools': 'chrome-devtools-mcp',
} as const

const EXPECTED_SERVER_NAMES = [
  'playwright',
  'chrome-devtools',
  'serena',
  'context7',
  'repomix',
] as const

describe('MCP server configuration', () => {
  const tools = json<ToolRegistry>('config/agent-tools.json')

  it('declares exactly the reviewed specialist servers', () => {
    expect(Object.keys(mcpConfiguration().mcpServers).sort()).toEqual(
      [...EXPECTED_SERVER_NAMES].sort(),
    )
  })

  it('pins browser MCP packages and keeps their roles separate', () => {
    const servers = mcpConfiguration().mcpServers
    for (const [key, packageName] of Object.entries(BROWSER_SERVERS)) {
      const { name, version } = splitSpecifier(npxSpecifier(servers[key]?.args ?? []))
      expect(name).toBe(packageName)
      expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
      const registry = key === 'playwright' ? tools.playwrightMcp : tools.chromeDevtoolsMcp
      expect({ name, version }).toEqual({ name: registry.package, version: registry.version })
    }
  })

  it('gives OpenCode the exact local and hosted inventory with local pin parity', () => {
    const config = json<OpenCodeConfiguration>('opencode.json')
    expect(Object.keys(config.mcp).sort()).toEqual([
      ...EXPECTED_SERVER_NAMES,
      'supabase-dev', 'supabase-prod', 'netlify', 'github', 'sentry', 'posthog',
    ].sort())
    for (const name of EXPECTED_SERVER_NAMES) {
      expect(config.mcp[name]?.type).toBe('local')
      const claude = mcpConfiguration().mcpServers[name]!
      expect(config.mcp[name]?.command).toEqual([claude.command, ...claude.args])
    }
  })

  it('server-side constrains every hosted MCP contract', () => {
    const { mcp } = json<OpenCodeConfiguration>('opencode.json')
    const dev = new URL(mcp['supabase-dev']!.url as string)
    const prod = new URL(mcp['supabase-prod']!.url as string)
    expect(dev.origin + dev.pathname).toBe('https://mcp.supabase.com/mcp')
    expect(dev.searchParams.get('project_ref')).toBe('iouzoutneyjpugbbtdem')
    expect(dev.searchParams.get('features')).toBe('database,debugging,development,functions,docs')
    expect(prod.searchParams.get('project_ref')).toBe('vkfnsqdyhvtwyqkisxhk')
    expect(prod.searchParams.get('read_only')).toBe('true')
    expect(prod.searchParams.get('features')).toBe('database,debugging,docs')
    expect(mcp.netlify!.url).toBe('https://netlify-mcp.netlify.app/mcp')

    expect(mcp.github!.url).toBe('https://api.githubcopilot.com/mcp/readonly')
    expect(mcp.github!.oauth).toBe(false)
    expect(mcp.github!.headers).toEqual({
      Authorization: 'Bearer {env:GITHUB_MCP_TOKEN}',
      'X-MCP-Toolsets': 'context,repos,pull_requests,issues,actions,code_security',
      'X-MCP-Readonly': 'true',
    })
    const sentry = new URL(mcp.sentry!.url as string)
    expect(sentry.origin + sentry.pathname).toBe('https://mcp.sentry.dev/mcp')
    expect(sentry.searchParams.get('skills')).toBe('inspect')
    expect(sentry.searchParams.get('skills')?.split(',')).not.toContain('triage')
    expect(sentry.searchParams.get('disable-skills')).toBe('seer')
    for (const name of ['supabase-dev', 'supabase-prod', 'netlify', 'sentry', 'posthog']) {
      expect(mcp[name]!.oauth).toEqual({})
    }

    const posthog = new URL(mcp.posthog!.url as string)
    expect(posthog.origin + posthog.pathname).toBe('https://mcp.posthog.com/mcp')
    expect(posthog.searchParams.get('readonly')).toBe('true')
    expect(posthog.searchParams.get('mode')).toBe('cli')
    const features = posthog.searchParams.get('features')?.split(',') ?? []
    expect(features).toEqual(['data_schema', 'events', 'insights', 'sql', 'web_analytics', 'error_tracking', 'replay', 'sdk_doctor', 'search'])
    expect(features).not.toEqual(expect.arrayContaining(['ai_observability', 'replay_vision']))
  })

  it('denies all MCP prefixes at root and grants only bounded role surfaces', () => {
    const config = json<OpenCodeConfiguration>('opencode.json')
    expect(Object.keys(config.tools)).toEqual(Object.keys(config.mcp).map((name) => `${name}_*`))
    expect(Object.values(config.tools)).toEqual(expect.arrayContaining([false]))
    expect(Object.values(config.tools).every((value) => value === false)).toBe(true)
    const agent = (name: string) => readFileSync(resolve(repositoryRoot, `.opencode/agents/${name}.md`), 'utf8')
    expect(agent('predictor-builder')).toContain('supabase-dev_*: true')
    expect(agent('predictor-builder')).not.toContain('supabase-prod_*: true')
    expect(agent('predictor-visual-qa')).toContain('playwright_*: true')
    expect(agent('predictor-visual-qa')).toContain('chrome-devtools_*: true')
    expect(agent('predictor-release-verifier')).toContain('supabase-prod_*: true')
    expect(agent('predictor-release-verifier')).toContain('netlify_netlify-deploy-services-reader: true')
    expect(agent('predictor-release-verifier')).not.toContain('netlify_*: true')
    expect(agent('predictor-critic')).not.toMatch(/^\s+\S+_\*: true$/m)
  })

  it('contains no committed credential or literal bearer token', () => {
    const files = ['opencode.json', '.mcp.json', ...[
      'predictor-conductor', 'predictor-builder', 'predictor-critic',
      'predictor-visual-qa', 'predictor-release-verifier',
    ].map((name) => `.opencode/agents/${name}.md`)]
    const text = files.map((file) => readFileSync(resolve(repositoryRoot, file), 'utf8')).join('\n')
    expect(text).not.toMatch(/Bearer (?!\{env:GITHUB_MCP_TOKEN\})[A-Za-z0-9_-]{10,}/)
    expect(text).not.toMatch(/(?:phx_|sk-or-|gh[opsu]_|sbp_)[A-Za-z0-9_-]+/)
  })

  it('pins Context7 and Repomix to the central registry', () => {
    const servers = mcpConfiguration().mcpServers
    const context7 = splitSpecifier(npxSpecifier(servers.context7?.args ?? []))
    const repomix = splitSpecifier(npxSpecifier(servers.repomix?.args ?? []))

    expect(context7).toEqual({
      name: tools.context7.package,
      version: tools.context7.version,
    })
    expect(repomix).toEqual({
      name: tools.repomix.package,
      version: tools.repomix.version,
    })
    expect(servers.repomix?.args).toContain('--mcp')
  })

  it('runs Serena from the centrally pinned bootstrap with a shared coding-agent context', () => {
    const serena = mcpConfiguration().mcpServers.serena
    const bootstrap = readFileSync(
      resolve(repositoryRoot, 'scripts/agent-tools/bootstrap.sh'),
      'utf8',
    )

    expect(serena?.command).toBe('serena')
    expect(serena?.args).toEqual(
      expect.arrayContaining([
        'start-mcp-server',
        '--project-from-cwd',
        '--context=ide',
        '--open-web-dashboard=false',
      ]),
    )
    expect(bootstrap).toContain('serena-agent==${serena_version}')
  })

  it('opts Chrome DevTools out of both outbound telemetry paths', () => {
    const args = mcpConfiguration().mcpServers['chrome-devtools']?.args ?? []
    const flags = args.join(' ')
    expect(flags).toMatch(/--usageStatistics=false|--no-usage-statistics/)
    expect(flags).toMatch(/--performanceCrux=false|--no-performance-crux/)
  })

  it('leaves the other MCP servers free of Chrome-only telemetry flags', () => {
    const servers = mcpConfiguration().mcpServers
    for (const [name, server] of Object.entries(servers)) {
      if (name !== 'chrome-devtools') {
        expect(server.args.join(' ')).not.toMatch(/usageStatistics|performanceCrux/)
      }
    }
  })

  it('keeps every MCP package outside the application dependency graph', () => {
    const manifest = packageManifest()
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    }

    const packageNames = [
      ...Object.values(BROWSER_SERVERS),
      tools.serena.package,
      tools.context7.package,
      tools.repomix.package,
    ]

    for (const packageName of packageNames) {
      expect(
        declared[packageName],
        `${packageName} must stay a developer tool, not an application package`,
      ).toBeUndefined()
    }
  })

  it('does not import MCP developer packages from shipped source', () => {
    const packageNames = [
      ...Object.values(BROWSER_SERVERS),
      tools.serena.package,
      tools.context7.package,
      tools.repomix.package,
    ]
    const sources = execFileSync('git', ['ls-files', 'src'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((file) => /\.(?:ts|tsx)$/.test(file))

    const offenders = sources.filter((file) => {
      const contents = readFileSync(resolve(repositoryRoot, file), 'utf8')
      return packageNames.some((packageName) => contents.includes(packageName))
    })

    expect(offenders).toEqual([])
  })
})
