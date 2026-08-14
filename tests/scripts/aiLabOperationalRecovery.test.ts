import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const schedulerSql = readFileSync(
  resolve(process.cwd(), 'scripts/database-rollout/ai-odds-scheduler-reconcile.sql'),
  'utf8',
)
const schedulerWorkflowSource = readFileSync(
  resolve(process.cwd(), '.github/workflows/ai-odds-scheduler-reconcile.yml'),
  'utf8',
)
const schedulerWorkflow = parse(schedulerWorkflowSource) as {
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown }
  env: Record<string, string>
  jobs: Record<string, { steps: { name?: string; run?: string }[] }>
}

const catchupSource = readFileSync(
  resolve(process.cwd(), '.github/workflows/ai-lab-value-catchup.yml'),
  'utf8',
)
const catchup = parse(catchupSource) as {
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown }
  concurrency?: { group?: string }
  jobs: Record<string, { steps: { name?: string; run?: string }[] }>
}

const materializeSource = readFileSync(
  resolve(process.cwd(), '.github/workflows/ai-selected-challenger-materialize.yml'),
  'utf8',
)
const materialize = parse(materializeSource) as {
  on: { workflow_dispatch?: { inputs?: Record<string, { default?: string }> } }
  jobs: Record<string, { steps: { name?: string; run?: string }[] }>
}

describe('paid odds scheduling recovers from a missed cron minute', () => {
  it('replaces the four brittle DST twins with one five-minute heartbeat', () => {
    for (const legacy of [
      'ai-odds-tuesday-bst',
      'ai-odds-tuesday-gmt',
      'ai-odds-friday-bst',
      'ai-odds-friday-gmt',
    ]) {
      expect(schedulerSql).toContain(legacy)
    }
    expect(schedulerSql).toContain("'ai-odds-window-heartbeat'")
    expect(schedulerSql).toContain("'*/5 * * * *'")
    expect(schedulerSql).toMatch(/cron\.unschedule/)
    expect(schedulerSql).toMatch(/cron\.schedule/)
  })

  it('keeps the London collection window but admits a bounded retry band', () => {
    expect(schedulerSql).toMatch(/time zone 'Europe\/London'/)
    expect(schedulerSql).toMatch(/extract\(isodow[^]*= 2/)
    expect(schedulerSql).toMatch(/extract\(isodow[^]*= 5/)
    expect(schedulerSql).toMatch(/between 30 and 44/)
  })

  it('cannot dispatch twice inside one collection window', () => {
    expect(schedulerSql).toMatch(/not exists[\s\S]*ai\.odds_api_dispatches/)
    expect(schedulerSql).toMatch(/interval '45 minutes'/)
  })

  it('reconciles Production daily and proves its own run spent no paid credit', () => {
    expect(schedulerWorkflow.on.schedule?.map((x) => x.cron)).toContain('20 4 * * *')
    expect(schedulerWorkflow.env.PRODUCTION_PROJECT_REF).toBe('vkfnsqdyhvtwyqkisxhk')
    const runs = Object.values(schedulerWorkflow.jobs)
      .flatMap((job) => job.steps)
      .map((step) => step.run ?? '')
      .join('\n')
    expect(runs).toMatch(/ai\.api_usage/)
    expect(runs).toMatch(/diff -u \/tmp\/ai-odds-usage-before \/tmp\/ai-odds-usage-after/)
    expect(runs).not.toMatch(/dispatch_ai_odds_polls\s*\(/)
    expect(runs).not.toMatch(/odds_api\.py\s+live/)
  })
})

describe('a delayed GitHub schedule cannot silently lose the value pass', () => {
  const runs = Object.values(catchup.jobs)
    .flatMap((job) => job.steps)
    .map((step) => step.run ?? '')
    .join('\n')

  it('serialises against the primary Production AI Lab workflow', () => {
    expect(catchup.concurrency?.group).toBe('ai-lab-production')
  })

  it('decides from durable job evidence rather than runner wall-clock hour', () => {
    expect(runs).toMatch(/ai\.job_runs/)
    expect(runs).toMatch(/job = 'find_value'/)
    expect(runs).toMatch(/count\(distinct league\)/)
    expect(runs).not.toMatch(/TZ=Europe\/London date/)
  })

  it('recovers the same reconciliation and nine-league value path without paid collection', () => {
    expect(runs).toMatch(/sync_fixtures\.py/)
    expect(runs).toMatch(/reconcile_paid_fixture_evidence\.py/)
    expect(runs).toMatch(/fetch_fixtures_odds\.py/)
    expect(runs).toMatch(/run_leagues\.sh find_value\.py/)
    expect(runs).not.toMatch(/odds_api\.py\s+live/)
    expect(runs).not.toMatch(/dispatch_ai_odds_polls/)
  })

  it('fails unless all nine leagues leave successful value-job evidence', () => {
    expect(runs).toMatch(/\[ "\$\{completed\}" -eq 9 \]/)
    expect(runs).toMatch(/interval '90 minutes'/)
  })
})

describe('the replacement selected challenger set is reproducibility-gated', () => {
  const steps = Object.values(materialize.jobs).flatMap((job) => job.steps)
  const verification = steps.find((step) => step.name?.includes('reproducibility'))?.run ?? ''

  it('materialises a new immutable version rather than reusing the pre-gate v1 rows', () => {
    expect(materialize.on.workflow_dispatch?.inputs?.version?.default)
      .toBe('selected-20260814-v2')
  })

  it('requires both deterministic fingerprints and the reloaded prediction oracle', () => {
    expect(verification).toMatch(/training_data_sha256/)
    expect(verification).toMatch(/bundle_contract_sha256/)
    expect(verification).toMatch(/verify_reference_gate/)
    expect(verification).toMatch(/reference_gate_manifest_sha256/)
  })

  it('still proves materialisation cannot promote a model', () => {
    const source = steps.map((step) => step.run ?? '').join('\n')
    expect(source).toMatch(/status='current'/)
    expect(source).toMatch(/diff -u \/tmp\/current-models-before \/tmp\/current-models-after/)
    expect(source).not.toMatch(/admin_ai_promote_model/)
  })
})
