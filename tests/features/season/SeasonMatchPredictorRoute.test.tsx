import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type {
  SeasonPlayContext,
  SeasonPlayContextGateway,
} from '../../../src/features/season/seasonPlayContextModel'

/**
 * The season Match Predictor route.
 *
 * Two Supabase modules are replaced here rather than one. `client.ts` throws
 * without configuration, so importing the route at all would fail; but mocking
 * only the client would leave the real card gateway calling `supabase.rpc`
 * against a stub, and the assertions would then be about the stub. Replacing
 * both gateways keeps this file about the route's own decisions: which page it
 * shows, and which season it hands to the card.
 *
 * THE FLAG ASSERTION IS THE ONE WITH A RELEASE GATE BEHIND IT. §13.4 requires
 * a flag to restore the previous journey with no data rollback. There was never
 * a legacy season card, so the previous journey at this address is that the
 * address did not exist — and a 404 is the only honest restoration of it. A
 * degraded card, or the season shell with an empty body, would be a new
 * surface invented by the rollback.
 */

const cardGateways: { tournamentId: string; competitionName: string }[] = []

vi.mock('../../../src/services/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}))

vi.mock('../../../src/services/supabase/seasonMatchPredictor', () => ({
  createSeasonMatchPredictorRpcGateway: (options: {
    tournamentId: string
    competitionName: string
  }) => {
    cardGateways.push({
      tournamentId: options.tournamentId,
      competitionName: options.competitionName,
    })
    return {
      load: async () => {
        throw new Error('the card read is not what this file is testing')
      },
      apply: async () => {},
    }
  },
}))

const { SeasonMatchPredictorRoute } = await import(
  '../../../src/features/season/SeasonMatchPredictorRoute'
)

function context(over: Partial<SeasonPlayContext> = {}): SeasonPlayContext {
  return {
    tournamentId: 'pl-2026-27',
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    timeZone: 'Europe/London',
    status: 'draft',
    matchweek: 3,
    matchweekCount: 38,
    locksAt: '2026-08-13T11:30:00Z',
    ...over,
  }
}

function renderRoute(gateway: SeasonPlayContextGateway, path = '/competitions/premier-league/2026-27/main-predictor') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/competitions/:competitionSlug/:seasonSlug/main-predictor"
          element={<SeasonMatchPredictorRoute contextGateway={gateway} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

const resolving: SeasonPlayContextGateway = { load: async () => context() }

describe('with the flag off', () => {
  it('renders the page that existed at this address before the flag did', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', '')
    renderRoute(resolving)

    expect(screen.getByText('404')).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('does not read the season at all', async () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', '')
    let calls = 0
    renderRoute({
      load: async () => {
        calls += 1
        return context()
      },
    })

    await Promise.resolve()
    // A rolled-back journey that still queries is not rolled back: it keeps
    // the load on the database and the failure modes on the page.
    expect(calls).toBe(0)
    vi.unstubAllEnvs()
  })

  it('fails closed on anything that is not exactly "true"', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'TRUE')
    renderRoute(resolving)

    expect(screen.getByText('404')).toBeInTheDocument()
    vi.unstubAllEnvs()
  })
})

describe('with the flag on', () => {
  it('hands the card the season the URL named', async () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')
    cardGateways.length = 0

    renderRoute({
      load: async (slug, seasonKey) =>
        context({ tournamentId: `${slug}/${seasonKey}` }),
    })

    await waitFor(() => expect(cardGateways).toHaveLength(1))
    // The whole reason contract 121 exists: the id under the card is the one
    // the address resolved to, not a constant and not the first season found.
    expect(cardGateways[0]?.tournamentId).toBe('premier-league/2026-27')
    expect(cardGateways[0]?.competitionName).toBe('Premier League')
    vi.unstubAllEnvs()
  })

  it('says the season is finished rather than opening an empty card', async () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')
    cardGateways.length = 0

    renderRoute({ load: async () => context({ matchweek: null }) })

    await waitFor(() =>
      expect(screen.getByText(/no matchweek left to play/i)).toBeInTheDocument(),
    )
    // The competition is still named — a finished season is still the player's
    // season, and dropping its identity would read like an error page.
    expect(screen.getByText('Premier League')).toBeInTheDocument()
    expect(cardGateways).toHaveLength(0)
    vi.unstubAllEnvs()
  })

  it('sends a mistyped address back to the hub rather than to a retry', async () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')

    renderRoute({
      load: async () => {
        throw new Error('That competition season does not exist')
      },
    })

    await waitFor(() =>
      expect(screen.getByText(/could not be found/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /back to hub/i })).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('announces the wait instead of showing an empty page', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')

    renderRoute({ load: () => new Promise<SeasonPlayContext>(() => {}) })

    expect(screen.getByText(/loading this competition season/i)).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('offers every section of the competition, on the page a player lives on', async () => {
    // This route rendered the shell with NO destinations at all, so Overview,
    // Play, Matches, Games and Leagues were five inert labels on the busiest
    // page in the product. It is exactly the drift the shared destination map
    // exists to stop, and this route was the one that had not adopted it.
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')

    renderRoute({ load: async () => context({ matchweek: null }) })

    const matches = await screen.findByRole('link', { name: 'Matches' })
    expect(matches.getAttribute('href')).toBe('/competitions/premier-league/2026-27/matches')
    expect(screen.getByRole('link', { name: 'Leagues' }).getAttribute('href')).toBe(
      '/competitions/premier-league/2026-27/leagues',
    )
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('href')).toBe(
      '/competitions/premier-league/2026-27',
    )
    vi.unstubAllEnvs()
  })
})
