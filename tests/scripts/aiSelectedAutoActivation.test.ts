import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/ai-selected-auto-activate.yml'),
  'utf8',
)
const activator = readFileSync(
  resolve(process.cwd(), 'ai/activate_selected_models.py'),
  'utf8',
)

describe('selected model auto-activation', () => {
  it('reacts to completed training/materialisation and remains production-scoped', () => {
    expect(workflow).toContain("'AI Lab jobs'")
    expect(workflow).toContain("'AI selected challenger materialisation'")
    expect(workflow).toContain('github.event.workflow_run.conclusion == \'success\'')
    expect(workflow).toContain('PRODUCTION_PROJECT_REF: vkfnsqdyhvtwyqkisxhk')
    expect(workflow).toContain('SUPABASE_PROD_DB_URL')
    expect(workflow).not.toContain('SUPABASE_DEV_DB_URL')
  })

  it('refuses stale or non-main activation code before the lifecycle write', () => {
    const remoteChecks = workflow.match(/git ls-remote origin refs\/heads\/main/g) ?? []
    expect(remoteChecks.length).toBeGreaterThanOrEqual(2)
    expect(workflow).toContain('is not current main')
    expect(workflow).toContain('refusing stale model activation')
    expect(workflow.indexOf('Re-prove exact main before lifecycle write'))
      .toBeLessThan(workflow.indexOf('python activate_selected_models.py'))
  })

  it('only activates a complete nine-league version', () => {
    expect(workflow).toContain('having count(*)=9 and count(distinct league)=9')
    expect(workflow).toContain('is not a complete nine-league selected set')
    expect(activator).toContain('selected policy must cover exactly nine leagues')
    expect(activator).toContain('verify_selected_version(version)')
  })

  it('keeps reproducibility and reference gates in front of the lifecycle write', () => {
    const verify = activator.indexOf('verified = verify_selected_version(version)')
    const retire = activator.indexOf("set status='retired'")
    expect(verify).toBeGreaterThan(-1)
    expect(retire).toBeGreaterThan(verify)
    expect(activator).toContain('bundle_contract_fingerprint(bundle)')
    expect(activator).toContain('verify_reference_gate(bundle, gate)')
    expect(activator).toContain('training_data_sha256')
    expect(activator).toContain('coverage_guard')
  })

  it('atomically leaves exactly one selected current model per league', () => {
    expect(activator).toContain('with conn.transaction():')
    expect(activator).toContain("status='current'")
    expect(activator).toContain("'current_total': 9")
    expect(activator).toContain("'selected_current': 9")
    expect(activator).toContain("'selected_leagues': 9")
    expect(activator).toContain("'selected_challengers': 0")
  })

  it('regenerates forecasts and value evidence without calling the paid Odds API', () => {
    const activate = workflow.indexOf('python activate_selected_models.py')
    const predict = workflow.indexOf('./run_leagues.sh predict.py')
    const freeOdds = workflow.indexOf('python fetch_fixtures_odds.py')
    const value = workflow.indexOf('./run_leagues.sh find_value.py')
    expect(activate).toBeGreaterThan(-1)
    expect(predict).toBeGreaterThan(activate)
    expect(freeOdds).toBeGreaterThan(predict)
    expect(value).toBeGreaterThan(freeOdds)
    expect(workflow).not.toContain('dispatch_ai_odds_polls')
    expect(workflow).not.toContain('odds_api.py fetch')
  })

  it('keeps synthetic aggregate prices out of actionable betting evidence', () => {
    expect(workflow).toContain('from ai.valid_bets b')
    expect(workflow).toContain("not bk.is_real_price or bk.kind='aggregate'")
  })
})
