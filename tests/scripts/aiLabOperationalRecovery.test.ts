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

describe('paid odds scheduling tracks fixture freshness instead of a weekday minute', () => {
  it('keeps one five-minute heartbeat and removes the four brittle DST twins', () => {
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

  it('dispatches only for paid-covered fixtures and tightens cadence toward kickoff', () => {
    expect(schedulerSql).toMatch(/f\.league_key in \('EPL','ECH','EL1','EL2','SPL'\)/)
    expect(schedulerSql).toContain('public.dispatch_ai_odds_polls(true)')
    expect(schedulerSql).not.toMatch(/time zone 'Europe\/London'/)

    // Contract 200. The window used to be 24 hours and the lab forecasts ten
    // days, so between matchday clusters nothing was collected at all and every
    // quote aged past its own freshness limit. Assert the window, and assert
    // that the last cadence tier reaches it — a heartbeat that selects fixtures
    // it has no cadence for silently collects nothing for them.
    const window = schedulerSql.match(/kickoff_at <= now\(\) \+ interval '(\d+) hours'/)
    expect(window, 'the heartbeat must state its fixture window').not.toBeNull()
    expect(Number(window?.[1])).toBe(180)

    const tiers = [...schedulerSql.matchAll(/when nearest_hours <= ([\d.]+)\s+then (\d+)/g)]
      .map((m) => ({ hours: Number(m[1]), seconds: Number(m[2]) }))
    expect(tiers.map((t) => [t.hours, t.seconds])).toEqual([
      [2, 600],
      [8, 3000],
      [24, 21600],
      [180, 28800],
    ])
    expect(tiers.at(-1)?.hours).toBe(Number(window?.[1]))

    // THE INVARIANT, rather than the numbers: at every distance from kickoff
    // the collector must be allowed to wait strictly less than the value gate
    // will accept as a current price. Anything else guarantees a stale window
    // in every cycle however the gate is written. This mirrors
    // ai.price_age_limit_seconds and value_engine.FreshnessPolicy.
    const freshnessLimitSeconds = (hours: number) =>
      hours <= 2 ? 1200 : hours <= 8 ? 3600 : 43200
    for (const tier of tiers) {
      expect(
        tier.seconds,
        `at ${tier.hours}h the collector may wait ${tier.seconds}s but the gate ` +
          `only accepts a price ${freshnessLimitSeconds(tier.hours)}s old`,
      ).toBeLessThan(freshnessLimitSeconds(tier.hours))
    }
  })

  it('cannot dispatch again until the current freshness cadence is due', () => {
    expect(schedulerSql).toMatch(/not exists[\s\S]*ai\.odds_api_dispatches/)
    expect(schedulerSql).toMatch(/d\.dispatched_at >= now\(\) - c\.max_gap/)
  })

  it('reconciles Production daily, verifies the budget authority and does not itself dispatch', () => {
    expect(schedulerWorkflow.on.schedule?.map((x) => x.cron)).toContain('20 4 * * *')
    expect(schedulerWorkflow.env.PRODUCTION_PROJECT_REF).toBe('vkfnsqdyhvtwyqkisxhk')
    const runs = Object.values(schedulerWorkflow.jobs)
      .flatMap((job) => job.steps)
      .map((step) => step.run ?? '')
      .join('\n')
    expect(runs).toMatch(/ai\.api_usage/)
    expect(runs).toMatch(/diff -u \/tmp\/ai-odds-usage-before \/tmp\/ai-odds-usage-after/)
    expect(runs).toMatch(/pg_get_functiondef/)
    expect(runs).toMatch(/public\.ai_odds_budget_check/)
    expect(runs).not.toMatch(/select\s+public\.dispatch_ai_odds_polls\s*\(/)
    expect(runs).not.toMatch(/odds_api\.py\s+live/)
  })
})

describe('fresh paid odds cannot sit unprocessed while Bet Builder ages out', () => {
  const runs = Object.values(catchup.jobs)
    .flatMap((job) => job.steps)
    .map((step) => step.run ?? '')
    .join('\n')

  it('serialises against the primary Production AI Lab workflow', () => {
    expect(catchup.concurrency?.group).toBe('ai-lab-production')
  })

  it('checks every ten minutes while retaining the explicit delayed-run recovery anchors', () => {
    const schedules = catchup.on.schedule?.map((x) => x.cron) ?? []
    expect(schedules).toContain('*/10 * * * *')
    expect(schedules).toContain('45 15 * * 2')
    expect(schedules).toContain('45 19 * * 5')
  })

  it('decides from durable dispatch/job evidence rather than runner wall-clock hour', () => {
    expect(runs).toMatch(/ai\.odds_api_dispatches/)
    expect(runs).toMatch(/ai\.job_runs/)
    expect(runs).toMatch(/job = 'find_value'/)
    expect(runs).toMatch(/completed_since_dispatch/)
    expect(runs).toMatch(/count\(distinct league\)/)
    expect(runs).not.toMatch(/TZ=Europe\/London date/)
  })

  it('waits for all five successful paid responses before consuming a new dispatch', () => {
    expect(runs).toMatch(/ai\.api_usage/)
    expect(runs).toMatch(/provider = 'the-odds-api'/)
    expect(runs).toMatch(/http_status = 200/)
    expect(runs).toMatch(/responses >= 5/)
    expect(runs).toMatch(/ok < 5/)
  })

  it('reconciles paid evidence and all nine value leagues without dispatching the provider', () => {
    expect(runs).toMatch(/sync_fixtures\.py/)
    expect(runs).toMatch(/reconcile_paid_fixture_evidence\.py/)
    expect(runs).toMatch(/fetch_fixtures_odds\.py/)
    expect(runs).toMatch(/run_leagues\.sh find_value\.py/)
    expect(runs).not.toMatch(/odds_api\.py\s+live/)
    expect(runs).not.toMatch(/dispatch_ai_odds_polls/)
  })

  it('fails unless all nine leagues leave successful value evidence and the workflow itself spends zero credit', () => {
    expect(runs).toMatch(/\[ "\$\{completed\}" -eq 9 \]/)
    expect(runs).toMatch(/interval '90 minutes'/)
    expect(runs).toMatch(/diff -u \/tmp\/paid-usage-before \/tmp\/paid-usage-after/)
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