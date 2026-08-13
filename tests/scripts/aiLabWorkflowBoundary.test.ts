import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

/**
 * The AI Lab workflow's operational boundary, asserted rather than reviewed.
 *
 * Two properties on this file were established on `main` and then nearly lost
 * to a rebase, which is why they are pinned here instead of being left to a
 * careful merge:
 *
 *   PRODUCTION IS THE DEFAULT. Every schedule, and the push trigger, run
 *   against Production. Development is reachable only by deliberately choosing
 *   it in a manual dispatch. An earlier revision defaulted to
 *   `AI_LAB_SCHEDULED_TARGET || development`, which quietly made Development
 *   the live lab and would have spent provider calls populating an environment
 *   nobody reads.
 *
 *   DEVELOPMENT NEVER CONSUMES A PAID CREDIT AUTOMATICALLY. No schedule and no
 *   push can select it, so the paid Odds API is only ever called on the
 *   environment whose budget is enabled.
 *
 * A third is new here: the forecasting path is gated on the target actually
 * holding contract 188, because merging a change to this very file starts a
 * Production run and a database below 188 would fail inside prediction with an
 * undefined relation.
 */

const workflowPath = resolve(process.cwd(), '.github/workflows/ai-lab.yml')
const source = readFileSync(workflowPath, 'utf8')
const workflow = parse(source) as {
  on: {
    push?: { branches: string[]; paths: string[] }
    schedule?: { cron: string }[]
    workflow_dispatch?: {
      inputs: Record<string, { default?: string; options?: string[] }>
    }
  }
  jobs: {
    run: {
      env: Record<string, string>
      steps: { name?: string; if?: string; run?: string; id?: string }[]
    }
  }
}

const steps = workflow.jobs.run.steps
const dispatch = workflow.on.workflow_dispatch?.inputs ?? {}

describe('the AI Lab runs against Production by default', () => {
  it('resolves the target to production when nothing chooses one', () => {
    expect(workflow.jobs.run.env.AI_ENV).toBe("${{ inputs.target || 'production' }}")
  })

  it('offers production first in the manual target list, and defaults to it', () => {
    expect(dispatch.target?.default).toBe('production')
    expect(dispatch.target?.options?.[0]).toBe('production')
  })

  it('never reintroduces an environment variable that could redirect a schedule', () => {
    // The exact shape that made Development the scheduled target.
    expect(source).not.toMatch(/AI_LAB_SCHEDULED_TARGET/)
    expect(source).not.toMatch(/\|\|\s*'development'/)
  })

  it('keeps every schedule and the push trigger on Production', () => {
    expect(workflow.on.schedule?.length).toBeGreaterThan(0)
    expect(workflow.on.push?.branches).toEqual(['main'])
    // Neither trigger supplies `inputs`, so both resolve through the default
    // above. Any step that hard-codes a target would break that.
    for (const step of steps) {
      expect(step.run ?? '').not.toMatch(/AI_ENV=development/)
    }
  })
})

describe('Development cannot be made to spend a paid credit by a schedule', () => {
  it('reaches development only through a manual dispatch choice', () => {
    expect(dispatch.target?.options).toContain('development')
    // `github.event_name == 'workflow_dispatch'` is the only gate under which
    // `inputs.target` is set at all; a schedule has no inputs.
    const resolver = steps.find((step) => step.id === 'task')?.run ?? ''
    expect(resolver).toMatch(/github\.event_name \}\}" = workflow_dispatch/)
    expect(resolver).not.toMatch(/development/)
  })

  it('runs the paid poll from the database rather than from this workflow', () => {
    // The only provider-spending path in the repository is the Production
    // database's own dispatcher. This workflow consumes what it retained.
    expect(source).toMatch(/reconcile_paid_fixture_evidence\.py/)
    expect(source).not.toMatch(/odds_api\.py live/)
  })

  it('keeps the reconciliation provider-free wherever it is invoked', () => {
    const reconcile = readFileSync(
      resolve(process.cwd(), 'ai/reconcile_paid_fixture_evidence.py'),
      'utf8',
    )
    expect(reconcile).toMatch(/makes no provider request/i)
    expect(reconcile).not.toMatch(/import\s+oddsapi|requests\.get|httpx/)
  })
})

describe('a merge does not run the forecasting path against a database that cannot serve it', () => {
  it('checks the contract before anything reads a prediction', () => {
    const check = steps.find((step) => step.id === 'schema')
    expect(check, 'the contract preflight is missing').toBeDefined()
    expect(check?.run).toMatch(/ai\.valid_predictions/)
    expect(check?.run).toMatch(/ai\.canonical_from_odds_api/)
  })

  it('gates every step that reads a prediction on it', () => {
    const gated = ['bootstrap-if-empty', 'morning', 'evening', 'free-odds']
    for (const task of gated) {
      const matching = steps.filter((step) => (step.if ?? '').includes(`'${task}'`))
      expect(matching.length, `no step runs task ${task}`).toBeGreaterThan(0)
      for (const step of matching) {
        expect(
          step.if,
          `${step.name} runs task ${task} without checking the contract`,
        ).toContain("steps.schema.outputs.ready == 'true'")
      }
    }
  })

  it('leaves import, training and the read-only studies ungated', () => {
    // They touch none of contract 188's objects, and gating them would make a
    // pending migration block work that does not need it.
    const manual = steps.find((step) => step.name === 'Run manual task')?.run ?? ''
    const experiments = manual.slice(manual.indexOf('experiments)'))
    expect(experiments).not.toContain('steps.schema.outputs.ready')
  })

  it('refuses rather than skips a manual dispatch that cannot work', () => {
    const manual = steps.find((step) => step.name === 'Run manual task')?.run ?? ''
    expect(manual).toMatch(/Refusing \$\{\{ steps\.task\.outputs\.name \}\}/)
    expect(manual).toMatch(/Refusing repair-identity/)
  })
})

describe('the studies are runnable and promote nothing', () => {
  it('offers every study the module implements', () => {
    const module = readFileSync(resolve(process.cwd(), 'ai/experiments.py'), 'utf8')
    const implemented = [...module.matchAll(/^ {4}"([a-z-]+)": study_/gm)].map((m) => m[1])
    expect(implemented.length).toBeGreaterThan(0)
    expect(dispatch.study?.options?.slice().sort()).toEqual(implemented.slice().sort())
  })

  it('records each study rather than only printing it', () => {
    const manual = steps.find((step) => step.name === 'Run manual task')?.run ?? ''
    expect(manual).toMatch(/experiments\.py --league .* --study .* --record/s)
  })

  it('trains and promotes nothing from a study', () => {
    const manual = steps.find((step) => step.name === 'Run manual task')?.run ?? ''
    const experiments = manual.slice(
      manual.indexOf('experiments)'),
      manual.indexOf('bootstrap|train|free-odds'),
    )
    expect(experiments).not.toMatch(/train\.py|promote/)
  })
})
