import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { at } from '../support/indexed'

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
      // `env` is read because hardening against template injection moved the
      // expansions out of the scripts and into step environments, so the
      // binding is now part of what these boundary tests must check.
      steps: {
        name?: string
        if?: string
        run?: string
        id?: string
        env?: Record<string, string>
      }[]
    }
  }
}

const steps = workflow.jobs.run.steps
const dispatch = workflow.on.workflow_dispatch?.inputs ?? {}

const manualStep = steps.find((step) => step.name === 'Run manual task')?.run ?? ''

/** One `case` arm of the manual task, from its label to its terminating `;;`. */
const branch = (label: string): string => {
  const start = manualStep.indexOf(label)
  expect(start, `the manual task has no ${label} arm`).toBeGreaterThan(-1)
  const end = manualStep.indexOf(';;', start)
  return manualStep.slice(start, end === -1 ? undefined : end)
}

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
    const task = steps.find((step) => step.id === 'task')
    const resolver = task?.run ?? ''
    // The BOUNDARY, not one spelling of it. This named the raw
    // `${{ github.event_name }}` expansion; hardening the workflow against
    // template injection moved it into `env:` as EVENT_NAME, and the assertion
    // failed on the spelling while the boundary it protects was untouched.
    // Both halves are now required: the resolver must branch on the event name
    // and treat workflow_dispatch specially, AND the value must reach it from
    // the real `github.event_name` rather than from anything else.
    expect(resolver).toMatch(/(?:github\.event_name \}\}|\$\{EVENT_NAME\})" = workflow_dispatch/)
    expect(task?.env?.EVENT_NAME ?? '${{ github.event_name }}').toBe('${{ github.event_name }}')
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
    // Either the raw expansion or the env-bound form: the refusal message must
    // name the task, however that value reaches the script.
    expect(manual).toMatch(/Refusing (?:\$\{\{ steps\.task\.outputs\.name \}\}|\$\{TASK_NAME\})/)
    expect(manual).toMatch(/Refusing repair-identity/)
  })
})

describe('every task the manual step implements is one the selector offers', () => {
  /**
   * Written after a dispatch was refused with `not in the list of allowed
   * values []`. The arm existed and its guards passed; the option had been
   * added to the wrong list and sat inside the shell script as a stray `-
   * research-ablate` line. Both halves parse, both halves read plausibly, and
   * the only symptom is a 422 at dispatch time from the API rather than from
   * anything in the repository.
   */
  // Two-space indent is the outer `case`'s own arms once YAML has stripped
  // the block scalar's base indent. The nested case inside `predict|evaluate|
  // value)` sits deeper and is deliberately not matched — its arms are not
  // tasks, they are a second dispatch on the same already-offered task.
  const arms = [...manualStep.matchAll(/^ {2}([a-z|-]+)\)/gm)]
    .flatMap((m) => at(m, 1).split('|'))

  it('finds the arms at all', () => {
    expect(arms).toContain('research')
    expect(arms.length).toBeGreaterThan(5)
  })

  it('offers each one in the task selector', () => {
    for (const arm of arms) {
      expect(dispatch.task?.options, `task ${arm} is implemented but not offered`)
        .toContain(arm)
    }
  })

  it('leaves no option that would fall through to nothing', () => {
    // `bootstrap|train|free-odds` is a deliberate no-op arm — those tasks are
    // run by later steps — so it is an arm like any other and must be listed.
    for (const option of dispatch.task?.options ?? []) {
      expect(arms, `task ${option} is offered but has no arm`).toContain(option)
    }
  })
})

describe('the studies are runnable and promote nothing', () => {
  it('offers every study the module implements', () => {
    const module = readFileSync(resolve(process.cwd(), 'ai/experiments.py'), 'utf8')
    const implemented = [...module.matchAll(/^ {4}"([a-z-]+)": study_/gm)].map((m) => at(m, 1))
    expect(implemented.length).toBeGreaterThan(0)
    expect(dispatch.study?.options?.slice().sort()).toEqual(implemented.slice().sort())
  })

  it('records each study rather than only printing it', () => {
    // Scoped to the `experiments)` branch. Read against the whole step this
    // passed on the mere presence of `--record` anywhere in it, which the
    // read-only `research)` branch below must NOT satisfy.
    expect(branch('experiments)')).toMatch(/experiments\.py --league .* --study .* --record/s)
  })

  it('trains and promotes nothing from a study', () => {
    const experiments = manualStep.slice(
      manualStep.indexOf('experiments)'),
      manualStep.indexOf('bootstrap|train|free-odds'),
    )
    expect(experiments).not.toMatch(/train\.py|promote/)
  })
})

/**
 * The bulk-research path.
 *
 * The studies need the whole historical archive — tens of thousands of rows —
 * and the environment that holds it is Production. So the one execution plane
 * with the access is also the one where a stray write would matter most, and
 * the properties below are what make running there acceptable at all.
 */
