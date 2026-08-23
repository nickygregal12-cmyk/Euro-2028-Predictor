import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BetBuilderPanel, windowFor } from '../../../src/features/admin/BetBuilderPanel'
import {
  fetchBetBuilderBookmakers,
  fetchBetBuilderCandidates,
} from '../../../src/services/supabase/betBuilder'

vi.mock('../../../src/services/supabase/betBuilder', () => ({
  fetchBetBuilderBookmakers: vi.fn(),
  fetchBetBuilderCandidates: vi.fn(),
}))

const WEDNESDAY = new Date('2026-08-19T12:00:00')

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

describe('the Saturday 3pm window', () => {
  it('covers the afternoon block rather than literally 15:00', () => {
    const { from, to } = windowFor('saturday3pm', WEDNESDAY)
    expect(from.getDay()).toBe(6)
    expect(to.getDay()).toBe(6)
    expect(hhmm(from)).toBe('14:30')
    expect(hhmm(to)).toBe('17:00')
  })

  it('picks the next Saturday, not one in the past', () => {
    const { from } = windowFor('saturday3pm', WEDNESDAY)
    expect(from.getTime()).toBeGreaterThan(WEDNESDAY.getTime())
    expect(from.getDate()).toBe(22)
  })

  it('rolls to next week when asked after the block has finished', () => {
    const saturdayEvening = new Date('2026-08-22T19:00:00')
    const { from, to } = windowFor('saturday3pm', saturdayEvening)
    expect(from.getTime()).toBeGreaterThan(saturdayEvening.getTime())
    expect(from.getDate()).toBe(29)
    expect(hhmm(from)).toBe('14:30')
    expect(hhmm(to)).toBe('17:00')
  })

  it('still offers today when asked on a Saturday morning', () => {
    const saturdayMorning = new Date('2026-08-22T09:00:00')
    const { from } = windowFor('saturday3pm', saturdayMorning)
    expect(from.getDate()).toBe(22)
  })

  it('is narrower than the all-weekend window it sits beside', () => {
    const block = windowFor('saturday3pm', WEDNESDAY)
    const weekend = windowFor('weekend', WEDNESDAY)
    const blockSpan = block.to.getTime() - block.from.getTime()
    const weekendSpan = weekend.to.getTime() - weekend.from.getTime()
    expect(blockSpan).toBeLessThan(weekendSpan)
    expect(blockSpan).toBe(2.5 * 60 * 60 * 1000)
  })
})

const books = [
  {
    code: 'B365', name: 'Bet365', kind: 'bookmaker' as const, isRealPrice: true,
    exchangeCommission: null, legs: 12, lastDecidedAt: null,
  },
]

const candidatePayload = {
  bookmaker: {
    code: 'B365', name: 'Bet365', kind: 'bookmaker' as const,
    isRealPrice: true, exchangeCommission: null,
  },
  legs: [], legCount: 0, truncatedAt: 200,
  window: { from: '2026-08-19T00:00:00Z', to: '2026-08-26T00:00:00Z' },
  coverage: {
    fixturesInWindow: 24, withCurrentDecision: 22, actionableAnywhere: 8,
    actionableAtThisBook: 5, passed: 14, passReasonCounts: { PASS_LOW_EDGE: 6 },
  },
  generatedAt: '2026-08-19T12:00:00Z',
}

describe('the rebuilt Bet Builder controls', () => {
  beforeEach(() => {
    vi.mocked(fetchBetBuilderBookmakers).mockReset().mockResolvedValue(books)
    vi.mocked(fetchBetBuilderCandidates).mockReset().mockResolvedValue(candidatePayload)
  })

  it('leads with stake and leg count, while specialist filters stay collapsed', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')

    expect(within(controls).getByLabelText('Stake')).toBeTruthy()
    expect(within(controls).getByLabelText('Legs')).toBeTruthy()
    expect(within(controls).queryByLabelText('Target return')).toBeNull()

    const disclosure = controls.querySelector('details')
    expect(disclosure).not.toBeNull()
    expect(disclosure?.open).toBe(false)
    expect(disclosure?.contains(within(controls).getByLabelText('Bookmaker'))).toBe(true)
    expect(
      disclosure?.contains(within(controls).getByRole('button', { name: 'Premier League' })),
    ).toBe(true)

    fireEvent.click(within(controls).getByText(/More filters/))
    await waitFor(() => expect(controls.querySelector('details')?.open).toBe(true))
  })

  it('opens on a probability-first double rather than the biggest payout', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')

    expect((within(controls).getByLabelText('Legs') as HTMLSelectElement).value).toBe('2')
    expect(
      within(controls).getByRole('button', { name: 'Recommended' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      within(controls).getByRole('button', { name: 'High return' }).getAttribute('aria-pressed'),
    ).toBe('false')
    expect(within(controls).getByText(/Probability-first/)).toBeTruthy()
  })

  it('makes high-return mode an explicit speculative choice', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')

    fireEvent.click(within(controls).getByRole('button', { name: 'High return' }))
    expect(within(controls).getByText(/most speculative mode/)).toBeTruthy()
    expect(within(controls).getByText(/not the Lab's recommended mode/)).toBeTruthy()
  })

  it('keeps the useful date windows', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')
    for (const label of ['Today', 'Tomorrow', 'Saturday 3pm', 'All weekend', 'Next 7 days']) {
      expect(within(controls).getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('counts filters hidden in the disclosure so they cannot silently alter results', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')
    fireEvent.click(within(controls).getByText(/More filters/))
    fireEvent.change(within(controls).getByLabelText('Minimum model chance'), { target: { value: '40' } })
    await waitFor(() => {
      expect(within(controls).getByText(/More filters \(1 active\)/)).toBeTruthy()
    })
  })
})
