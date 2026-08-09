import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonFixturePreview } from '../../../src/features/season/SeasonFixturePreview'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'
import type { SeasonFixtureWindowGateway } from '../../../src/features/season/useSeasonFixtureWindow'

/**
 * Overview's fixtures card.
 *
 * The ordering, the upcoming/results choice and the provisional rule are proven
 * against `previewFixtures` in `fixtureListModel.test.ts`, where they are pure
 * functions of the read. What is asserted here is what the CARD does with them:
 * the heading it chooses, that it never dresses a failure as an empty week, and
 * that it does not grow a stepper.
 */

const ZONE = 'Europe/London'

function page(fixtures: Record<string, unknown>[]) {
  return mapSeasonFixtureList({
    competition: {
      id: 'season-1',
      name: 'Scottish Premiership',
      season_key: '2026-27',
      time_zone: ZONE,
    },
    window: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-22T00:00:00.000Z' },
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

function gatewayFor(answer: () => ReturnType<typeof page> | Error): SeasonFixtureWindowGateway {
  return {
    load: vi.fn(async () => {
      const result = answer()
      if (result instanceof Error) throw result
      return result
    }),
  }
}

function renderPreview(
  answer: () => ReturnType<typeof page> | Error,
  onSeeAll = vi.fn(),
  limit?: number,
) {
  const gateway = gatewayFor(answer)
  render(
    <SeasonFixturePreview
      gateway={gateway}
      timeZone={ZONE}
      onSeeAll={onSeeAll}
      limit={limit}
    />,
  )
  return { gateway, onSeeAll }
}

describe('the Overview fixtures card', () => {
  it('says "Next up" over fixtures still to be played', async () => {
    renderPreview(() => page([fixture()]))

    await waitFor(() => expect(screen.getByText('Next up')).toBeTruthy())
    expect(screen.queryByText('Latest results')).toBeNull()
  })

  it('says "Latest results" rather than "Next up" over finished matches', async () => {
    // A "Next up" heading over a list of played matches is the kind of small
    // untruth that costs a surface its credibility.
    renderPreview(() =>
      page([fixture({ status: 'played', result: { home: 2, away: 1 } })]),
    )

    await waitFor(() => expect(screen.getByText('Latest results')).toBeTruthy())
  })

  it('names what it is not showing, so four rows do not read as the fortnight', async () => {
    renderPreview(
      () =>
        page([
          fixture({ id: 'a', kickoff_at: '2026-08-08T12:00:00Z' }),
          fixture({ id: 'b', kickoff_at: '2026-08-08T14:00:00Z' }),
          fixture({ id: 'c', kickoff_at: '2026-08-08T17:00:00Z' }),
        ]),
      vi.fn(),
      1,
    )

    await waitFor(() => expect(screen.getByText('+2 more')).toBeTruthy())
  })

  it('shows a failed read as failed, never as a quiet week', async () => {
    // "No fixtures" would tell a player their league is not playing, which is a
    // different and wrong thing to say.
    renderPreview(() => new Error('offline'))

    await waitFor(() =>
      expect(screen.getByText('These fixtures could not be loaded')).toBeTruthy(),
    )
    expect(screen.queryByText(/Nothing is scheduled/)).toBeNull()
  })

  it('offers no stepper, because stepping the season is the Matches section', async () => {
    renderPreview(() => page([fixture()]))

    await waitFor(() => expect(screen.getByText('Next up')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Earlier fixtures' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Later fixtures' })).toBeNull()
  })

  it('hands the season off to the Matches section rather than growing into one', async () => {
    const { onSeeAll } = renderPreview(() => page([fixture()]))

    const link = await screen.findByRole('button', { name: 'All fixtures and results' })
    fireEvent.click(link)
    expect(onSeeAll).toHaveBeenCalledOnce()
  })

  it('speaks one fixture per row, day included', async () => {
    // The visual row is three aria-hidden columns; the spoken row is one
    // sentence, which is the only way "Dundee against Aberdeen" survives being
    // read out as a grid.
    renderPreview(() => page([fixture()]))

    await waitFor(() =>
      expect(screen.getByText(/Dundee against Aberdeen, kick-off/)).toBeTruthy(),
    )
  })

  it('reads the window once for a card that cannot be stepped', async () => {
    const { gateway } = renderPreview(() => page([fixture()]))

    await waitFor(() => expect(screen.getByText('Next up')).toBeTruthy())
    expect(gateway.load).toHaveBeenCalledTimes(1)
  })
})
