import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), '.github/workflows/activate-production-ai-lab-v2-once.yml'),
  'utf8',
)

describe('Production AI Lab v2 activation is fail-closed', () => {
  it('is structurally main-only and requires the deliberate activation merge title', () => {
    expect(source).toMatch(/push:\s*\n\s+branches:\s*\n\s+- main/)
    expect(source).toContain(
      "startsWith(github.event.head_commit.message, 'Ops: activate Production AI Lab verified v2')",
    )
  })

  it('requires all nine verified v2 challengers to cross the signed-in admin promotion gate', () => {
    expect(source).toContain('SELECTED_VERSION: selected-20260814-v2')
    expect(source).toMatch(/'current_total': 9/)
    expect(source).toMatch(/'selected_current': 9/)
    expect(source).toMatch(/'selected_leagues': 9/)
    expect(source).toMatch(/'selected_challengers': 0/)
    expect(source).not.toMatch(/update\s+ai\.models/i)
    expect(source).not.toContain('admin_ai_promote_model')
  })

  it('reuses complete fresh paid evidence or spends one bounded fallback exactly once', () => {
    expect(source).toContain("called_at >= now() - interval '45 minutes'")
    expect(source).toContain("provider_refresh_performed': refresh_performed")
    expect(source).toContain('public.dispatch_ai_odds_polls(true)')
    expect(source).toMatch(/result\.get\('dispatched'\) != 5/)
    expect(source).toMatch(/result\.get\('estimated_credits'\) != 10/)
    expect(source).toContain('bookmakers=pinnacle,betfair_ex_uk,smarkets,matchbook')
    expect(source).toMatch(/'MAX' in path or 'AVG' in path/)
    expect(source).toContain('activation marker already exists')
  })

  it('re-proves exact main after any external provider action before predictions run', () => {
    const guards = source.match(/remote_sha=/g) ?? []
    expect(guards.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain('refusing to run stale forecast code')
  })

  it('runs prediction before the all-league free-price refresh and value pass', () => {
    const predict = source.indexOf('predict_id="$(dispatch_task predict)"')
    const value = source.indexOf('value_id="$(dispatch_task free-odds)"')
    expect(predict).toBeGreaterThan(-1)
    expect(value).toBeGreaterThan(predict)
    expect(source).toContain('-f target=production -f task="${task}"')
    expect(source).toContain("'value_task': 'free-odds'")
  })

  it('accepts only fresh v2 forecasts and real actionable recommendation venues', () => {
    expect(source).toMatch(/from ai\.valid_predictions p/)
    expect(source).toMatch(/m\.version <> %s/)
    expect(source).toMatch(/from ai\.recommendations r/)
    expect(source).toContain("r.decision='BET'")
    expect(source).toContain("not bk.is_real_price or bk.kind='aggregate'")
    expect(source).toMatch(/from ai\.valid_bets b/)
    expect(source).toContain('invalid_valid_bets != 0')
  })

  it('remains paper-analysis orchestration and contains no bet-placement integration', () => {
    expect(source).not.toContain('--real-money')
    expect(source).not.toMatch(/place[_ -]?bet/i)
    expect(source).toContain('paper research only')
  })
})
