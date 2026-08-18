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
const controller = read('docs/product/vnext-programme-controller.md')
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
    expect(runner).toContain('Stage briefs are derived, not frozen')
  })

  it('keeps the Production cutover behind an explicit authority gate', () => {
    expect(typeof state.productionCutoverAuthorized).toBe('boolean')
    expect(controller).toContain('explicit Production gate')
    expect(controller).toContain('must **not mutate Production merely because Stage 14 is next**')
    expect(runner).toContain('Never flip it to make the loop continue')
  })

  it('does not create a second moving contract or hosted-state authority', () => {
    for (const source of [controller, runner]) {
      expect(source).not.toMatch(/repository is at contract\s+\d+/i)
      expect(source).not.toMatch(/production (?:is|=|at) contract\s+\d+/i)
      expect(source).not.toMatch(/development (?:is|=|at) contract\s+\d+/i)
      expect(source).not.toMatch(/current main sha/i)
    }
  })
})
