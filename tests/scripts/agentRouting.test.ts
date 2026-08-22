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
    expect(registry.budget.specialist).toBe(1)
    expect(registry.budget.review).toBe(1)
    expect(registry.budget.critic).toBe(1)

    for (const routeEntry of routing.routes) {
      for (const authority of routeEntry.authorities ?? []) {
        expect(existsSync(resolve(root, authority)), authority).toBe(true)
      }
      for (const skillName of routeEntry.skills ?? []) {
        const skill = registry.skills[skillName]
        if (!skill) throw new Error(`unregistered routed skill: ${skillName}`)
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

  it('routes genuine idea exploration to brainstorming without making it a default implementation process', () => {
    const packet = route('--no-graph', 'I have a new idea; brainstorm approaches for a private league challenge')

    expect(packet.routes).toContain('product-brainstorming')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-product-brainstorming')
    expect(packet.skills.filter((skill) => skill.role === 'process')).toHaveLength(1)
  })

  it('turns a broad improve prompt into bounded product opportunity plus football critique', () => {
    const packet = route('--no-graph', 'Improve Match Centre UI')
    const names = packet.skills.map((skill) => skill.name)

    expect(packet.routes).toContain('product-opportunity')
    expect(packet.routes).toContain('vnext-matches')
    expect(names).toEqual([
      'predictor-product-opportunity-scout',
      'predictor-football-experience-critic',
      'predictor-ui-review',
    ])
    expect(packet.skills.filter((skill) => skill.role === 'process')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'specialist')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'review')).toHaveLength(1)
  })

  it('keeps a named performance technique out of broad product opportunity discovery', () => {
    const packet = route('--no-graph', 'Improve Match Centre rendering performance')
    const names = packet.skills.map((skill) => skill.name)

    expect(packet.routes).not.toContain('product-opportunity')
    expect(names).toContain('predictor-react-best-practices')
    expect(names).toContain('predictor-ui-review')
    expect(names).not.toContain('predictor-product-opportunity-scout')
    expect(names).not.toContain('predictor-football-experience-critic')
  })

  it('routes finish/release-ready language to the journey closer rather than product ideation', () => {
    const packet = route('--no-graph', 'Finish the vNext Match Predictor journey properly and make it release ready')
    const names = packet.skills.map((skill) => skill.name)

    expect(packet.routes).toContain('release-journey-closure')
    expect(packet.routes).toContain('vnext-predictor')
    expect(names).toContain('predictor-release-journey-closer')
    expect(names).toContain('predictor-ui-review')
    expect(names).not.toContain('predictor-product-opportunity-scout')
  })

  it('routes explicit player state completeness to the state-matrix specialist', () => {
    const packet = route('--no-graph', 'Review vNext Match Predictor loading, empty, locked, live and error states')
    const names = packet.skills.map((skill) => skill.name)

    expect(packet.routes).toContain('player-state-matrix')
    expect(packet.routes).toContain('vnext-predictor')
    expect(names).toContain('predictor-player-state-matrix')
    expect(names).toContain('predictor-ui-review')
    expect(names).not.toContain('predictor-product-opportunity-scout')
  })

  it('routes hosted migration work through explicit environment identity before database craft', () => {
    const packet = route('--no-graph', 'Apply the next migration to Development and update the hosted contract record')
    const names = packet.skills.map((skill) => skill.name)

    expect(packet.routes).toContain('environment-contract')
    expect(packet.routes).toContain('database')
    expect(names).toContain('predictor-environment-contract-guardian')
    expect(names).toContain('predictor-postgres-best-practices')
    expect(names).not.toContain('predictor-spec-driven-delivery')
    expect(packet.suppressedSkills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'predictor-spec-driven-delivery' }),
      ]),
    )
  })

  it('gives competitive truth a dedicated review lens', () => {
    const packet = route('--no-graph', 'Review this scoring and prediction reveal change for competitive integrity')

    expect(packet.routes).toContain('competitive-integrity')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-competitive-integrity')
    expect(packet.skills.find((skill) => skill.name === 'predictor-competitive-integrity')?.role).toBe('review')
  })

  it('routes behaviour-preserving cleanup to the simplification specialist', () => {
    const packet = route('--no-graph', 'Simplify the recent Match Centre changes without changing behaviour')

    expect(packet.routes).toContain('code-simplification')
    expect(packet.routes).toContain('vnext-matches')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-code-simplification')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
    expect(packet.skills.filter((skill) => skill.role === 'specialist')).toHaveLength(1)
  })

  it('does not load simplification for cleanup wording on a broken journey', () => {
    const packet = route('--no-graph', 'Clean up this broken journey and fix the bug')
    const names = packet.skills.map((skill) => skill.name)

    expect(packet.routes).toContain('systematic-defect')
    expect(packet.routes).not.toContain('code-simplification')
    expect(packet.routes).not.toContain('product-opportunity')
    expect(names).toContain('predictor-systematic-debugging')
    expect(names).not.toContain('predictor-code-simplification')
    expect(names).not.toContain('predictor-product-opportunity-scout')
  })

  it('routes skill efficacy work to the evaluation domain without loading unrelated product skills', () => {
    const packet = route('--no-graph', 'Benchmark this skill and measure its trigger accuracy')

    expect(packet.routes).toContain('skill-evaluation')
    expect(packet.skills.map((skill) => skill.name)).toEqual(['predictor-skill-evaluator'])
    expect(packet.authorities).toEqual(['docs/ops/agent-skills-architecture.md'])
  })

  it('keeps independent-model criticism separate from the normal repository review slot', () => {
    const packet = route('--no-graph', 'Pressure-test this architecture review with an independent model')

    expect(packet.routes).toContain('independent-second-opinion')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-second-opinion')
    expect(packet.skills.find((skill) => skill.name === 'predictor-second-opinion')?.role).toBe('critic')
  })

  it('does not spend an independent critic on a routine architecture review', () => {
    const packet = route('--no-graph', 'Review the architecture of this component boundary')

    expect(packet.routes).not.toContain('independent-second-opinion')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-second-opinion')
  })

  it('routes compound learning only when a reusable lesson is deliberately being captured', () => {
    const packet = route('--no-graph', 'Capture reusable lesson from this completed PR')

    expect(packet.routes).toContain('compound-learning')
    expect(packet.skills.map((skill) => skill.name)).toEqual(['predictor-compound-learning'])
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
