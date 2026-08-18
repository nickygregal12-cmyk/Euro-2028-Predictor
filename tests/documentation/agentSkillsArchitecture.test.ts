import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

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
    // The INVARIANT, not one phrasing of it. This assertion named the exact
    // sentence 'navigation/indexing aid, not repository truth', and #845
    // reworded the skill to 'navigation-not repository truth' without touching
    // the test -- so main went red on a documentation rewrite that changed
    // nothing this test exists to protect. Two anchors replace it: the
    // subordination claim itself, and the fact that the skill still names the
    // authorities it defers to. Either being deleted is a real regression;
    // rewording the sentence around them is not.
    expect(plain(graph)).toContain('not repository truth')
    expect(graph).toContain('must never be cited as proof')
  })

  it('keeps Graphify optional and generated output disposable', () => {
    const graph = read(at(skills, 3))
    const guide = plain(read('docs/ops/graphify-navigation.md'))
    const gitignore = read('.gitignore')

    // Asserted on the PROPERTY rather than one exact sentence. Contract 197's
    // merge of #844 rewrote this skill and left both literals behind -- "If
    // Graphify OR A CURRENT GRAPH is unavailable" and "never a release or
    // product-CI gate" say the same two things in different words, and `main`
    // was red on this test until the assertions were widened to match.
    expect(graph).toMatch(
      /If Graphify[^.]*is unavailable, continue with normal repository search/i,
    )
    expect(graph).toMatch(/should not[^.]*add a runtime dependency/i)
    expect(graph).toMatch(
      /do not make CI depend on it|never a release or product-CI gate/i,
    )
    // `\s+` rather than a literal space: #844 reflowed this paragraph and the
    // phrase now spans a line break, which `toContain` cannot see.
    expect(guide).toMatch(/Graphify does not define product\s+behaviour/i)
    // The "do not promote graph output into the authority system" sentence was
    // replaced by #844 with a positive statement of the same boundary. Asserted
    // on the boundary rather than on either sentence.
    expect(guide).toMatch(
      /not a new documentation or RAG authority|Do not promote graph output into the repository authority system/i,
    )
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