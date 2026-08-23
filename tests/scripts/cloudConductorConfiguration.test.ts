import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('persistent private cloud Conductor', () => {
  it('keeps one write-capable Claude builder behind a read-only GPT conductor and Ox critic', () => {
    const conductor = read('.opencode/agents/predictor-conductor.md')
    const builder = read('.opencode/agents/predictor-builder.md')
    const critic = read('.opencode/agents/predictor-critic.md')

    expect(conductor).toContain('mode: primary')
    expect(conductor).toContain('model: openrouter/openai/gpt-5.6-sol')
    expect(conductor).toContain('edit: deny')
    expect(conductor).toContain('"predictor-builder": allow')
    expect(conductor).toContain('"predictor-critic": allow')
    expect(conductor).toContain('Do not treat agreement as evidence')

    expect(builder).toContain('mode: subagent')
    expect(builder).toContain('model: openrouter/anthropic/claude-sonnet-5')
    expect(builder).toContain('edit: allow')
    expect(builder).toContain('"git push*": ask')
    expect(builder).toContain('"gh pr create*": ask')

    expect(critic).toContain('mode: subagent')
    expect(critic).toContain('model: openrouter/stealth/ox-alpha')
    expect(critic).toContain('edit: deny')
    expect(critic).toContain('independent read-only critic')

    for (const config of [conductor, builder, critic]) {
      expect(config).not.toContain('sk-or-')
      expect(config).not.toContain('--auto')
      expect(config).toContain('AGENTS.md')
      expect(config).toContain('NOW.md')
    }
  })

  it('keeps the persistent web service localhost-only, password-protected and tailnet-routed', () => {
    const installer = read('scripts/agent-tools/cloud-conductor-install.sh')
    const doctor = read('scripts/agent-tools/cloud-conductor-doctor.sh')

    expect(installer).toContain('Ubuntu 24.04 LTS')
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

    expect(doctor).toContain('Local auth boundary')
    expect(doctor).toContain('tailscale serve status')
    expect(doctor).toContain('gh auth status')
  })
})
