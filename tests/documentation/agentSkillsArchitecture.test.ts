import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

const root = resolve(import.meta.dirname, '../..')

const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const plain = (source: string) => source.replace(/[*_`]/g, '')
// Authority prose is hard-wrapped, so semantic phrases are asserted wrap-insensitively.
const flow = (source: string) => plain(source).replace(/\s+/g, ' ')

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
    const context = read(at(skills, 0))
    const ui = read(at(skills, 1))
    const ai = read(at(skills, 2))
    const graph = read(at(skills, 3))

    expect(context).toContain('Existing repository authorities always outrank this skill')
    expect(plain(ui)).toContain('critics, never authorities')
    expect(ai).toContain('The normal selected-model activation is automatic')
    expect(ai).toContain('Do not reintroduce a routine browser/admin click as a second model-selection authority')
    expect(ai).toContain('an arbitrary/newest challenger being mistaken for the evidence-selected policy winner')
    expect(ai).toContain('ai/train_verified.py')
    expect(graph).toContain('navigation/indexing aid, not repository truth')
  })

  it('keeps Graphify optional and never a release gate', () => {
    const graph = flow(read(at(skills, 3)))
    const guide = flow(read('docs/ops/graphify-navigation.md'))

    // Optional: a missing tool *or* a missing/stale graph both fall back to normal search.
    for (const source of [graph, guide]) {
      expect(source).toContain(
        'If Graphify or a current graph is unavailable, continue with normal repository search',
      )
      expect(source).toContain('Do not block a task on installation or graph generation')
    }

    // Not a release gate: the workflow is non-blocking and freshness gates nothing.
    expect(graph).toContain('The workflow is intentionally non-blocking')
    expect(graph).toContain('graph freshness is never a release or product-CI gate')
    expect(guide).toContain('The workflow is deliberately non-blocking')
    expect(guide).toContain(
      'A Graphify failure must not make product CI, release readiness or database evidence fail',
    )

    // No runtime dependency, no release gate, no second project-memory authority.
    expect(graph).toMatch(/should not[^.]*add a runtime dependency/i)
    expect(graph).toMatch(/should not[^.]*become a release gate/i)
    expect(graph).toMatch(/should not[^.]*create another project-memory authority/i)
  })

  it('keeps graph output subordinate and disposable', () => {
    const graph = flow(read(at(skills, 3)))
    const guide = flow(read('docs/ops/graphify-navigation.md'))
    const gitignore = read('.gitignore')

    // Graph output is never a second repository authority.
    expect(graph).toContain(
      'must never be cited as proof that a product rule, hosted state, database contract or release claim is true',
    )
    expect(guide).toContain(
      'Graphify does not define product behaviour, database contracts, model authority, hosted state or release status',
    )
    expect(guide).toContain(
      'Never make a Production, database, model-promotion or security claim from the generated graph alone',
    )
    expect(guide).toMatch(/Do not enable Graphify strict\/always-on hooks as a repository default/i)

    // Generated output stays disposable and out of application branches.
    expect(graph).toContain('Normal application branches keep graphify-out/ gitignored')
    expect(graph).toContain(
      'Caches, manifests, interpreter paths and detection sidecars stay disposable and are not published',
    )
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