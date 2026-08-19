import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeasonPlayContext } from '../../../src/features/season/seasonPlayContextModel'

/**
 * The season Matches route.
 *
 * `client.ts` throws without configuration, so it is replaced or the route
 * could not be imported at all; the fixtures wrapper is replaced too, so the
 * assertions below are about the route's own decisions — which season it
 * resolves and which matchweek it opens at — rather than about a stubbed
 * `supabase.rpc`. The context gateway is injected as a prop, which is the
 * seam the route already exposes for exactly this.
 */

const mocks = vi.hoisted(() => ({
  fetchSeasonFixtureList: vi.fn(),
}))

vi.mock('../../../src/services/supabase/client', () => ({
  db: { rpc: vi.fn() },
}))

vi.mock('../../../src/services/supabase/seasonFixtureList', () => ({
  fetchSeasonFixtureList: mocks.fetchSeasonFixtureList,
}))

import { SeasonMatchesRoute } from '../../../src/features/season/SeasonMatchesRoute'

const TOURNAMENT_ID = '6a64a59b-b721-443e-a864-0fd52db1edbd'

function context(overrides: Partial<SeasonPlayContext> = {}): SeasonPlayContext {
  return {
    tournamentId: TOURNAMENT_ID,
    competitionName: 'Scottish Premiership',
    seasonLabel: '2026/27',
    timeZone: 'Europe/London',
    status: 'active',
    matchweek: 2,
    matchweekCount: 38,
    locksAt: '2026-08-08T14:00:00+00:00',
    ...overrides,
  }
}

function renderRoute(load: () => Promise<SeasonPlayContext>) {
  render(
    <MemoryRouter initialEntries={['/competitions/scottish-premiership/2026-27/matches']}>
      <Routes>
        <Route
          path="/competitions/:competitionSlug/:seasonSlug/matches"
          element={<SeasonMatchesRoute contextGateway={{ load }} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the season matches route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchSeasonFixtureList.mockResolvedValue({
      competition: {
        id: TOURNAMENT_ID,
        name: 'Scottish Premiership',
        seasonKey: '2026-27',
        timeZone: 'Europe/London',
      },
      window: { from: '2026-08-01T00:00:00Z', to: '2026-08-22T00:00:00Z' },
      serverNow: '2026-08-08T09:00:00Z',
      fixtures: [
        {
          id: 'a',
          kickoffAt: '2026-08-08T14:00:00+00:00',
          status: 'scheduled',
          round: { id: 'r2', ordinal: 2, label: 'Matchweek 2' },
          // Contract 206. The decoder always supplies this, so a mock that
          // omits it is describing a payload the gateway cannot produce.
          schedule: { kickoffConfirmed: true, rescheduled: false, originalKickoffAt: null },
          home: { name: 'Dundee', tokens: { monogram: 'DUN', primary: '#123456' } },
          away: { name: 'Aberdeen', tokens: { monogram: 'ABE', primary: '#654321' } },
          result: null,
          live: null,
        },
      ],
    })
  })

  it('resolves the season from the URL and reads its fixtures', async () => {
    renderRoute(async () => context())

    // No matchweek argument: the window is the server's own default, which is
    // what stops a postponed fixture being filed under the wrong heading.
    await waitFor(() =>
      expect(mocks.fetchSeasonFixtureList).toHaveBeenCalledWith(TOURNAMENT_ID, {}),
    )
    expect(await screen.findByText('Dundee')).toBeTruthy()
  })

  it('renders inside the competition shell, naming the competition', async () => {
    renderRoute(async () => context())

    // By role: the masthead heading names the competition and so does the
    // compact selector beside it, which is deliberate.
    expect(
      await screen.findByRole('heading', { name: 'Scottish Premiership' }),
    ).toBeTruthy()
    expect(screen.getByRole('navigation', { name: /sections/ })).toBeTruthy()
  })

  it('asks nothing about membership — fixtures belong to the competition', async () => {
    // The one read is the play context; there is deliberately no hub-membership
    // call, because whether the caller joined a game does not decide whether a
    // league has fixtures.
    renderRoute(async () => context())

    await screen.findByText('Dundee')
    // If membership were consulted the route would need a second gateway; the
    // only one it takes is the context.
    expect(mocks.fetchSeasonFixtureList).toHaveBeenCalledTimes(1)
  })

  it('opens a finished season rather than refusing, and asks for no matchweek', async () => {
    // The Match Predictor route stops at `season_over`, correctly — there is
    // nothing left to enter. A season with every matchweek played is a season
    // with every result to read. It used to open at the LAST matchweek; the
    // window read makes that question go away entirely.
    renderRoute(async () => context({ matchweek: null }))

    await waitFor(() =>
      expect(mocks.fetchSeasonFixtureList).toHaveBeenCalledWith(TOURNAMENT_ID, {}),
    )
  })

  it('reports an unknown season instead of resolving nothing', async () => {
    renderRoute(async () => {
      throw new Error('That competition season does not exist')
    })

    expect(await screen.findByText('This competition season could not be found')).toBeTruthy()
    expect(mocks.fetchSeasonFixtureList).not.toHaveBeenCalled()
  })

  it('shows a failed resolve as a failure, never as an empty page', async () => {
    renderRoute(async () => {
      throw new Error('offline')
    })

    expect(await screen.findByText('This season could not be loaded')).toBeTruthy()
  })

  it('offers the canonical Games destination from within the shell', async () => {
    renderRoute(async () => context())

    await screen.findByRole('heading', { name: 'Scottish Premiership' })
    const games = screen.getByRole('link', { name: 'Games' })
    expect(games.getAttribute('href')).toBe('/competitions/scottish-premiership/2026-27/games')
  })
})
