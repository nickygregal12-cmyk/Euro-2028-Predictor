import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const servers = [
  'playwright',
  'chrome-devtools',
  'serena',
  'context7',
  'repomix',
  'supabase-dev',
  'supabase-prod',
  'netlify',
  'github',
  'sentry',
  'posthog',
]

function runReadiness(targetLine: string) {
  const home = mkdtempSync(resolve(tmpdir(), 'predictor-mcp-classifier-'))
  const bin = resolve(home, '.local/bin')
  mkdirSync(bin, { recursive: true })

  const rows = servers
    .map((server) => `  ${server}  ${server === 'sentry' ? targetLine : 'Connected'}`)
    .join('\\n')

  writeFileSync(resolve(bin, 'opencode'), `#!/usr/bin/env bash
case "\${1:-}" in
  --version) printf '1.18.19\\n' ;;
  debug) exit 0 ;;
  mcp) printf '%b\\n' '${rows}' ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 })

  return spawnSync('bash', ['scripts/agent-tools/mcp-readiness.sh', '--connectivity'], {
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      GITHUB_MCP_TOKEN: 'test-placeholder-not-a-real-token',
    },
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

describe('MCP readiness classification', () => {
  it('treats connected OAuth as authenticated and connected', () => {
    const result = runReadiness('connected (OAuth)')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/CONFIGURED sentry\s+AUTH=OK\s+CONNECTED=YES\s+UNAVAILABLE=NO/)
  })

  it('recognises explicit authentication requirements', () => {
    for (const line of ['needs authentication', '401 unauthorized', 'login required']) {
      const result = runReadiness(line)
      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(/CONFIGURED sentry\s+AUTH=REQUIRED\s+CONNECTED=NO\s+UNAVAILABLE=NO/)
    }
  })

  it('classifies provider 5xx and timeout states as unavailable', () => {
    for (const line of ['503 service unavailable', 'connection timed out']) {
      const result = runReadiness(line)
      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(/CONFIGURED sentry\s+AUTH=UNKNOWN\s+CONNECTED=NO\s+UNAVAILABLE=YES/)
    }
  })

  it('fails closed on output it cannot classify', () => {
    const result = runReadiness('mystery provider state')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/CONFIGURED sentry\s+AUTH=UNKNOWN\s+CONNECTED=NO\s+UNAVAILABLE=NO CLASSIFICATION=UNKNOWN/)
    expect(result.stderr).toContain('FAILED readiness output contained an unclassified MCP state')
  })
})
