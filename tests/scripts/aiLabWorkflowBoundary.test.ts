import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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

  // On 13 August 2026 this gate refused a Production that genuinely held
  // contract 188 (run 31740574108). The fault was not the database: the probe
  // asked `to_regproc('ai.canonical_from_odds_api(text)')`, and `to_regproc`
  // resolves a bare function NAME, so a parenthesised signature returns null
  // for a function that exists. The gate could not have passed anywhere. That
  // is measured rather than recalled — against the live Production catalogue at
  // contract 188, `to_regproc` with a signature returns false while
  // `to_regprocedure` with the same signature returns true.
  // The step explains its own history in comments, and that prose necessarily
  // quotes both defective spellings. A guard that read the comments would
  // reject the very change that documents the fix, so the negative assertions
  // below run against executable lines only.
  const probeCode = (steps.find((step) => step.id === 'schema')?.run ?? '')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

  it('probes the function by a signature-accepting resolver, never to_regproc', () => {
    expect(probeCode).toMatch(/to_regprocedure\('ai\.canonical_from_odds_api\(text\)'\)/)
    // `to_regproc(` cannot match `to_regprocedure(` — the guard is exact.
    expect(probeCode, 'to_regproc cannot resolve a signature').not.toMatch(/to_regproc\(/)
    expect(probeCode).toMatch(/to_regclass\('ai\.valid_predictions'\)/)
  })

  it('names the object it actually measured rather than a fixed guessed cause', () => {
    // The old notice hard-coded "(ai.valid_predictions absent)" whatever the
    // probe found, which sent a reader to the database instead of to the bug.
    expect(probeCode).not.toMatch(/ai\.valid_predictions absent/)
    expect(probeCode).toMatch(/\$\{missing\}/)
  })

  /**
   * The derivation above is executed rather than read. The workflow's own
   * Python is extracted verbatim and run against a stub `psycopg`, so the
   * mapping from "what the catalogue said" to "what the gate reports" is
   * proved, not reviewed. The SQL text itself is asserted separately: the stub
   * records it, and the live-catalogue behaviour of the two resolvers is what
   * the test above pins.
   */
  const probeSource = (() => {
    const run = steps.find((step) => step.id === 'schema')?.run ?? ''
    const start = run.indexOf("<<'PY'\n")
    const end = run.indexOf('\nPY\n', start)
    return start === -1 || end === -1 ? '' : run.slice(start + "<<'PY'\n".length, end)
  })()

  const runProbe = (view: boolean, fn: boolean) => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-lab-probe-'))
    writeFileSync(
      join(dir, 'psycopg.py'),
      [
        'import os',
        'class _Cur:',
        '    def __init__(self, row): self._row = row',
        '    def fetchone(self): return self._row',
        'class _Conn:',
        '    def __init__(self, row): self._row = row',
        '    def execute(self, sql):',
        '        open(os.environ["PROBE_SQL_OUT"], "w").write(sql)',
        '        return _Cur(self._row)',
        '    def __enter__(self): return self',
        '    def __exit__(self, *a): return False',
        'def connect(url):',
        '    return _Conn((os.environ["STUB_VIEW"] == "1", os.environ["STUB_FN"] == "1"))',
        '',
      ].join('\n'),
    )
    writeFileSync(join(dir, 'probe.py'), probeSource)
    const sqlOut = join(dir, 'sql.txt')
    const stdout = execFileSync('python3', [join(dir, 'probe.py')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PYTHONPATH: dir,
        DATABASE_URL: 'postgresql://stub/stub',
        PROBE_SQL_OUT: sqlOut,
        STUB_VIEW: view ? '1' : '0',
        STUB_FN: fn ? '1' : '0',
      },
    }).trim()
    return { stdout, sql: readFileSync(sqlOut, 'utf8') }
  }

  it('extracts as a runnable program', () => {
    expect(probeSource).toMatch(/import os, psycopg/)
  })

  it('passes a database that holds both contract-188 objects', () => {
    const { stdout, sql } = runProbe(true, true)
    expect(stdout).toBe('true|')
    // Both objects are genuinely asked about at execution time.
    expect(sql).toMatch(/to_regclass\('ai\.valid_predictions'\)/)
    expect(sql).toMatch(/to_regprocedure\('ai\.canonical_from_odds_api\(text\)'\)/)
  })

  it('reports the genuinely missing object, and only that one', () => {
    expect(runProbe(false, true).stdout).toBe('false|ai.valid_predictions')
    expect(runProbe(true, false).stdout).toBe('false|ai.canonical_from_odds_api(text)')
    expect(runProbe(false, false).stdout).toBe(
      'false|ai.valid_predictions, ai.canonical_from_odds_api(text)',
    )
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
