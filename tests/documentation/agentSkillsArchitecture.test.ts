import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const skills = [
  '.agents/skills/predictor-context/SKILL.md',
  '.agents/skills/predictor-ui-review/SKILL.md',
  '.agents/skills/predictor-ai-lab-verifier/SKILL.md',
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

    expect(context).toContain('Existing repository authorities always outrank this skill')
    expect(ui).toContain('critics, never authorities')
    expect(ai).toContain('promotion remains an explicit human/admin authority action')
  })

  it('does not create a second moving contract/status authority', () => {
    const architecture = read('docs/ops/agent-skills-architecture.md')
    expect(architecture).toContain('creates no product, scoring, lock, membership')
    expect(architecture).toContain('progressive disclosure')
    expect(architecture).toContain('PR #783')

    for (const source of [architecture, ...skills.map(read)]) {
      expect(source).not.toMatch(/repository is at contract\s+\d+/i)
      expect(source).not.toMatch(/production (?:is|=|at) contract\s+\d+/i)
      expect(source).not.toMatch(/development (?:is|=|at) contract\s+\d+/i)
    }
  })
})