describe('research runs against a hosted database without being able to change it', () => {
  const research = branch('research)')

  it('opens the session read-only rather than trusting a withheld flag', () => {
    expect(research).toMatch(/AI_READ_ONLY=1/)
  })

  it('writes nothing: no --record, and no other write-capable script', () => {
    expect(research).not.toMatch(/--record/)
    expect(research).not.toMatch(/train\.py|promote|settle_bets\.py|repair_identity\.py/)
  })

  it('calls no provider', () => {
    // Every script in the package that can spend a request, by name. A
    // research run that grew one of these would stop being free.
    expect(research).not.toMatch(
      /fetch_history\.py|sync_fixtures\.py|fetch_fixtures_odds\.py|odds_api\.py/,
    )
  })

  it('covers all nine leagues or one named league', () => {
    expect(research).toMatch(/run_leagues\.sh experiments\.py/)
    expect(research).toMatch(/--league "\$\{\{ inputs\.league \}\}"/)
    const leagues = ['EPL', 'ECH', 'EL1', 'EL2', 'ENL', 'SPL', 'SCH', 'SL1', 'SL2']
    expect(dispatch.league?.options).toEqual(['all', ...leagues])
    expect(dispatch.league?.default).toBe('all')
    // The nine the selector offers must be the nine the loop actually runs.
    const runner = readFileSync(resolve(process.cwd(), 'ai/run_leagues.sh'), 'utf8')
    expect(runner).toContain(`LEAGUES=(${leagues.join(' ')})`)
  })

  it('is enforced in the package, not only in this file', () => {
    // The workflow exporting AI_READ_ONLY means nothing unless the connection
    // honours it. Asserted here because this is the file that promises it.
    const db = readFileSync(resolve(process.cwd(), 'ai/db.py'), 'utf8')
    expect(db).toMatch(/default_transaction_read_only=on/)
    const experiments = readFileSync(resolve(process.cwd(), 'ai/experiments.py'), 'utf8')
    expect(experiments).toMatch(/args\.record and read_only\(\)/)
  })

  it('asks the ensemble question of a chosen component set', () => {
    // Whether `gbm` belongs in the default ensemble cannot be answered by a
    // dispatch that can only ever run the default. The `default` option
    // passes no flag, so the shipped set stays measurable as itself.
    expect(research).toMatch(/--base-families/)
    expect(dispatch.base_families?.default).toBe('default')
    expect(dispatch.base_families?.options).toContain('poisson elo')
    const zoo = readFileSync(resolve(process.cwd(), 'ai/model_zoo.py'), 'utf8')
    // The shipped set is DERIVED from the admission register rather than
    // hand-written, which is what stopped `gbm` sitting in every default
    // blend on the strength of a comment. A literal tuple here would restore
    // exactly that: registered and default one edit apart.
    expect(zoo).toMatch(/ENSEMBLE_BASE_FAMILIES = tuple\(/)
    expect(zoo).toMatch(/if verdict\.earned/)
    expect(zoo).toMatch(/ENSEMBLE_ADMISSION: dict\[str, Admission\]/)
    // Every option must name families the zoo actually registers, or the
    // dispatch offers a run that dies in argparse twenty minutes in.
    const registered = [...zoo.matchAll(/^ {4}"([a-z_]+)": /gm)].map((m) => at(m, 1))
    expect(registered.length).toBeGreaterThan(0)
    for (const option of dispatch.base_families?.options ?? []) {
      if (option === 'default') continue
      for (const family of option.split(' ')) {
        expect(registered, `base_families offers unregistered ${family}`).toContain(family)
      }
    }
  })
})

/**
 * The ablation arm. A feature family enters `DEFAULT_GROUPS` by winning paired
 * folds, and the folds need the whole archive, so it needs the same hosted
 * plane and the same guarantees as the studies above.
 */
describe('research-ablate measures a candidate family without writing one in', () => {
  const ablation = branch('research-ablate)')

  it('opens the session read-only and records nothing', () => {
    expect(ablation).toMatch(/AI_READ_ONLY=1/)
    expect(ablation).not.toMatch(/--record/)
    expect(ablation).not.toMatch(/train\.py|promote|settle_bets\.py|repair_identity\.py/)
  })

  it('calls no provider', () => {
    expect(ablation).not.toMatch(
      /fetch_history\.py|sync_fixtures\.py|fetch_fixtures_odds\.py|odds_api\.py/,
    )
  })

  it('covers all nine leagues or one named league', () => {
    expect(ablation).toMatch(/run_leagues\.sh ablate\.py/)
    expect(ablation).toMatch(/--league "\$\{\{ inputs\.league \}\}"/)
  })

  it('offers only families that are candidates rather than already default', () => {
    // Offering a member of DEFAULT_GROUPS would ablate a feature the model
    // already carries, which answers a different question than the one the
    // selector's description claims to ask.
    const features = readFileSync(resolve(process.cwd(), 'ai/features.py'), 'utf8')
    const defaults = [
      ...(/DEFAULT_GROUPS: tuple\[str, \.\.\.\] = \(([^)]*)\)/.exec(features)?.[1] ?? '')
        .matchAll(/"([a-z_]+)"/g),
    ].map((m) => at(m, 1))
    const known = [...features.matchAll(/^ {4}"([a-z_]+)": \(/gm)].map((m) => at(m, 1))
    const offered = dispatch.groups?.options ?? []
    expect(offered.length).toBeGreaterThan(0)
    for (const group of offered) {
      expect(known, `groups offers unknown family ${group}`).toContain(group)
      expect(defaults, `groups offers already-default family ${group}`).not.toContain(group)
    }
  })
})
