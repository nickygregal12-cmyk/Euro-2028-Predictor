import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BetBuilderPanel, windowFor } from '../../../src/features/admin/BetBuilderPanel'
import {
  fetchBetBuilderBookmakers,
  fetchBetBuilderCandidates,
} from '../../../src/services/supabase/betBuilder'

// Importing the panel reaches the Supabase client, which refuses to construct
// without environment. This suite exercises pure window maths, not the network.
vi.mock('../../../src/services/supabase/betBuilder', () => ({
  fetchBetBuilderBookmakers: vi.fn(),
  fetchBetBuilderCandidates: vi.fn(),
}))

/**
 * The Bet Builder's control surface was cut from roughly thirty-five visible
 * controls to a stake, a target return, a leg count, four ranking chips and
 * five when chips. These cover the parts of that reduction that are logic
 * rather than layout: the new Saturday-afternoon window, and the fact that a
 * shorter page still asks the same questions.
 */

// A Wednesday, deliberately mid-week so "this coming Saturday" is unambiguous.
const WEDNESDAY = new Date('2026-08-19T12:00:00')

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

describe('the Saturday 3pm window', () => {
  it('covers the afternoon block rather than literally 15:00', () => {
    const { from, to } = windowFor('saturday3pm', WEDNESDAY)
    // Saturday, and the block the request actually meant.
    expect(from.getDay()).toBe(6)
    expect(to.getDay()).toBe(6)
    expect(hhmm(from)).toBe('14:30')
    expect(hhmm(to)).toBe('17:00')
  })

  it('picks the next Saturday, not one in the past', () => {
    const { from } = windowFor('saturday3pm', WEDNESDAY)
    expect(from.getTime()).toBeGreaterThan(WEDNESDAY.getTime())
    // 19 Aug 2026 is a Wednesday, so the block is the 22nd.
    expect(from.getDate()).toBe(22)
  })

  it('rolls to next week when asked after the block has finished', () => {
    // Saturday evening: the 3pm block is over. A window entirely in the past
    // would render an empty list that reads as "no value found" rather than
    // "you have missed it".
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

describe('the simplified control surface', () => {
  beforeEach(() => {
    vi.mocked(fetchBetBuilderBookmakers).mockReset().mockResolvedValue(books)
    vi.mocked(fetchBetBuilderCandidates).mockReset().mockResolvedValue({
      bookmaker: {
        code: 'B365', name: 'Bet365', kind: 'bookmaker',
        isRealPrice: true, exchangeCommission: null,
      },
      legs: [], legCount: 0, truncatedAt: 200,
      window: { from: '2026-08-19T00:00:00Z', to: '2026-08-26T00:00:00Z' },
      generatedAt: '2026-08-19T12:00:00Z',
    })
  })

  it('asks for a stake, a target return and a leg count, and nothing else up front', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')

    expect(within(controls).getByLabelText('Stake')).toBeTruthy()
    expect(within(controls).getByLabelText('Target return')).toBeTruthy()
    expect(within(controls).getByLabelText('Legs')).toBeTruthy()

    // The whole point of the change: the long tail of filters is reachable but
    // not in the way. Before this, ten league buttons and a bookmaker select
    // sat permanently between the stake and the results.
    //
    // Asserted structurally rather than by visibility on purpose. jsdom does not
    // implement `details`/`summary` hiding, so a `queryByRole` here finds the
    // league buttons whether or not a real browser would paint them, and a test
    // written that way would pass while proving nothing. What IS true in both is
    // that these controls live inside a `details` that starts closed; the real
    // browser count is evidence in the pull request, not here.
    const disclosure = controls.querySelector('details')
    expect(disclosure).not.toBeNull()
    expect(disclosure?.open).toBe(false)
    expect(disclosure?.contains(within(controls).getByLabelText(/^Bookmaker/))).toBe(true)
    expect(
      disclosure?.contains(within(controls).getByRole('button', { name: 'Premier League' })),
    ).toBe(true)

    // And the three questions the page leads with are NOT inside it.
    for (const field of ['Stake', 'Target return', 'Legs']) {
      expect(disclosure?.contains(within(controls).getByLabelText(field))).toBe(false)
    }

    fireEvent.click(within(controls).getByText(/More filters/))
    await waitFor(() => {
      expect(controls.querySelector('details')?.open).toBe(true)
    })
  })

  it('opens on biggest return, and offers the other three rankings beside it', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')

    expect(
      within(controls).getByRole('button', { name: 'Biggest return' }).getAttribute('aria-pressed'),
    ).toBe('true')
    for (const label of ['Safest', 'Best value', 'Best evidenced']) {
      expect(within(controls).getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('says the target back as BOTH a return and a profit', async () => {
    // One field replaced a three-way choice between no target, a total return
    // and a profit. That is only an honest trade if the page keeps saying which
    // number is which -- £10 returning £50 is £40 of profit, and calling either
    // one "the return" alone is how a research tool starts misleading its owner.
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')

    expect(within(controls).getByText(/No target set/)).toBeTruthy()

    fireEvent.change(within(controls).getByLabelText('Target return'), { target: { value: '50' } })
    await waitFor(() => {
      const readout = within(controls).getByText(/needs combined odds/)
      expect(readout.textContent).toContain('£50.00')
      expect(readout.textContent).toContain('5.00')
      expect(readout.textContent).toContain('£40.00')
      expect(readout.textContent).toMatch(/profit/)
    })
  })

  it('offers the Saturday afternoon window alongside the broader ones', async () => {
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')
    for (const label of ['Next 7 days', 'Today', 'Tomorrow', 'Saturday 3pm', 'All weekend']) {
      expect(within(controls).getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('counts the filters hiding inside the collapsed panel', async () => {
    // A collapsed panel must not be able to silently shrink the result list.
    render(<BetBuilderPanel />)
    const controls = await screen.findByLabelText('Bet Builder controls')
    expect(within(controls).getByText(/^More filters$/)).toBeTruthy()

    fireEvent.click(within(controls).getByText(/More filters/))
    fireEvent.change(within(controls).getByLabelText('Minimum leg odds'), { target: { value: '2' } })
    await waitFor(() => {
      expect(within(controls).getByText(/More filters \(1 active\)/)).toBeTruthy()
    })
  })
})
