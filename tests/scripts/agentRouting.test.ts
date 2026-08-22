import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

interface RoutedSkill {
  name: string
  role: string
  path: string
}

interface TaskPacket {
  orientation: { graphify: string; budget: number | null }
  routes: string[]
  candidatePaths: string[]
  authorities: string[]
  skills: RoutedSkill[]
  suppressedSkills: Array<{ name: string; reason: string }>
}

function route(...args: string[]): TaskPacket {
  const output = execFileSync(
    'node',
    ['scripts/agent-tools/route-task.mjs', ...args, '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  return JSON.parse(output) as TaskPacket
}

describe('bounded agent task routing', () => {
  it('keeps every routing pointer attached to a real authority or registered skill', () => {
    const routing = JSON.parse(read('config/agent-routing.json')) as {
      maxAuthorities: number
      routes: Array<{ authorities?: string[]; skills?: string[] }>
    }
    const registry = JSON.parse(read('config/agent-skills.json')) as {
      budget: Record<string, number>
      skills: Record<string, { path: string; role: string }>
    }

    expect(routing.maxAuthorities).toBeLessThanOrEqual(4)
    expect(registry.budget.process).toBe(1)
    expect(registry.budget.domain).toBe(1)
    expect(registry.budget.review).toBe(1)

    for (const routeEntry of routing.routes) {
      for (const authority of routeEntry.authorities ?? []) {
        expect(existsSync(resolve(root, authority)), authority).toBe(true)
      }
      for (const skillName of routeEntry.skills ?? []) {
        const skill = registry.skills[skillName]
        expect(skill, skillName).toBeDefined()
        expect(existsSync(resolve(root, skill.path)), skill.path).toBe(true)
      }
    }
  })

  it('routes one Leagues file to Leagues authority without loading unrelated vNext systems', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/leagues/VNextLeagues.tsx',
      'Fix player row navigation in vNext Leagues',
    )

    expect(packet.orientation.graphify).toBe('skipped')
    expect(packet.routes).toContain('vnext-leagues')
    expect(packet.routes).toContain('vnext-general')
    expect(packet.authorities).toContain('docs/product/ui.md')
    expect(packet.authorities).toContain('docs/product/vnext-leagues.md')
    expect(packet.authorities).not.toContain('docs/product/vnext-lms.md')
    expect(packet.authorities).not.toContain('docs/product/vnext-championship.md')
    expect(packet.skills.map((skill) => skill.name)).toEqual(['predictor-ui-review'])
  })

  it('adds one delivery process skill for a genuinely multi-file UI working set', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/leagues/VNextLeagues.tsx',
      '--path',
      'src/vnext/app/VNextShellProvider.tsx',
      'Repair the League-to-profile shell journey',
    )

    const roles = packet.skills.map((skill) => skill.role)
    expect(packet.authorities.length).toBeLessThanOrEqual(4)
    expect(packet.authorities).toContain('docs/product/vnext-leagues.md')
    expect(packet.authorities).toContain('docs/product/vnext-shell-ia.md')
    expect(roles.filter((role) => role === 'process')).toHaveLength(1)
    expect(roles.filter((role) => role === 'review')).toHaveLength(1)
    expect(packet.skills.map((skill) => skill.name)).toContain(
      'predictor-spec-driven-delivery',
    )
  })

  it('selects the compact context process for an explicit broad repository audit', () => {
    const packet = route('--no-graph', 'Do a broad repository audit and handoff')

    expect(packet.routes).toContain('broad-investigation')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-context')
    expect(packet.skills.filter((skill) => skill.role === 'process')).toHaveLength(1)
  })

  it('keeps the vNext scoped router small enough for progressive disclosure', () => {
    const vnextRouter = read('src/vnext/AGENTS.md')
    const bytes = statSync(resolve(root, 'src/vnext/AGENTS.md')).size

    expect(bytes).toBeLessThan(10_000)
    expect(vnextRouter).toContain('Surface authority routing')
    expect(vnextRouter).toContain('npm run agent:route')
    expect(vnextRouter).toContain('Do not preload Matches, Leagues, Profiles, LMS and Championship')
  })

  it('exposes the router through package scripts', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['agent:route']).toBe(
      'node scripts/agent-tools/route-task.mjs',
    )
  })
})
