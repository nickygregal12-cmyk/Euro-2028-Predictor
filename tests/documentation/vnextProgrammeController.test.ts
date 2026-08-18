import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

interface StageState {
  id: string
  name: string
  status: string
  pr: number | null
  contract: string
}

interface ProgrammeState {
  schemaVersion: number
  programme: string
  currentStage: string
  status: string
  lastMergedStage: string
  productionCutoverAuthorized: boolean
  completionPredicate: string
  stages: StageState[]
}

const state = JSON.parse(read('config/vnext-programme.json')) as ProgrammeState
const rootAgents = read('AGENTS.md')
const controller = read('docs/product/vnext-programme-controller.md')
const contracts = read('docs/product/vnext-stage-contracts.md')
const runner = read('.agents/skills/vnext-programme-runner/SKILL.md')

const allowedStatuses = new Set([
  'not_started',
  'in_progress',
  'review',
  'correction',
  'blocked',
  'merged',
])

const stageIds = ['8', '9', '10', '11', '12', '13', '14', '15']

const stableStageContracts = [
  ['9', '## Stage 9 — Leagues', 'people-I-compete-with'],
  ['10', '## Stage 10 — Player Profiles + H2H', 'How do we compare?'],
  ['11', '## Stage 11 — Last Man Standing', 'One consequential pick → survive or be eliminated.'],
  ['12', '## Stage 12 — Predictor Championship', 'what must I do next'],
  ['13', '## Stage 13 — Supporting Surfaces', 'route-matrix obligations'],
  ['14', '## Stage 14 — Football Hub Production Cutover', 'READY FOR CUTOVER'],
  ['15', '## Stage 15 — Euro 2028 vNext Adoption', 'convergence where the products genuinely share concepts'],
] as const

describe('vNext programme controller', () => {
  it('keeps one sequential machine-readable programme state', () => {
    expect(state.schemaVersion).toBe(1)
    expect(state.programme).toBe('vnext')
    expect(state.stages.map((stage) => stage.id)).toEqual(stageIds)
    expect(state.stages.every((stage) => allowedStatuses.has(stage.status))).toBe(true)
    expect(state.stages.some((stage) => stage.id === state.currentStage)).toBe(true)

    const currentIndex = state.stages.findIndex((stage) => stage.id === state.currentStage)
    expect(currentIndex).toBeGreaterThanOrEqual(0)

    for (const [index, stage] of state.stages.entries()) {
      if (index < currentIndex) expect(stage.status, stage.id).toBe('merged')
      if (index > currentIndex) expect(stage.status, stage.id).toBe('not_started')
    }

    expect(state.stages[currentIndex]?.status).not.toBe('merged')
  })

  it('makes the programme runner discoverable from the root agent router', () => {
    expect(rootAgents).toContain('vNext multi-stage programme / resume Stages 8–15')
    expect(rootAgents).toContain('.agents/skills/vnext-programme-runner/SKILL.md')
    expect(rootAgents).toContain('docs/product/vnext-programme-controller.md')
    expect(rootAgents).toContain('config/vnext-programme.json')
  })

  it('binds stages 9-15 to stable mission, boundary and completion contracts', () => {
    for (const [id, heading, semanticAnchor] of stableStageContracts) {
      const stage = state.stages.find((candidate) => candidate.id === id)
      expect(stage?.contract, id).toContain('docs/product/vnext-stage-contracts.md#stage-')
      expect(contracts, heading).toContain(heading)
      expect(contracts, semanticAnchor).toContain(semanticAnchor)
    }

    expect(contracts).toContain('### Stage 9 does not own')
    expect(contracts).toContain('### Stage 10 does not own')
    expect(contracts).toContain('### Stage 11 does not own')
    expect(contracts).toContain('### Stage 12 does not own')
    expect(contracts).toContain('### Stage 13 does not own')
    expect(contracts).toContain('### Stage 14 does not own')
    expect(contracts).toContain('### Stage 15 does not own')
    expect(contracts.match(/### Minimum completion predicate/g)).toHaveLength(7)
    expect(runner).toContain('Do not reinterpret a stage from its short name alone')
    expect(controller).toContain('what each stage is for, what it must deliver, and what it must not absorb')
  })

  it('keeps stable stage scope separate from current implementation details', () => {
    expect(contracts).toContain('does **not** freeze implementation details')
    expect(runner).toContain('Stage contracts are stable; implementation briefs are derived')
    expect(runner).toContain('backend contracts that have actually merged')
    expect(controller).toContain('derive the exact implementation plan from current `main`')
  })

  it('makes programme completion larger than one PR or stage', () => {
    expect(state.completionPredicate).toBe(
      'stages_8_through_15_merged_and_final_programme_audit_green',
    )
    expect(controller).toContain('Do not stop merely because a PR or stage completes')
    expect(runner).toContain('Do not stop merely because')
    expect(runner).toContain('continue immediately into the next stage')
  })

  it('requires exact-head repair, review and merge loops rather than weakened gates', () => {
    expect(controller).toContain('exact-head required CI is green')
    expect(controller).toContain('separate narrow baseline-repair PR')
    expect(controller).toContain('Do not weaken a gate to make the loop progress')
    expect(runner).toContain('Inherited from current main')
    expect(runner).toContain('independent-style review pass')
    expect(runner).toContain('Blocker/Important')
  })

  it('forces fresh repository state at every resume and stage transition', () => {
    expect(controller).toContain('immediately re-read current `main`')
    expect(runner).toContain('fetch current `main`')
    expect(runner).toContain("Never trust a previous chat's SHA")
    expect(runner).toContain('implementation briefs are derived')
  })

  it('keeps the Production cutover behind an explicit authority gate', () => {
    expect(typeof state.productionCutoverAuthorized).toBe('boolean')
    expect(controller).toContain('explicit Production gate')
    expect(controller).toContain('must **not mutate Production merely because Stage 14 is next**')
    expect(runner).toContain('Never flip it to make the loop continue')
    expect(contracts).toContain('actual production switch **only when explicitly authorised**')
  })

  it('does not create a second moving contract or hosted-state authority', () => {
    for (const source of [controller, contracts, runner]) {
      expect(source).not.toMatch(/repository is at contract\s+\d+/i)
      expect(source).not.toMatch(/production (?:is|=|at) contract\s+\d+/i)
      expect(source).not.toMatch(/development (?:is|=|at) contract\s+\d+/i)
      expect(source).not.toMatch(/current main sha/i)
    }
  })
})
