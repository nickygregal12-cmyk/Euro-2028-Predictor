import { readFileSync } from 'node:fs'
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
      claudeCode?: { repository?: string; version?: string; mode?: string }
    }

    expect(ox).toContain('--agent predictor-critic')
    expect(ox).toContain('--model openrouter/stealth/ox-alpha')
    expect(ox).toContain('--attach "$attach_url"')
    expect(ox).toContain('OPENROUTER_API_KEY')
    expect(ox).not.toContain('echo "$OPENROUTER_API_KEY"')

    expect(claude).toContain('claude auth status')
    expect(claude).toContain('--permission-mode plan')
    expect(claude).toContain('ANTHROPIC_API_KEY')
    expect(claude).toContain('Refusing Claude review')
    expect(claude).not.toContain('--console')

    expect(tools.claudeCode?.repository).toBe('anthropics/claude-code')
    expect(tools.claudeCode?.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(tools.claudeCode?.mode).toBe('optional-subscription-agent')
    expect(claudeInstall).toContain("require('./config/agent-tools.json').claudeCode.version")
    expect(claudeInstall).toContain('https://claude.ai/install.sh')
    expect(claudeInstall).toContain('claude auth login')
    expect(claudeInstall).toContain('ANTHROPIC_API_KEY')
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

    expect(doctor).toContain('Default web agent')
    expect(doctor).toContain('Local auth boundary')
    expect(doctor).toContain('tailscale serve status')
    expect(doctor).toContain('gh auth status')
    expect(doctor).toContain('claude auth status')
    expect(doctor).toContain('Ox live review bridge')
    expect(doctor).toContain('--live')
  })
})
