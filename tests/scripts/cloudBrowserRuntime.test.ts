import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('persistent cloud browser runtime', () => {
  it('couples the pinned browser installer to the pinned Playwright MCP', () => {
    const runtime = JSON.parse(read('config/browser-runtime.json')) as {
      installerPackage: string
      installerVersion: string
      browser: string
      executableLink: string
      coupledMcpPackage: string
      coupledMcpVersion: string
    }
    const tools = JSON.parse(read('config/agent-tools.json')) as {
      playwrightMcp: { package: string; version: string }
    }

    expect(runtime.installerPackage).toBe('playwright')
    expect(runtime.installerVersion).toBe('1.63.0-alpha-2026-08-05')
    expect(runtime.browser).toBe('chromium')
    expect(runtime.executableLink).toBe('/opt/predictor-browser/chrome')
    expect(runtime.coupledMcpPackage).toBe(tools.playwrightMcp.package)
    expect(runtime.coupledMcpVersion).toBe(tools.playwrightMcp.version)
  })

  it('points both browser MCPs at the same explicit headless executable', () => {
    const runtime = JSON.parse(read('config/browser-runtime.json')) as { executableLink: string }
    const claude = JSON.parse(read('.mcp.json')) as {
      mcpServers: Record<string, { args: string[] }>
    }
    const opencode = JSON.parse(read('opencode.json')) as {
      mcp: Record<string, { command?: string[] }>
    }

    const playwrightArgs = claude.mcpServers.playwright.args
    const devtoolsArgs = claude.mcpServers['chrome-devtools'].args
    expect(playwrightArgs).toContain(`--executable-path=${runtime.executableLink}`)
    expect(playwrightArgs).toContain('--headless')
    expect(devtoolsArgs).toContain(`--executablePath=${runtime.executableLink}`)
    expect(devtoolsArgs).toContain('--headless')
    expect(devtoolsArgs).toContain('--isolated')
    expect(opencode.mcp.playwright.command).toEqual(['npx', ...playwrightArgs])
    expect(opencode.mcp['chrome-devtools'].command).toEqual(['npx', ...devtoolsArgs])
  })

  it('installs the browser from pinned config during cloud bootstrap and doctors it', () => {
    const install = read('scripts/agent-tools/cloud-browser-install.sh')
    const conductorInstall = read('scripts/agent-tools/cloud-conductor-install.sh')
    const doctor = read('scripts/agent-tools/cloud-conductor-doctor.sh')

    expect(install).toContain("require('./config/browser-runtime.json')")
    expect(install).toContain('install --with-deps "$browser_name"')
    expect(install).toContain('PLAYWRIGHT_BROWSERS_PATH=$install_root')
    expect(install).toContain('coupledMcpVersion')
    expect(conductorInstall).toContain('bash scripts/agent-tools/cloud-browser-install.sh')
    expect(doctor).toContain("require('./config/browser-runtime.json').executableLink")
    expect(doctor).toContain("ready 'Browser runtime'")
    expect(doctor).toContain("missing 'Browser runtime'")
  })

  it('keeps all browser bootstrap shell entrypoints syntactically valid', () => {
    for (const file of [
      'scripts/agent-tools/cloud-browser-install.sh',
      'scripts/agent-tools/cloud-conductor-install.sh',
      'scripts/agent-tools/cloud-conductor-doctor.sh',
      'scripts/agent-tools/mcp-readiness.sh',
    ]) {
      expect(() => execFileSync('bash', ['-n', file], { cwd: root })).not.toThrow()
    }
  })
})
