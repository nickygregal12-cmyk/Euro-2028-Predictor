import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The MCP servers an agent may drive this repository with.
 *
 * Two exist and they answer different questions: Playwright MCP drives
 * journeys, Chrome DevTools MCP diagnoses why one is slow or broken.
 * `docs/ops/agent-tooling-map.md` is where that split is written down.
 *
 * This test holds three properties that are cheap to break silently:
 *
 *   COEXISTENCE  adding the second server must not replace the first. A
 *                configuration file with one key is the shape a careless edit
 *                produces, and nothing else in CI would notice.
 *
 *   PINNING      both servers are pinned to an exact version. An agent-facing
 *                profiler that floats on `@latest` produces measurements that
 *                cannot be compared across two runs, and a checked-in
 *                `@latest` is a dependency that was never reviewed.
 *
 *   NO SHIPPING  neither server may reach the application. They are developer
 *                tools declared in `.mcp.json`; if either appeared in
 *                `package.json` it could be imported from `src/` and bundled.
 */

const repositoryRoot = process.cwd()

interface McpConfiguration {
  readonly mcpServers: Record<
    string,
    { readonly command: string; readonly args: readonly string[] }
  >
}

function mcpConfiguration(): McpConfiguration {
  return JSON.parse(
    readFileSync(resolve(repositoryRoot, '.mcp.json'), 'utf8'),
  ) as McpConfiguration
}

function packageManifest(): {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
} {
  return JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
}

/** The `name@version` specifier an `npx -y <spec>` invocation installs. */
function pinnedSpecifier(args: readonly string[]): string {
  const specifier = args.find((argument) => !argument.startsWith('-'))
  expect(specifier, `no package specifier in ${JSON.stringify(args)}`).toBeDefined()
  return specifier as string
}

/**
 * Split `@scope/name@1.2.3` into name and version without tripping over the
 * leading `@` of a scoped package.
 */
function splitSpecifier(specifier: string): { name: string; version: string } {
  const separator = specifier.lastIndexOf('@')
  expect(separator, `unversioned specifier ${specifier}`).toBeGreaterThan(0)
  return {
    name: specifier.slice(0, separator),
    version: specifier.slice(separator + 1),
  }
}

const EXPECTED_SERVERS = {
  playwright: '@playwright/mcp',
  'chrome-devtools': 'chrome-devtools-mcp',
} as const

describe('MCP server configuration', () => {
  it('declares exactly the two known servers', () => {
    // Exact equality rather than a containment check. A third server arriving
    // unreviewed is the thing worth failing on, and so is a missing one.
    expect(Object.keys(mcpConfiguration().mcpServers).sort()).toEqual(
      Object.keys(EXPECTED_SERVERS).sort(),
    )
  })

  it('keeps Playwright MCP alongside Chrome DevTools MCP', () => {
    const servers = mcpConfiguration().mcpServers
    for (const [key, packageName] of Object.entries(EXPECTED_SERVERS)) {
      expect(servers[key], `${key} server missing`).toBeDefined()
      expect(splitSpecifier(pinnedSpecifier(at(servers, key)?.args)).name).toBe(
        packageName,
      )
    }
  })

  it('pins every server to an exact version', () => {
    for (const [key, server] of Object.entries(mcpConfiguration().mcpServers)) {
      const { version } = splitSpecifier(pinnedSpecifier(server.args))
      // A bare tag (`latest`, `next`) or a range (`^1.7.0`) all fail here.
      expect(
        version,
        `${key} is not pinned to an exact version (got ${version})`,
      ).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
    }
  })

  it('opts Chrome DevTools MCP out of both of its outbound telemetry paths', () => {
    // Two separate defaults, both ON, and both send data to Google:
    //
    //   usageStatistics  — tool usage data.
    //   performanceCrux  — sends the URLs from PERFORMANCE TRACES to the CrUX
    //                      API to fetch field data.
    //
    // The second is the one that matters here. A developer profiling a slow
    // page profiles a real URL, and this repository's URLs carry invite codes
    // and identifiers — which is the exact defect `Stop telemetry URLs
    // carrying invite codes and identifiers` was landed to fix. A profiler
    // that transmits the URL by default would reintroduce it through a tool
    // rather than through application code.
    //
    // Both are pinned because both are silent: nothing fails when they are on,
    // which is why they need a test rather than a comment.
    const args = mcpConfiguration().mcpServers['chrome-devtools']?.args ?? []
    const flags = args.join(' ')

    expect(flags).toMatch(/--usageStatistics=false|--no-usage-statistics/)
    expect(flags).toMatch(/--performanceCrux=false|--no-performance-crux/)
  })

  it('leaves the browser-driving server free of telemetry flags it does not need', () => {
    // Playwright MCP sends nothing by default, so an opt-out flag there would
    // be cargo-culted rather than reasoned.
    const args = mcpConfiguration().mcpServers['playwright']?.args ?? []
    expect(args.join(' ')).not.toMatch(/usageStatistics|performanceCrux/)
  })

  it('keeps every server out of the application dependency graph', () => {
    const manifest = packageManifest()
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    }

    for (const packageName of Object.values(EXPECTED_SERVERS)) {
      expect(
        declared[packageName],
        `${packageName} must stay a developer tool, not a package dependency`,
      ).toBeUndefined()
    }
  })

  it('is never imported by shipped source', () => {
    // The bundle argument only holds while no module imports these. `src/`
    // is what Vite builds, so that is the tree that matters.
    const sources = execFileSync('git', ['ls-files', 'src'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((file) => /\.(?:ts|tsx)$/.test(file))

    const offenders = sources.filter((file) => {
      const contents = readFileSync(resolve(repositoryRoot, file), 'utf8')
      return Object.values(EXPECTED_SERVERS).some((packageName) =>
        contents.includes(packageName),
      )
    })

    expect(offenders).toEqual([])
  })
})
