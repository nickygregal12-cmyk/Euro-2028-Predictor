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
  serena: { package: string; version: string }
  context7: { package: string; version: string }
  repomix: { package: string; version: string }
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
    }
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
