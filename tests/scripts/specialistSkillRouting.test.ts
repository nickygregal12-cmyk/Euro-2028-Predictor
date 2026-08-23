import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
  routes: string[]
  skills: RoutedSkill[]
  suppressedSkills: Array<{ name: string; reason: string }>
}

function route(...args: string[]): TaskPacket {
  const output = execFileSync('node', ['scripts/agent-tools/route-task.mjs', ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output) as TaskPacket
}

describe('specialist Agent Skills', () => {
  it('pins every external source to a full commit and keeps generated material out of git', () => {
    const registry = JSON.parse(read('config/agent-skill-sources.json')) as {
      cacheRoot: string
      sources: Record<string, {
        repository: string
        commit: string
        path: string
        entrypoint: string
        license: string
        mode: string
        adapter?: string
      }>
    }

    expect(registry.cacheRoot).toBe('.agent-cache/skills')
    expect(read('.gitignore')).toContain('.agent-cache/')
    expect(Object.keys(registry.sources).length).toBeGreaterThan(0)

    for (const [id, source] of Object.entries(registry.sources)) {
      expect(source.repository, id).toMatch(/^[\w.-]+\/[\w.-]+$/)
      expect(source.commit, id).toMatch(/^[0-9a-f]{40}$/)
      expect(source.path, id).not.toContain('..')
      expect(source.entrypoint, id).not.toContain('..')
      expect(source.entrypoint, id).not.toMatch(/^[/\\]/)
      expect(source.entrypoint, id).toMatch(/\.md$/)
      expect(['MIT', 'Apache-2.0', 'CC-BY-SA-4.0']).toContain(source.license)
      if (source.mode !== 'catalogue-only') {
        expect(source.adapter, id).toBeTruthy()
        expect(existsSync(resolve(root, `.agents/skills/${source.adapter}/SKILL.md`)), id).toBe(true)
      }
    }

    expect(registry.sources['insecure-defaults']?.entrypoint).toBe('commands/audit.md')
    expect(registry.sources['code-simplifier']?.entrypoint).toBe('agents/code-simplifier.md')
    expect(registry.sources['frontend-design']?.repository).toBe('pbakaus/impeccable')
    expect(registry.sources['frontend-design']?.path).toBe('.agents/skills/impeccable')
    expect(registry.sources['motion-craft']?.repository).toBe('emilkowalski/skills')
    expect(registry.sources['motion-craft']?.path).toBe('skills/animate')
    expect(registry.sources['ui-ux-pro-max']?.mode).toBe('catalogue-only')
    expect(registry.sources['taste-redesign']?.mode).toBe('catalogue-only')
    expect(execFileSync('git', ['ls-files', '.agent-cache'], { cwd: root, encoding: 'utf8' }).trim()).toBe('')
  })

  it('keeps routed adapter metadata and immutable sources in one-to-one sync', () => {
    const sources = JSON.parse(read('config/agent-skill-sources.json')) as {
      sources: Record<string, { adapter?: string; mode: string }>
    }
    const skills = JSON.parse(read('config/agent-skills.json')) as {
      skills: Record<string, { source?: string; mode: string }>
    }

    for (const [skillName, skill] of Object.entries(skills.skills)) {
      if (!skill.source) continue
      const source = sources.sources[skill.source]
      expect(source, skillName).toBeDefined()
      if (!source) continue
      expect(source.adapter, skillName).toBe(skillName)
      expect(source.mode, skillName).not.toBe('catalogue-only')
    }

    for (const [sourceName, source] of Object.entries(sources.sources)) {
      if (source.mode === 'catalogue-only') continue
      expect(source.adapter, sourceName).toBeTruthy()
      expect(skills.skills[source.adapter ?? '']?.source, sourceName).toBe(sourceName)
    }
  })

  it('validates the source catalogue without making a network call', () => {
    const registry = JSON.parse(read('config/agent-skill-sources.json')) as {
      sources: Record<string, unknown>
    }
    const output = execFileSync('node', ['scripts/agent-tools/materialize-skill.mjs', 'check'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(output).toContain(
      `Validated ${Object.keys(registry.sources).length} pinned specialist skill sources`,
    )
  })

  it('selects Impeccable-backed Predictor design plus UI review for a redesign task', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Redesign the vNext Home page',
    )
    expect(packet.routes).toContain('intentional-ui-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-motion-craft')
    expect(packet.skills.filter((skill) => skill.role === 'domain')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'review')).toHaveLength(1)
  })

  it('routes explicit motion work to the narrow Emil specialist without loading general design', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/app/CompetitionSwitcher.tsx',
      'The competition switcher animation feels sluggish',
    )
    expect(packet.routes).toContain('motion-craft')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-motion-craft')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-frontend-design')
    expect(packet.skills.filter((skill) => skill.role === 'specialist')).toHaveLength(1)
  })

  it('can add motion craft to an explicitly motion-heavy redesign without displacing design or review', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Redesign the vNext Home page and polish the entrance animation',
    )
    expect(packet.skills.map((skill) => skill.name)).toEqual(expect.arrayContaining([
      'predictor-frontend-design',
      'predictor-motion-craft',
      'predictor-ui-review',
    ]))
    expect(packet.skills).toHaveLength(3)
  })

  it('uses root-cause debugging for real-world does-nothing wording without stacking general design', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Fix Find a league — it does nothing',
    )
    expect(packet.routes).toContain('systematic-defect')
    expect(packet.routes).toContain('vnext-home')
    expect(packet.skills.filter((skill) => skill.role === 'process').map((skill) => skill.name)).toEqual([
      'predictor-systematic-debugging',
    ])
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-motion-craft')
  })

  it('routes React performance and component architecture to different domain specialists', () => {
    const performance = route(
      '--no-graph',
      '--path',
      'src/vnext/matches/VNextMatches.tsx',
      'Improve Match Centre rendering performance',
    )
    expect(performance.skills.filter((skill) => skill.role === 'domain').map((skill) => skill.name)).toEqual([
      'predictor-react-best-practices',
    ])

    const composition = route(
      '--no-graph',
      '--path',
      'src/vnext/leagues/VNextLeagues.tsx',
      'Refactor a prop-heavy component API using better composition patterns',
    )
    expect(composition.skills.filter((skill) => skill.role === 'domain').map((skill) => skill.name)).toEqual([
      'predictor-composition-patterns',
    ])
  })

  it('keeps ordinary layout polish on the normal UI route without motion or catalogue bloat', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/matches/VNextMatches.tsx',
      'Improve the Matches table spacing',
    )
    expect(packet.routes).toContain('vnext-matches')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-motion-craft')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-frontend-design')
  })

  it('uses design craft for new landing-page exploration while reference catalogues remain dormant', () => {
    const packet = route('--no-graph', 'Explore three visual directions for the pre-signup landing page')
    expect(packet.routes).toContain('intentional-ui-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('ui-ux-pro-max')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('taste-redesign')
  })

  it('adds Postgres guidance for database work and differential review only for sensitive changes', () => {
    const ordinary = route('--no-graph', 'Improve a Postgres query and database index')
    expect(ordinary.skills.map((skill) => skill.name)).toContain('predictor-postgres-best-practices')
    expect(ordinary.skills.map((skill) => skill.name)).not.toContain('predictor-differential-review')

    const sensitive = route('--no-graph', 'RLS change for a migration and permission change')
    expect(sensitive.skills.map((skill) => skill.name)).toContain('predictor-postgres-best-practices')
    expect(sensitive.skills.map((skill) => skill.name)).toContain('predictor-differential-review')
    expect(sensitive.skills.filter((skill) => skill.role === 'review')).toHaveLength(1)
  })

  it('keeps catalogue-only skills out of normal routed skill metadata', () => {
    const skills = JSON.parse(read('config/agent-skills.json')) as { skills: Record<string, unknown> }
    expect(skills.skills['web-design-guidelines']).toBeUndefined()
    expect(skills.skills['insecure-defaults']).toBeUndefined()
    expect(skills.skills['react-view-transitions']).toBeUndefined()
    expect(skills.skills['ui-ux-pro-max']).toBeUndefined()
    expect(skills.skills['taste-redesign']).toBeUndefined()
  })

  it('exposes materialization without adding a runtime dependency', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(packageJson.scripts['agent:skill']).toBe('node scripts/agent-tools/materialize-skill.mjs')
    expect(packageJson.dependencies.skills).toBeUndefined()
    expect(packageJson.devDependencies.skills).toBeUndefined()
  })
})
