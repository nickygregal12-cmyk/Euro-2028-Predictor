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
      mcpServers: {
        playwright: { args: string[] }
        'chrome-devtools': { args: string[] }
      }
    }
    const opencode = JSON.parse(read('opencode.json')) as {
      mcp: {
        playwright: { command: string[] }
        'chrome-devtools': { command: string[] }
      }
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

  it('installs and attests only the exact version-specific browser runtime', () => {
    const install = read('scripts/agent-tools/cloud-browser-install.sh')
    const conductorInstall = read('scripts/agent-tools/cloud-conductor-install.sh')
    const doctor = read('scripts/agent-tools/cloud-conductor-doctor.sh')

    expect(install).toContain("require('./config/browser-runtime.json')")
    expect(install).toContain('runtime_root="${install_root}/${installer_version}"')
    expect(install).toContain('PLAYWRIGHT_BROWSERS_PATH=$runtime_root')
    expect(install).toContain('sudo find "$runtime_root"')
    expect(install).toContain('install --with-deps "$browser_name"')
    expect(install).toContain('p.runtimeRoot === process.argv[5]')
    expect(install).toContain('coupledMcpVersion')
    expect(install).toContain('profile predictor-browser "$browser_executable" flags=(unconfined)')
    expect(install).toContain('userns,')
    expect(install).toContain('apparmor_parser -r')
    expect(install).not.toContain('--no-sandbox')
    expect(conductorInstall).toContain('bash scripts/agent-tools/cloud-browser-install.sh')
    expect(doctor).toContain("require('./config/browser-runtime.json').executableLink")
    expect(doctor).toContain("ready 'Browser runtime'")
    expect(doctor).toContain("missing 'Browser runtime'")

    const launchProof = install.indexOf('if ! browser_version="$($executable_link --version')
    const provenanceWrite = install.indexOf('| sudo tee "$provenance_file"')
    const sandboxInstall = install.indexOf('install_browser_sandbox_profile')
    const alreadyPresent = install.indexOf('Pinned browser runtime already present')
    expect(launchProof).toBeGreaterThan(-1)
    expect(provenanceWrite).toBeGreaterThan(launchProof)
    expect(sandboxInstall).toBeGreaterThan(alreadyPresent)
    expect(install.slice(alreadyPresent, sandboxInstall)).not.toMatch(/exit 0/)
    expect(doctor).toContain("ready 'Browser sandbox'")
    expect(doctor).toContain('--dump-dom')
    expect(doctor).not.toContain('--no-sandbox')
  })

  it('keeps all Stage 0 cloud shell entrypoints syntactically valid', () => {
    for (const file of [
      'scripts/agent-tools/cloud-browser-install.sh',
      'scripts/agent-tools/cloud-conductor-install.sh',
      'scripts/agent-tools/cloud-conductor-doctor.sh',
      'scripts/agent-tools/mcp-readiness.sh',
      'scripts/agent-tools/stage0-live-acceptance.sh',
    ]) {
      expect(() => execFileSync('bash', ['-n', file], { cwd: root })).not.toThrow()
    }
  })
})
