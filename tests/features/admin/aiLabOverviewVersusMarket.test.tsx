import { render, screen } from '@testing-library/react'
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
 * A log loss on its own is unreadable. 1.021 is neither good nor bad until it
 * sits beside something, and the only comparator that means anything is the
 * de-vigged closing line: what a well-informed market thought, priced on the
 * same matches.
 *
 * The card used to read "Lower is better", which gives a reader the direction
 * and not the verdict — so the most important thing this page knows, that every
 * current model is behind the market, was visible nowhere on it.
 */
describe('the Overview log loss against the closing line', () => {
  function renderOverview(review = previewReview) {
    render(
      <AiLabPage
        previewSnapshot={previewSnapshot}
        previewContext={{ health: previewHealth, coverage: previewCoverage, review }}
      />,
    )
  }

  it('says the model is behind the market, and by how much', () => {
    renderOverview()
    // 0.9906 model against a 0.9689 close is 0.0217 behind.
    const hint = screen.getByText(/Behind the closing line by/)
    expect(hint.textContent).toContain('0.0217')
    expect(hint.textContent).toContain('0.9689')
    expect(hint.textContent).toMatch(/over 57/)
  })

  it('does not claim a comparison it has not got', () => {
    renderOverview({
      ...previewReview,
      totals: { ...previewReview.totals, meanMarketLogLoss: null },
    })
    expect(screen.getByText(/no closing comparison yet/)).toBeTruthy()
    expect(screen.queryByText(/Behind the closing line/)).toBeNull()
  })

  it('reads the other way round when the model wins', () => {
    renderOverview({
      ...previewReview,
      totals: { ...previewReview.totals, meanLogLoss: 0.9012, meanMarketLogLoss: 0.9689 },
    })
    expect(screen.getByText(/Ahead of the closing line by/)).toBeTruthy()
  })
})
