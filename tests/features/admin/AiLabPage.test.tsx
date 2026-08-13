import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiLabPage } from '../../../src/features/admin/AiLabPage'
import { mapAiLabSnapshot } from '../../../src/services/supabase/aiLabModel'
import { fetchAiLabSnapshot } from '../../../src/services/supabase/aiLab'

vi.mock('../../../src/services/supabase/aiLab', () => ({
  fetchAiLabSnapshot: vi.fn(),
  promoteAiModel: vi.fn(),
}))

// The Bet Builder tab reaches its own two bounded RPCs. Mocked at the service
// boundary, like the snapshot above it, so this suite stays about the page.
vi.mock('../../../src/services/supabase/betBuilder', () => ({
  fetchBetBuilderBookmakers: vi.fn(async () => []),
  fetchBetBuilderCandidates: vi.fn(async () => ({
    bookmaker: { code: '', name: '', kind: 'unknown', isRealPrice: false, exchangeCommission: null },
    legs: [], legCount: 0, truncatedAt: 0,
    window: { from: '', to: '' }, generatedAt: '',
  })),
}))

const snapshot = mapAiLabSnapshot({
  dashboard: {
    as_of: '2026-08-12T17:00:00Z',
    performance: { graded: 0 },
    models: [],
    calibration: [],
    jobs: {},
    gate: { public_enabled: false },
  },
  upcoming: [],
  recent: [],
  breakdown: {},
  betting: { clv: { n: 0 }, profit: { settled_bets: 0 }, open: {}, bookmakers: {}, gate: {} },
  bettingGate: { currently_public: false },
  markets: {
    '1X2': {
      name: 'Match result', settled_bets: 0, clv_observations: 0,
      required_bets: 100, mean_clv: 0, trusted: false, meets_evidence_bar: false,
    },
  },
  odds: {
    month_to_date_credits: 0, monthly_credits: 500, soft_cap: 450,
    remaining_to_soft_cap: 450, recent_calls: [],
    event_matching: { events_seen: 0, matched_to_fixture: 0, unmatched: [] },
  },
})

describe('AI Lab page', () => {
  beforeEach(() => {
    vi.mocked(fetchAiLabSnapshot).mockReset().mockResolvedValue(snapshot)
  })

  it('renders a truthful pre-evidence dashboard rather than an invented success state', async () => {
    render(<AiLabPage />)

    expect(await screen.findByRole('heading', { name: 'AI Lab' })).toBeTruthy()
    expect(screen.getByText('Paper betting only')).toBeTruthy()
    expect(screen.getByText('No models trained yet')).toBeTruthy()
    expect(screen.getByText('Awaiting graded predictions')).toBeTruthy()
    expect(screen.getByText('The laboratory remains private')).toBeTruthy()
    expect(fetchAiLabSnapshot).toHaveBeenCalledWith(null)
  })

  it('filters every dashboard read by the selected league and exposes the evidence tabs', async () => {
    render(<AiLabPage />)
    await screen.findByText('No models trained yet')

    fireEvent.change(screen.getByLabelText('League'), { target: { value: 'SL2' } })
    await waitFor(() => expect(fetchAiLabSnapshot).toHaveBeenLastCalledWith('SL2'))

    fireEvent.click(screen.getByRole('button', { name: 'Betting evidence' }))
    expect(await screen.findByRole('heading', { name: 'Evidence by market' })).toBeTruthy()
    expect(screen.getByText('0 / 100')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getByText('No provider credits used')).toBeTruthy()
    expect(screen.getByText(/of 450 soft cap · 500 plan/)).toBeTruthy()
  })
})
