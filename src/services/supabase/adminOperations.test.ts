import { describe, expect, it, vi } from 'vitest'

// These tests exercise the pure response decoders only. Mock the configured DB
// wrapper before adminOperations loads so an environment-less unit process does
// not require VITE_SUPABASE_* merely to parse retained server evidence.
vi.mock('./client', () => ({
  db: { rpc: vi.fn() },
}))

import { decodeAiOperationalHealth, decodeOddsApiAdminStatus } from './adminOperations'

describe('admin operations decoders', () => {
  it('keeps unknown quota facts unknown instead of converting them to zero', () => {
    const result = decodeOddsApiAdminStatus({
      month_to_date_credits: null,
      monthly_credits: null,
      soft_cap: null,
      remaining_to_soft_cap: null,
      recent_calls: [],
    })

    expect(result.monthToDateCredits).toBeNull()
    expect(result.monthlyCredits).toBeNull()
    expect(result.softCap).toBeNull()
    expect(result.remainingToSoftCap).toBeNull()
  })

  it('retains provider-reported remaining quota from archived call evidence', () => {
    const result = decodeOddsApiAdminStatus({
      month_to_date_credits: 744,
      monthly_credits: 20000,
      soft_cap: 18000,
      remaining_to_soft_cap: 17256,
      cost_model_drift: 2,
      recent_calls: [
        {
          endpoint: '/sports/football/odds',
          sport_key: 'soccer_epl',
          is_historical: false,
          estimated_cost: 3,
          reported_cost: 4,
          reported_remaining: 19256,
          rows_returned: 10,
          called_at: '2026-08-20T09:00:00Z',
        },
      ],
    })

    expect(result.monthToDateCredits).toBe(744)
    expect(result.recentCalls[0]?.reportedRemaining).toBe(19256)
    expect(result.recentCalls[0]?.reportedCost).toBe(4)
  })

  it('parses operational job failures without deriving scheduler health', () => {
    const result = decodeAiOperationalHealth({
      generated_at: '2026-08-20T09:00:00Z',
      odds_api: {
        collection_enabled: true,
        monthly_credits: 20000,
        soft_cap: 18000,
        credits_used_this_month: 744,
        last_dispatch_at: '2026-08-20T08:00:00Z',
        last_successful_call_at: '2026-08-20T08:02:00Z',
        last_call_status: 200,
      },
      jobs: [
        {
          job: 'sync_fixtures',
          last_run_at: '2026-08-20T08:00:00Z',
          last_success_at: '2026-08-20T08:00:00Z',
          failures_7d: 1,
        },
      ],
    })

    expect(result.oddsApi.collectionEnabled).toBe(true)
    expect(result.jobs).toEqual([
      expect.objectContaining({ job: 'sync_fixtures', failures7d: 1 }),
    ])
  })

  it('fails loudly for a malformed root payload', () => {
    expect(() => decodeOddsApiAdminStatus([])).toThrow(/expected shape/)
    expect(() => decodeAiOperationalHealth(null)).toThrow(/expected shape/)
  })
})
