import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiLabPage } from '../../../src/features/admin/AiLabPage'
import { previewCoverage, previewHealth, previewReview } from '../../../src/dev/aiLabPreviewContext'
import { previewSnapshot } from '../../../src/dev/AiLabPreview'

vi.mock('../../../src/services/supabase/aiLab', () => ({
  fetchAiLabSnapshot: vi.fn(),
  promoteAiModel: vi.fn(),
}))
vi.mock('../../../src/services/supabase/aiLabCoverage', () => ({
  fetchAiCoverage: vi.fn(),
  fetchAiOperationalHealth: vi.fn(),
  fetchAiResultsReview: vi.fn(),
}))
vi.mock('../../../src/services/supabase/betBuilder', () => ({
  fetchBetBuilderBookmakers: vi.fn(),
  fetchBetBuilderCandidates: vi.fn(),
}))

/**
 * Market comparison must be like-for-like. The rebuilt Lab keeps the lifetime
 * model card separate from the explicitly-windowed seven-day closing comparator
 * instead of putting a lifetime log-loss number beside a seven-day verdict.
 */
describe('AI Lab comparable market evidence', () => {
  function renderPerformance(review = previewReview) {
    render(
      <AiLabPage
        previewSnapshot={previewSnapshot}
        previewContext={{ health: previewHealth, coverage: previewCoverage, review }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Performance/ }))
  }

  it('says the model is behind the closing comparator and shows both numbers', () => {
    renderPerformance()
    expect(screen.getByRole('heading', { name: 'Closing market still leads' })).toBeTruthy()
    const copy = screen.getByText(/Model log loss 0\.9906 vs market 0\.9689/)
    expect(copy.textContent).toMatch(/57 fixtures/)
    expect(copy.textContent).toMatch(/0\.0217/)
  })

  it('does not claim a market comparison it has not got', () => {
    renderPerformance({
      ...previewReview,
      totals: { ...previewReview.totals, meanMarketLogLoss: null, marketComparisons: 0 },
    })
    expect(screen.getByRole('heading', { name: 'Closing comparison still building' })).toBeTruthy()
    expect(screen.getByText(/No like-for-like market comparator/)).toBeTruthy()
  })

  it('reads the other way round when the model wins the same window', () => {
    renderPerformance({
      ...previewReview,
      totals: { ...previewReview.totals, meanLogLoss: 0.9012, meanMarketLogLoss: 0.9689 },
    })
    expect(screen.getByRole('heading', { name: 'Live probabilities beat the closing comparator' })).toBeTruthy()
  })
})
