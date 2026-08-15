import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const plain = (source: string) => source.replace(/[*_`]/g, '')

const skills = [
  '.agents/skills/predictor-context/SKILL.md',
  '.agents/skills/predictor-ui-review/SKILL.md',
  '.agents/skills/predictor-ai-lab-verifier/SKILL.md',
  '.agents/skills/predictor-graph-navigation/SKILL.md',
]

describe('project-specific agent skills', () => {
  it('uses discoverable directory-form skills with frontmatter', () => {
    for (const path of skills) {
      const source = read(path)
      expect(source.startsWith('---\nname: '), path).toBe(true)
      expect(source).toContain('\ndescription: ')
      expect(source).toContain('\n---\n')
    }
  })

  it('keeps the skills subordinate to repository authorities', () => {
    const context = read(skills[0])
    const ui = read(skills[1])
    const ai = read(skills[2])
    const graph = read(skills[3])

    expect(context).toContain('Existing repository authorities always outrank this skill')
    expect(plain(ui)).toContain('critics, never authorities')
    expect(ai).toContain('The normal selected-model activation is automatic')
    expect(ai).toContain('Do not reintroduce a routine browser/admin click as a second model-selection authority')
    expect(ai).toContain('an arbitrary/newest challenger being mistaken for the evidence-selected policy winner')
    expect(ai).toContain('ai/train_verified.py')
    expect(graph).toContain('navigation/indexing aid, not repository truth')
  })

  it('keeps Graphify optional and generated output disposable', () => {
    const graph = read(skills[3])
    const guide = plain(read('docs/ops/graphify-navigation.md'))
    const gitignore = read('.gitignore')

    expect(graph).toContain('If Graphify is unavailable, continue with normal repository search')
    expect(graph).toMatch(/should not[^.]*add a runtime dependency/i)
    expect(graph).toContain('do not make CI depend on it')
    expect(guide).toContain('Graphify does not define product behaviour')
    expect(guide).toContain('Do not promote graph output into the repository authority system')
    expect(guide).toMatch(/Do not enable Graphify strict\/always-on hooks as a repository default/i)
    expect(gitignore).toMatch(/^graphify-out\/$/m)
  })

  it('does not create a second moving contract/status authority', () => {
    const architecture = read('docs/ops/agent-skills-architecture.md')
    expect(architecture).toContain('creates no product, scoring, lock, membership')
    expect(architecture).toContain('progressive disclosure')
    expect(architecture).toContain('PR #783')
    expect(architecture).toContain('train_verified.py')

    for (const source of [architecture, ...skills.map(read)]) {
      expect(source).not.toMatch(/repository is at contract\s+\d+/i)
      expect(source).not.toMatch(/production (?:is|=|at) contract\s+\d+/i)
      expect(source).not.toMatch(/development (?:is|=|at) contract\s+\d+/i)
    }
  })
})