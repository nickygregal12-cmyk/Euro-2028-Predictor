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
    expect(Object.keys(registry.sources)).toHaveLength(9)

    for (const [id, source] of Object.entries(registry.sources)) {
      expect(source.repository, id).toMatch(/^[\w.-]+\/[\w.-]+$/)
      expect(source.commit, id).toMatch(/^[0-9a-f]{40}$/)
      expect(source.path, id).not.toContain('..')
      expect(source.entrypoint, id).toBe('SKILL.md')
      expect(['MIT', 'Apache-2.0', 'CC-BY-SA-4.0']).toContain(source.license)
      if (source.mode !== 'catalogue-only') {
        expect(source.adapter, id).toBeTruthy()
        expect(existsSync(resolve(root, `.agents/skills/${source.adapter}/SKILL.md`)), id).toBe(true)
      }
    }

    expect(execFileSync('git', ['ls-files', '.agent-cache'], { cwd: root, encoding: 'utf8' }).trim()).toBe('')
  })

  it('validates the source catalogue without making a network call', () => {
    const output = execFileSync('node', ['scripts/agent-tools/materialize-skill.mjs', 'check'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(output).toContain('Validated 9 pinned specialist skill sources')
  })

  it('selects frontend design plus Predictor UI review for a real redesign task', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/leagues/VNextLeagues.tsx',
      'Redesign the vNext Leagues page with a more premium UI',
    )
    expect(packet.routes).toContain('intentional-ui-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
    expect(packet.skills.filter((skill) => skill.role === 'domain')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'review')).toHaveLength(1)
  })

  it('uses root-cause debugging for a release blocker without stacking another process', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/leagues/VNextLeagues.tsx',
      'Release blocker: the player row does not work; reproduce and find root cause',
    )
    expect(packet.routes).toContain('systematic-defect')
    expect(packet.skills.filter((skill) => skill.role === 'process').map((skill) => skill.name)).toEqual([
      'predictor-systematic-debugging',
    ])
  })

  it('routes React performance and component architecture to different domain specialists', () => {
    const performance = route(
      '--no-graph',
      '--path',
      'src/vnext/leagues/VNextLeagues.tsx',
      'Investigate a React performance rerender regression',
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
