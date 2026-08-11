import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type {
  SeasonPlayContext,
  SeasonPlayContextGateway,
} from '../../../src/features/season/seasonPlayContextModel'

const cardGateways: { tournamentId: string; competitionName: string }[] = []

const requestedMatchweeks: number[] = []

vi.mock('../../../src/services/supabase/client', () => ({
  db: { rpc: vi.fn() },
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
      // Records which matchweek the page asked for before refusing. The card's
      // CONTENT is not what this file tests; which matchweek it opens at is.
      load: async (matchweek: number) => {
        requestedMatchweeks.push(matchweek)
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

const ROUTE = '/competitions/:competitionSlug/:seasonSlug/games/match-predictor'
const URL = '/competitions/premier-league/2026-27/games/match-predictor'

function renderRoute(gateway: SeasonPlayContextGateway, path = URL) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTE} element={<SeasonMatchPredictorRoute contextGateway={gateway} />} />
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
    expect(screen.getByRole('heading', { name: 'Premier League' })).toBeInTheDocument()
    expect(screen.getByText('Games').getAttribute('aria-current')).toBe('page')
    expect(cardGateways).toHaveLength(0)
    vi.unstubAllEnvs()
  })

  it('keeps deterministic exits on an unavailable deep link', async () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')

    renderRoute({
      load: async () => {
        throw new Error('That competition season does not exist')
      },
    })

    await waitFor(() =>
      expect(screen.getByText(/could not be found/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Back to Games' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Hub' })).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('announces the wait and keeps deterministic exits', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')

    renderRoute({ load: () => new Promise<SeasonPlayContext>(() => {}) })

    expect(screen.getByText(/loading this competition season/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Games' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Hub' })).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('offers every section of the competition', async () => {
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

describe('opening at a named matchweek', () => {
  // The flow gap: this route always opened at the matchweek the play context
  // called current, so a player looking at a September fixture had no way to
  // reach the card that predicts it.
  beforeEach(() => {
    requestedMatchweeks.length = 0
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('opens the matchweek the link names', async () => {
    renderRoute(resolving, `${URL}?matchweek=7`)
    await waitFor(() => expect(requestedMatchweeks).toContain(7))
  })

  it('opens the current matchweek when the link names none', async () => {
    // The default is unchanged and is still the right one.
    renderRoute(resolving)
    await waitFor(() => expect(requestedMatchweeks).toContain(3))
  })

  it('falls back rather than refusing a matchweek this season does not have', async () => {
    // A stale or shared link should land somewhere useful. 39 is past the
    // season's 38, so the current matchweek answers instead.
    renderRoute(resolving, `${URL}?matchweek=39`)
    await waitFor(() => expect(requestedMatchweeks).toContain(3))
    expect(requestedMatchweeks).not.toContain(39)
  })

  it('ignores a matchweek that is not a number at all', async () => {
    renderRoute(resolving, `${URL}?matchweek=banana`)
    await waitFor(() => expect(requestedMatchweeks).toContain(3))
  })
})
