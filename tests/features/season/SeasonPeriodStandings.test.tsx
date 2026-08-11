import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonPeriodStandings } from '../../../src/features/season/SeasonPeriodStandings'
import type { SeasonPeriodStandingsGateway } from '../../../src/features/season/periodStandingsModel'
import type { SeasonPeriodStandings as Payload } from '../../../src/services/supabase/seasonPeriodStandings'

function row(
  entryId: string,
  rank: number,
  points: number,
  played = 3,
  displayName: string | null = null,
) {
  return { entryId, rank, points, matchweeksPlayed: played, displayName }
}

function gatewayFor(
  byPeriod: Partial<Record<'month' | 'form', Payload | Error>>,
  entryId: string | null = 'mine',
): SeasonPeriodStandingsGateway {
  return {
    load: vi.fn(async (period: 'month' | 'form') => {
      const answer = byPeriod[period]
      if (!answer) throw new Error('no fixture for this period')
      if (answer instanceof Error) throw answer
      return answer
    }),
    myEntryId: vi.fn(async () => entryId),
  }
}

const FORM: Payload = {
  period: 'form',
  window: 5,
  rows: [row('mine', 1, 30), row('theirs', 2, 21)],
}

const MONTHS: Payload = {
  period: 'month',
  months: [
    { month: '2026-08', rows: [row('mine', 2, 12)] },
    { month: '2026-09', rows: [row('mine', 1, 24)] },
  ],
}

describe('the season period standings panel', () => {
  it('opens on recent form and marks the caller', async () => {
    render(<SeasonPeriodStandings gateway={gatewayFor({ form: FORM })} />)

    expect(await screen.findByText(/You are 1 of 2/)).toBeTruthy()
  })

  it('renders a rival by name when the server names them, and never by entry id', async () => {
    render(
      <SeasonPeriodStandings
        gateway={gatewayFor({
          form: {
            period: 'form',
            window: 5,
            rows: [row('mine', 1, 30, 3, 'Sam'), row('theirs', 2, 21, 3, 'Alex')],
          },
        })}
      />,
    )

    expect(await screen.findByText('Alex')).toBeTruthy()
    // The caller stays "You" even though the server named them too.
    expect(screen.queryByText('Sam')).toBeNull()
    expect(screen.queryByText(/theirs/)).toBeNull()
  })

  it('states that neither view decides the season', async () => {
    // ADR 0012: the cumulative total is the only ranking that settles it. A
    // monthly winner must not read as a rival claim to the table above.
    render(<SeasonPeriodStandings gateway={gatewayFor({ form: FORM })} />)

    expect(await screen.findByText(/decided by the overall table above/)).toBeTruthy()
  })

  it('loads the months from the server when the player switches, never derives them', async () => {
    // The two views are different server answers over the same scores;
    // deriving one from the other would put ADR 0012's retention rules in the
    // browser.
    const gateway = gatewayFor({ form: FORM, month: MONTHS })
    render(<SeasonPeriodStandings gateway={gateway} />)

    await screen.findByText(/You are 1 of 2/)
    fireEvent.click(screen.getByRole('radio', { name: 'By month' }))

    await waitFor(() => expect(gateway.load).toHaveBeenCalledWith('month'))
    expect(await screen.findByText('September 2026')).toBeTruthy()
  })

  it('reads months newest first', async () => {
    render(<SeasonPeriodStandings gateway={gatewayFor({ form: FORM, month: MONTHS })} />)

    await screen.findByText(/You are 1 of 2/)
    fireEvent.click(screen.getByRole('radio', { name: 'By month' }))

    const headings = await screen.findAllByRole('heading', { level: 4 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'September 2026',
      'August 2026',
    ])
  })

  it('reads the caller’s own entry once, not once per period', async () => {
    const gateway = gatewayFor({ form: FORM, month: MONTHS })
    render(<SeasonPeriodStandings gateway={gateway} />)

    await screen.findByText(/You are 1 of 2/)
    fireEvent.click(screen.getByRole('radio', { name: 'By month' }))
    await screen.findByText('September 2026')

    expect(gateway.myEntryId).toHaveBeenCalledTimes(1)
  })

  it('shows a failed month read as a failure, never as "no months yet"', async () => {
    // The read raises when a settled matchweek has no play window, precisely
    // so an operator learns the calendar was never derived. Rendering that as
    // an empty state would throw the signal away.
    render(
      <SeasonPeriodStandings
        gateway={gatewayFor({ form: FORM, month: new Error('no play window') })}
      />,
    )

    await screen.findByText(/You are 1 of 2/)
    fireEvent.click(screen.getByRole('radio', { name: 'By month' }))

    expect(await screen.findByText('We could not load this view')).toBeTruthy()
    expect(screen.queryByText('Nothing settled yet')).toBeNull()
  })

  it('says nothing has settled rather than rendering an empty table', async () => {
    render(
      <SeasonPeriodStandings
        gateway={gatewayFor({ form: { period: 'form', window: 5, rows: [] } })}
      />,
    )

    expect(await screen.findByText('Nothing settled yet')).toBeTruthy()
  })

  it('explains that form counts each player’s own last matchweeks', async () => {
    // A missed matchweek is not counted as a blank — the window is a count of
    // the player's own settled rounds, not a range of the season's.
    render(<SeasonPeriodStandings gateway={gatewayFor({ form: FORM })} />)

    expect(await screen.findByText(/not the season’s last 5/)).toBeTruthy()
  })

  it('names no opponent, because the read discloses none', async () => {
    render(<SeasonPeriodStandings gateway={gatewayFor({ form: FORM })} />)

    await screen.findByText(/You are 1 of 2/)
    expect(screen.getAllByText('Entrant').length).toBe(1)
    expect(screen.queryByText('theirs')).toBeNull()
  })

  it('says how many players a truncated table holds', async () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row(`entry-${index}`, index + 1, 100 - index),
    )
    render(
      <SeasonPeriodStandings gateway={gatewayFor({ form: { period: 'form', window: 5, rows } })} />,
    )

    expect(await screen.findByText('Top 10 of 25 players.')).toBeTruthy()
  })
})
