import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('persistent private cloud Conductor', () => {
  it('keeps one default front door with bounded write, critic, visual and release lanes', () => {
    const opencode = JSON.parse(read('opencode.json')) as { default_agent?: string }
    const conductor = read('.opencode/agents/predictor-conductor.md')
    const builder = read('.opencode/agents/predictor-builder.md')
    const critic = read('.opencode/agents/predictor-critic.md')
    const visualQa = read('.opencode/agents/predictor-visual-qa.md')
    const releaseVerifier = read('.opencode/agents/predictor-release-verifier.md')

    expect(opencode.default_agent).toBe('predictor-conductor')

    expect(conductor).toContain('mode: primary')
    expect(conductor).toContain('model: openai/gpt-5.6-sol')
    expect(conductor).toContain('edit: deny')
    expect(conductor).toContain('"predictor-builder": allow')
    expect(conductor).toContain('"predictor-visual-qa": allow')
    expect(conductor).toContain('"predictor-release-verifier": allow')
    expect(conductor).toContain('bash scripts/agent-tools/ox-review.sh')
    expect(conductor).toContain('bash scripts/agent-tools/claude-review.sh')
    expect(conductor).toContain('Do not attempt to invoke `predictor-critic` through the task/subagent tool')
    expect(conductor).toContain('Do not treat agreement as evidence')
    expect(conductor).toContain('Do not call paid OpenRouter GPT/Claude models by default')

    expect(builder).toContain('mode: subagent')
    expect(builder).toContain('model: openai/gpt-5.6-sol')
    expect(builder).toContain('edit: allow')
    expect(builder).toContain('"git push*": ask')
    expect(builder).toContain('"gh pr create*": ask')
    expect(builder).toContain('stop and report it rather than silently creating spend')

    expect(critic).toContain('mode: primary')
    expect(critic).toContain('model: openrouter/stealth/ox-alpha')
    expect(critic).toContain('edit: deny')
    expect(critic).toContain('task: deny')
    expect(critic).toContain('independent read-only critic')

    for (const agent of [visualQa, releaseVerifier]) {
      expect(agent).toContain('mode: subagent')
      expect(agent).toContain('model: openai/gpt-5.6-sol')
      expect(agent).toContain('edit: deny')
      expect(agent).toContain('task: deny')
      expect(agent).toContain('AGENTS.md')
      expect(agent).toContain('NOW.md')
    }

    for (const config of [conductor, builder, critic, visualQa, releaseVerifier]) {
      expect(config).not.toContain('sk-or-')
      expect(config).not.toContain('--auto')
      expect(config).toContain('AGENTS.md')
      expect(config).toContain('NOW.md')
    }
  })

  it('uses direct read-only bridges for Ox and optional subscription Claude', () => {
    const ox = read('scripts/agent-tools/ox-review.sh')
    const claude = read('scripts/agent-tools/claude-review.sh')
    const claudeInstall = read('scripts/agent-tools/cloud-conductor-claude-install.sh')
    const tools = JSON.parse(read('config/agent-tools.json')) as {
      claudeCode?: { package?: string; version?: string; mode?: string }
    }

    expect(ox).toContain('--agent predictor-critic')
    expect(ox).toContain('--model openrouter/stealth/ox-alpha')
    expect(ox).toContain('--attach "$attach_url"')
    expect(ox).toContain('--format json')
    expect(ox).toContain('OPENROUTER_API_KEY')
    expect(ox).not.toContain('echo "$OPENROUTER_API_KEY"')

    expect(claude).toContain('--permission-mode plan')
    expect(claude).toContain('ANTHROPIC_API_KEY')
    expect(claude).toContain('ANTHROPIC_AUTH_TOKEN')
    expect(claude).toContain('CLAUDE_CODE_USE_BEDROCK')
    expect(claude).toContain('.credentials.json')
    expect(claude).toContain('apiKeyHelper')
    expect(claude).toContain('Refusing Claude review')
    expect(claude).not.toContain('claude auth login')
    expect(claude).not.toContain('claude auth status')

    expect(tools.claudeCode?.package).toBe('@anthropic-ai/claude-code')
    expect(tools.claudeCode?.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(tools.claudeCode?.mode).toBe('optional-subscription-agent')
    expect(claudeInstall).toContain("require('./config/agent-tools.json').claudeCode.version")
    expect(claudeInstall).toContain('https://claude.ai/install.sh')
    expect(claudeInstall).toContain('run `/status` once')
    expect(claudeInstall).toContain('Claude.ai subscription')
    expect(claudeInstall).toContain('ANTHROPIC_AUTH_TOKEN')
    expect(claudeInstall).not.toContain('claude auth login')
  })

  it('fails the Ox bridge closed when OpenCode emits only tool and error events', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'predictor-ox-empty-'))
    const bin = resolve(home, '.local/bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(resolve(bin, 'opencode'), `#!/usr/bin/env bash
printf '%s\\n' \\
  '{"type":"tool_use","part":{"type":"tool","state":{"status":"error","error":"permission rejected"}}}' \\
  '{"type":"error","error":{"name":"UnknownError"}}'
`, { mode: 0o755 })

    const result = spawnSync('bash', ['scripts/agent-tools/ox-review.sh', 'Review this diff.'], {
      cwd: root,
      env: {
        ...process.env,
        HOME: home,
        OPENROUTER_API_KEY: 'test-placeholder-not-a-real-key',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('OpenCode returned no substantive critic text')
    expect(`${result.stdout}${result.stderr}`).not.toContain('test-placeholder-not-a-real-key')
  })

  it('returns only assistant text from OpenCode JSON events', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'predictor-ox-text-'))
    const bin = resolve(home, '.local/bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(resolve(bin, 'opencode'), `#!/usr/bin/env bash
printf '%s\\n' \\
  '{"type":"step_start","part":{"type":"step-start"}}' \\
  '{"type":"text","part":{"type":"text","text":"Independent critic finding.","time":{"end":1}}}' \\
  '{"type":"step_finish","part":{"type":"step-finish"}}'
`, { mode: 0o755 })

    const result = spawnSync('bash', ['scripts/agent-tools/ox-review.sh', 'Review this diff.'], {
      cwd: root,
      env: {
        ...process.env,
        HOME: home,
        OPENROUTER_API_KEY: 'test-placeholder-not-a-real-key',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('Independent critic finding.\n')
    expect(result.stderr).toBe('')
    expect(`${result.stdout}${result.stderr}`).not.toContain('test-placeholder-not-a-real-key')
  })

  it('keeps the persistent web service localhost-only, password-protected and tailnet-routed', () => {
    const installer = read('scripts/agent-tools/cloud-conductor-install.sh')
    const doctor = read('scripts/agent-tools/cloud-conductor-doctor.sh')

    expect(installer).toContain('Ubuntu 24.04 LTS')
    expect(installer).toContain('aarch64|arm64')
    expect(installer).toContain('https://nodejs.org/dist/v${node_version}/SHASUMS256.txt')
    expect(installer).toContain('sha256sum --check --strict')
    expect(installer).toContain('https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg')
    expect(installer).toContain('OPENROUTER_API_KEY')
    expect(installer).toContain('OPENCODE_SERVER_PASSWORD')
    expect(installer).toContain('opencode web --hostname 127.0.0.1 --port 4096')
    expect(installer).toContain('sudo tailscale serve --bg 4096')
    expect(installer).not.toContain('tailscale funnel')
    expect(installer).not.toContain('--hostname 0.0.0.0')
    expect(installer).not.toContain('sk-or-')
    expect(installer).toContain('gh auth token')
    expect(installer).toContain('merge-cloud-env.mjs')
    expect(installer).toContain('Environment=DISABLE_AUTOUPDATER=1')

    expect(doctor).toContain('Default web agent')
    expect(doctor).toContain('Local auth boundary')
    expect(doctor).toContain('tailscale serve status')
    expect(doctor).toContain('gh auth status')
    expect(doctor).toContain('Claude billing boundary')
    expect(doctor).toContain('Claude login verification')
    expect(doctor).toContain('Ox live review bridge')
    expect(doctor).toContain('--live')
    expect(doctor).toContain('--mcp')
    expect(doctor).toContain('MCP capability state')
    expect(doctor).not.toContain('claude auth status')
  })

  it('runs the cloud smoke when any directly tested helper changes', () => {
    // TWO LISTS, IN TWO SHAPES, AND BOTH STILL HAVE TO COVER EVERY HELPER.
    //
    // The pull-request filter moved off the trigger and into the `changes` job
    // so the gate could be required at all — a `paths:`-filtered workflow never
    // posts its check on a pull request it does not match, and a required
    // context that never posts blocks that pull request for ever. What the
    // filter has to cover did not change, only where it is written, so this
    // reads the moved block rather than counting quoted trigger lines twice.
    //
    // The `push:` filter stayed on the trigger, because a push posts no context
    // a ruleset can require.
    const workflow = read('.github/workflows/cloud-conductor-smoke.yml')
    const pullRequestPaths =
      /^ {6}CONDUCTOR_PATHS: \|\n((?: {8}.*\n)+)/m.exec(workflow)?.[1] ?? ''
    const declared = new Set(
      [...pullRequestPaths.matchAll(/^ {8}(?!#)(\S+)\s*$/gm)].map((match) => match[1]),
    )
    expect(declared.size).toBeGreaterThan(0)

    for (const helper of [
      'scripts/agent-tools/cloud-browser-install.sh',
      'scripts/agent-tools/configure-claude-settings.mjs',
      'scripts/agent-tools/merge-cloud-env.mjs',
      'scripts/agent-tools/mcp-readiness.sh',
      'scripts/agent-tools/netlify-mcp-fallback.sh',
      'scripts/agent-tools/stage0-live-acceptance.sh',
    ]) {
      expect(declared, helper).toContain(helper)
      expect(
        workflow.split('\n').filter((line) => line.trim() === `- '${helper}'`),
        helper,
      ).toHaveLength(1)
    }
  })

  it('validates tracked agents from complete OpenCode output without printing permissions', () => {
    const workflow = read('.github/workflows/cloud-conductor-smoke.yml')
    const step = workflow.match(
      /- name: Validate OpenCode loads all tracked agents[\s\S]*?(?=\n\s+- name: Summary)/,
    )?.[0]

    expect(step).toBeDefined()
    expect(step).toContain('opencode agent list >"$agents_file"')
    expect(step).toContain('grep -F -x -- "${agent} (${mode})" "$agents_file" >/dev/null')
    expect(step).toContain("printf 'PASS %s\\n' \"$agent\"")
    expect(step).not.toMatch(/printf[^\n]*\$agents(?:\b|_file)/)
    expect(step).not.toMatch(/cat\s+[^\n]*\$agents_file/)
    expect(step).not.toMatch(/opencode agent list\s*\|/)
    expect(step).not.toContain('grep -q')
  })

  it('keeps the proven Sentry and PostHog reads exact pending live reload acceptance', () => {
    const releaseVerifier = read('.opencode/agents/predictor-release-verifier.md')

    expect(releaseVerifier).toContain('sentry_find_organizations: true')
    expect(releaseVerifier).toContain('posthog_read-data-schema: true')
    expect(releaseVerifier).not.toContain('sentry_*: true')
    expect(releaseVerifier).not.toContain('posthog_*: true')
    expect(releaseVerifier).not.toMatch(/^\s+sentry_\S*(?:search|execute|update|triage|seer)\S*:\s*true$/mi)
    expect(releaseVerifier).not.toMatch(/^\s+posthog_(?:exec|\S*agent[-_]feedback\S*):\s*true$/mi)
    expect(releaseVerifier).toContain('restarted/reloaded Hetzner session and live acceptance')
  })

  it('preserves unknown protected env keys while rotating managed values', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'predictor-cloud-env-'))
    const target = resolve(directory, 'opencode.env')
    writeFileSync(target, 'UNKNOWN_PROTECTED=keep\nOPENROUTER_API_KEY=old\nOPENROUTER_API_KEY=stale-duplicate\nGITHUB_MCP_TOKEN=preserved\n', { mode: 0o600 })
    const childEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      OPENROUTER_API_KEY: 'new',
      OPENCODE_SERVER_USERNAME: 'predictor',
    }
    delete childEnvironment.GITHUB_MCP_TOKEN
    execFileSync('node', ['scripts/agent-tools/merge-cloud-env.mjs', target], {
      cwd: root,
      env: childEnvironment,
    })
    const result = readFileSync(target, 'utf8')
    expect(result).toContain('UNKNOWN_PROTECTED=keep')
    expect(result).toContain('OPENROUTER_API_KEY=new')
    expect(result).not.toContain('OPENROUTER_API_KEY=old')
    expect(result).not.toContain('stale-duplicate')
    expect(result).toContain('GITHUB_MCP_TOKEN=preserved')
    expect(result.match(/^OPENROUTER_API_KEY=/gm)).toHaveLength(1)
    expect(statSync(target).mode & 0o777).toBe(0o600)
  })

  it('merges the Claude updater guard without replacing user settings', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'predictor-claude-settings-'))
    const target = resolve(directory, 'settings.json')
    writeFileSync(target, JSON.stringify({ theme: 'dark', env: { KEEP: 'yes' } }))
    execFileSync('node', ['scripts/agent-tools/configure-claude-settings.mjs', target], { cwd: root })
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({
      theme: 'dark', env: { KEEP: 'yes', DISABLE_AUTOUPDATER: '1' },
    })
    expect(read('scripts/agent-tools/claude-review.sh')).toContain('export DISABLE_AUTOUPDATER=1')
    expect(read('scripts/agent-tools/cloud-conductor-claude-install.sh')).toContain('export DISABLE_AUTOUPDATER=1')
  })

  it('keeps MCP smoke initialization-only and classifies provider availability', () => {
    const readiness = read('scripts/agent-tools/mcp-readiness.sh')
    const fallback = read('scripts/agent-tools/netlify-mcp-fallback.sh')
    expect(readiness).toContain('opencode debug config')
    expect(readiness).toContain('opencode mcp list')
    expect(readiness).toContain('initialize/tools-list only')
    expect(readiness).toContain('UNAVAILABLE')
    expect(readiness).not.toMatch(/mcp\s+run|tools\/call/)
    expect(fallback).toContain('No automatic failover')
    expect(fallback).toContain('netlify-deploy-services-reader')
    expect(fallback).toContain("require('./config/agent-tools.json').netlifyMcp")
  })

  it('classifies failed MCP connections before positive ready text', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'predictor-mcp-readiness-'))
    const bin = resolve(home, '.local/bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(resolve(bin, 'opencode'), `#!/usr/bin/env bash
case "\${1:-}" in
  --version) printf '1.18.19\\n' ;;
  debug) exit 0 ;;
  mcp) cat <<'MCP'
  playwright  Connected
  chrome-devtools  Connected
  serena  Connected
  context7  Connected
  repomix  Connected
  supabase-dev  Connected (OAuth)
  supabase-prod  Connected (OAuth)
  netlify  Connected (OAuth)
  github  Connected
  sentry  Failed to connect: server not ready
  posthog  Connected (OAuth)
MCP
    ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 })

    const output = execFileSync('bash', ['scripts/agent-tools/mcp-readiness.sh', '--connectivity'], {
      cwd: root,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    })
    expect(output).toMatch(/CONFIGURED sentry\s+AUTH=UNKNOWN\s+CONNECTED=NO\s+UNAVAILABLE=NO/)
    expect(output).not.toMatch(/CONFIGURED sentry\s+.*CONNECTED=YES/)
  })
})
