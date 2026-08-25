import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const expectedOpenCodeVersion = (
  JSON.parse(readFileSync(resolve(root, 'config/agent-tools.json'), 'utf8')) as {
    opencode: { version: string }
  }
).opencode.version
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

function runGitHubCredentialBoundary(options: {
  token?: string
  mode?: number
  callerToken?: string
} = {}) {
  const home = mkdtempSync(resolve(tmpdir(), 'predictor-mcp-credential-'))
  const bin = resolve(home, '.local/bin')
  const protectedDirectory = resolve(home, '.config/predictor-cloud')
  const invocationMarker = resolve(home, 'mcp-list-invoked')
  mkdirSync(bin, { recursive: true })
  mkdirSync(protectedDirectory, { recursive: true })

  if (options.token !== undefined) {
    const envFile = resolve(protectedDirectory, 'opencode.env')
    writeFileSync(envFile, `IGNORED_PROTECTED_KEY=do-not-import\nGITHUB_MCP_TOKEN=${options.token}\n`, {
      mode: 0o600,
    })
    chmodSync(envFile, options.mode ?? 0o600)
  }

  const rows = servers.map((server) => `  ${server}  Connected`).join('\\n')
  writeFileSync(resolve(bin, 'opencode'), `#!/usr/bin/env bash
case "\${1:-}" in
  --version) printf '${expectedOpenCodeVersion}\\n' ;;
  debug) exit 0 ;;
  mcp)
    : > '${invocationMarker}'
    [ "\${GITHUB_MCP_TOKEN:-}" = 'stage0-boundary-sentinel' ] || exit 70
    [ -z "\${IGNORED_PROTECTED_KEY:-}" ] || exit 71
    printf '%b\\n' '${rows}'
    ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 })

  const environment: NodeJS.ProcessEnv = { ...process.env, HOME: home }
  if (options.callerToken === undefined) {
    delete environment.GITHUB_MCP_TOKEN
  } else {
    environment.GITHUB_MCP_TOKEN = options.callerToken
  }
  delete environment.IGNORED_PROTECTED_KEY
  const result = spawnSync('bash', ['scripts/agent-tools/mcp-readiness.sh', '--connectivity'], {
    cwd: root,
    env: environment,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  return { result, invocationMarker }
}

describe('GitHub MCP protected credential boundary', () => {
  it('fails closed before MCP initialization when the protected token is missing', () => {
    const { result, invocationMarker } = runGitHubCredentialBoundary()

    expect(result.status).toBe(1)
    expect(existsSync(invocationMarker)).toBe(false)
  })

  it('fails closed before MCP initialization when the protected token is empty', () => {
    const { result, invocationMarker } = runGitHubCredentialBoundary({ token: '' })

    expect(result.status).toBe(1)
    expect(existsSync(invocationMarker)).toBe(false)
  })

  it('fails closed before MCP initialization when the protected token is whitespace only', () => {
    const { result, invocationMarker } = runGitHubCredentialBoundary({ token: ' \t ' })

    expect(result.status).toBe(1)
    expect(existsSync(invocationMarker)).toBe(false)
    expect(`${result.stdout}${result.stderr}`).not.toContain('stage0-boundary-sentinel')
  })

  it('treats a whitespace-only caller token as absent and uses the protected token unchanged', () => {
    const { result, invocationMarker } = runGitHubCredentialBoundary({
      token: 'stage0-boundary-sentinel',
      callerToken: ' \t ',
    })

    expect(result.status).toBe(0)
    expect(existsSync(invocationMarker)).toBe(true)
    expect(`${result.stdout}${result.stderr}`).not.toContain('stage0-boundary-sentinel')
  })

  it('passes only the GitHub token from the mode-0600 file to the MCP child without printing it', () => {
    const { result, invocationMarker } = runGitHubCredentialBoundary({
      token: 'stage0-boundary-sentinel',
    })

    expect(result.status).toBe(0)
    expect(existsSync(invocationMarker)).toBe(true)
    expect(`${result.stdout}${result.stderr}`).not.toContain('stage0-boundary-sentinel')
  })

  it('refuses a protected credential file with the wrong mode before MCP initialization', () => {
    const { result, invocationMarker } = runGitHubCredentialBoundary({
      token: 'stage0-boundary-sentinel',
      mode: 0o640,
    })

    expect(result.status).toBe(1)
    expect(existsSync(invocationMarker)).toBe(false)
    expect(`${result.stdout}${result.stderr}`).not.toContain('stage0-boundary-sentinel')
  })
})
