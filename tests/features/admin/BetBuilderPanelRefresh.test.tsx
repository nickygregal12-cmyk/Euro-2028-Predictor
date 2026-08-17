import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BetBuilderPanel, chooseBetBuilderBookmaker } from '../../../src/features/admin/BetBuilderPanel'
import { fetchBetBuilderBookmakers, fetchBetBuilderCandidates } from '../../../src/services/supabase/betBuilder'
import { at } from '../../support/indexed'

vi.mock('../../../src/services/supabase/betBuilder', () => ({
  fetchBetBuilderBookmakers: vi.fn(),
  fetchBetBuilderCandidates: vi.fn(),
}))

const staleBooks = [
  { code: 'B365', name: 'Bet365', kind: 'bookmaker' as const, isRealPrice: true, exchangeCommission: null, legs: 0, lastDecidedAt: null },
  { code: 'BFE', name: 'Betfair Exchange', kind: 'exchange' as const, isRealPrice: true, exchangeCommission: 0.02, legs: 0, lastDecidedAt: null },
]

const freshBooks = [
  { ...at(staleBooks, 0), legs: 2 },
  { ...at(staleBooks, 1), legs: 38 },
  { code: 'MAX', name: 'MAX', kind: 'aggregate' as const, isRealPrice: false, exchangeCommission: null, legs: 999, lastDecidedAt: null },
]

function candidates(bookmaker: string) {
  const book = freshBooks.find((row) => row.code === bookmaker) ?? at(staleBooks, 0)
  return {
    bookmaker: {
      code: book.code, name: book.name, kind: book.kind,
      isRealPrice: book.isRealPrice, exchangeCommission: book.exchangeCommission,
    },
    legs: [], legCount: 0, truncatedAt: 200,
    window: { from: '2026-08-15T00:00:00Z', to: '2026-08-22T00:00:00Z' },
    generatedAt: '2026-08-15T03:00:00Z',
  }
}

describe('Bet Builder live refresh', () => {
  beforeEach(() => {
    vi.mocked(fetchBetBuilderBookmakers).mockReset()
      .mockResolvedValueOnce(staleBooks)
      .mockResolvedValue(freshBooks)
    vi.mocked(fetchBetBuilderCandidates).mockReset()
      .mockImplementation(async (options) => candidates(options.bookmaker))
  })

  it('chooses the strongest real bookmaker that can satisfy the requested leg count', () => {
    expect(chooseBetBuilderBookmaker(freshBooks, 3, 'B365')).toBe('BFE')
    expect(chooseBetBuilderBookmaker(freshBooks, 3, 'BFE')).toBe('BFE')
    expect(chooseBetBuilderBookmaker(freshBooks, 50, null)).toBe('BFE')
  })

  it('refreshes bookmaker counts as well as candidates and escapes a stale impossible default', async () => {
    render(<BetBuilderPanel />)

    const select = await screen.findByRole('combobox', { name: /Bookmaker/i }) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('B365'))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh selections' }))

    await waitFor(() => expect(fetchBetBuilderBookmakers).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(select.value).toBe('BFE'))
    await waitFor(() => expect(fetchBetBuilderCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'BFE' }),
    ))
  })
})
