import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonMatchesPage } from '../../../src/features/season/SeasonMatchesPage'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'
import type { SeasonFixtureWindowGateway } from '../../../src/features/season/useSeasonFixtureWindow'

const ZONE = 'Europe/London'
const FROM = '2026-08-01T00:00:00.000Z'
const TO = '2026-08-22T00:00:00.000Z'

function page(fixtures: Record<string, unknown>[], window = { from: FROM, to: TO }) {
  return mapSeasonFixtureList({
    competition: {
      id: 'season-1',
      name: 'Scottish Premiership',
      season_key: '2026-27',
      time_zone: ZONE,
    },
    window,
    server_now: '2026-08-08T09:00:00Z',
    fixtures,
  })
}

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    kickoff_at: '2026-08-08T14:00:00Z',
    status: 'scheduled',
    round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
    home: { name: 'Dundee', short_code: 'DUN', club_colours: 'Navy / White' },
    away: { name: 'Aberdeen', short_code: 'ABE', club_colours: 'Red / White' },
    result: null,
    live: null,
    ...overrides,
  }
}

function gatewayFor(
  answer: (window: { from?: string; to?: string }) => ReturnType<typeof page> | Error,
): SeasonFixtureWindowGateway {
  return {
    load: vi.fn(async (window: { from?: string; to?: string }) => {
      const result = answer(window)
      if (result instanceof Error) throw result
      return result
    }),
  }
}

describe('the competition matches surface', () => {
  it('asks for no window at all on first load, leaving it to the server', async () => {
    // The browser holds no opinion about where "now" starts. Anchoring the
    // first window locally is how two devices with different clocks would show
    // different fixture lists for the same league.
    const gateway = gatewayFor(() => page([fixture()]))
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('Dundee')).toBeTruthy())
    expect(gateway.load).toHaveBeenCalledWith({})
  })

  it('steps by date from the window the server returned', async () => {
    const gateway = gatewayFor(() => page([fixture()]))
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('Dundee')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Later fixtures' }))

    await waitFor(() =>
      expect(gateway.load).toHaveBeenLastCalledWith({
        from: '2026-08-15T00:00:00.000Z',
        to: '2026-09-05T00:00:00.000Z',
      }),
    )
  })

  it('explains a day that carries two matchweeks rather than leaving it odd', async () => {
    const gateway = gatewayFor(() =>
      page([
        fixture({ id: 'ordinary' }),
        fixture({
          id: 'postponed',
          kickoff_at: '2026-08-08T17:00:00Z',
          round: { id: 'r2', ordinal: 2, label: 'Matchweek 2' },
        }),
      ]),
    )
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('Matchweek 2')).toBeTruthy())
    expect(screen.getByText(/keeps the matchweek it was scheduled in/)).toBeTruthy()
  })

  it('marks a provisional score as provisional, in words', async () => {
    // §11.8: status is never conveyed by colour alone, and a provider's number
    // shown as a plain scoreline reads as a result.
    const gateway = gatewayFor(() =>
      page([
        fixture({
          live: { kind: 'in_play', home: 1, away: 0, observed_at: '2026-08-08T14:30:00Z' },
        }),
      ]),
    )
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('Provisional')).toBeTruthy())
  })

  it('offers to step on rather than saying a season is empty', async () => {
    const gateway = gatewayFor(() => page([]))
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('No fixtures in this period')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Later fixtures' })).toBeTruthy()
  })

  it('shows a failed read as a failure with a retry, never as an empty list', async () => {
    const gateway = gatewayFor(() => new Error('offline'))
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('We could not load these fixtures')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('keeps the club name beside its shirt, never the shirt alone', async () => {
    // DFA-003: the identity is never the sole identifier.
    const gateway = gatewayFor(() => page([fixture()]))
    render(<SeasonMatchesPage gateway={gateway} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getByText('Dundee')).toBeTruthy())
    expect(screen.getByText('Aberdeen')).toBeTruthy()
  })
})
