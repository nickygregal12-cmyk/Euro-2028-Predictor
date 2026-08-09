import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CompetitionDashboardPage,
  CompetitionGamesPage,
} from '../../../src/features/hub/CompetitionDashboardPage'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'
import type { CompetitionGame } from '../../../src/services/supabase/competitionGamesModel'

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
  registerBonusCompetition: vi.fn<() => Promise<void>>(),
  withdrawBonusCompetition: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))

vi.mock('../../../src/services/supabase/bonusGames', () => ({
  registerBonusCompetition: mocks.registerBonusCompetition,
  withdrawBonusCompetition: mocks.withdrawBonusCompetition,
}))

// Overview's weekly summary asks each joined game's own read. These stand in
// for the three Supabase-backed gateway factories it builds; the summary's own
// behaviour is proven against `competitionWeekModel` directly, so what matters
// here is only that the dashboard still renders while they answer.
vi.mock('../../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({ load: () => new Promise(() => {}) }),
}))

vi.mock('../../../src/services/supabase/seasonMatchPredictor', () => ({
  createSeasonMatchPredictorRpcGateway: () => ({ load: () => new Promise(() => {}) }),
}))

vi.mock('../../../src/services/supabase/seasonLms', () => ({
  createSeasonLmsRpcGateway: () => ({ load: () => new Promise(() => {}) }),
}))

vi.mock('../../../src/services/supabase/seasonCupPlayer', () => ({
  createSeasonCupPlayerViewRpcGateway: () => ({ load: () => new Promise(() => {}) }),
}))

// Overview's fixtures card. Its own behaviour is proven against
// `previewFixtures` and `SeasonFixturePreview` directly; here it only needs to
// not tear the page down while it loads.
vi.mock('../../../src/services/supabase/seasonFixtureList', () => ({
  fetchSeasonFixtureList: () => new Promise(() => {}),
}))

const MAIN_PREDICTOR_ID = '60000000-0000-0000-0000-000000000101'
const SERVER_NOW = '2026-08-06T12:00:00Z'

function served(overrides: Partial<CompetitionGame> = {}): CompetitionGame {
  return {
    id: MAIN_PREDICTOR_ID,
    gameKey: 'main_predictor',
    active: true,
    displayName: 'Main Predictor',
    registrationOpensAt: '2026-08-01T09:00:00Z',
    registrationClosesAt: '2026-09-01T09:00:00Z',
    completedAt: null,
    allowRejoin: false,
    membership: null,
    ...overrides,
  }
}

function season(games: CompetitionGame[]): HubSeasonMembership[] {
  return [
    {
      seasonName: 'Premier League 2026/27',
      tournamentId: '60000000-0000-0000-0000-000000000001',
      seasonStatus: 'active',
      seasonGames: { competitionMember: true, serverNow: SERVER_NOW, games },
    },
  ]
}

function renderRoute(element: React.ReactNode, path: string, url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

const BASE = '/competitions/:competitionSlug/:seasonSlug'
const URL = '/competitions/premier-league/2026-27'

function renderGames() {
  renderRoute(<CompetitionGamesPage />, `${BASE}/games`, `${URL}/games`)
}

describe('competition Overview and Games', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.registerBonusCompetition.mockResolvedValue(undefined)
    mocks.withdrawBonusCompetition.mockResolvedValue(undefined)
  })

  it('keeps Overview distinct and sends game discovery to Games', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderRoute(<CompetitionDashboardPage />, BASE, URL)

    const games = await screen.findByRole('button', { name: 'View games' })
    expect(screen.queryByRole('button', { name: 'Join game' })).toBeNull()
    games.click()
  })

  it('joins the game the server named, addressing it by the id from the read', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderGames()

    const join = await screen.findByRole('button', { name: 'Join game' })
    join.click()

    await waitFor(() =>
      expect(mocks.registerBonusCompetition).toHaveBeenCalledWith(MAIN_PREDICTOR_ID),
    )
  })

  it('leaves when the caller is an active entrant', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([
        served({
          membership: {
            status: 'active',
            joinedAt: '2026-08-02T09:00:00Z',
            leftAt: null,
            disqualifiedAt: null,
          },
        }),
      ]),
    )
    renderGames()

    const leave = await screen.findByRole('button', { name: 'Leave game' })
    leave.click()

    await waitFor(() =>
      expect(mocks.withdrawBonusCompetition).toHaveBeenCalledWith(MAIN_PREDICTOR_ID),
    )
  })

  it('shows the server’s membership rather than the catalogue’s constant', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([
        served({
          membership: {
            status: 'active',
            joinedAt: '2026-08-02T09:00:00Z',
            leftAt: null,
            disqualifiedAt: null,
          },
        }),
      ]),
    )
    renderGames()

    await waitFor(() => expect(screen.getByText('Joined')).toBeTruthy())
  })

  it('states a refusal as a sentence instead of rendering a dead button', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([served({ registrationClosesAt: '2026-08-02T09:00:00Z' })]),
    )
    renderGames()

    await waitFor(() => expect(screen.getByText('Entry has closed for this game.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Join game' })).toBeNull()
  })

  it('surfaces a write refusal without claiming which rule refused it', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    mocks.registerBonusCompetition.mockRejectedValueOnce(
      Object.assign(new Error('Registration has closed'), { code: '55000' }),
    )
    renderGames()

    const join = await screen.findByRole('button', { name: 'Join game' })
    join.click()

    await waitFor(() =>
      expect(screen.getByText('That change is not allowed right now.')).toBeTruthy(),
    )
  })

  it('claims no membership either way when the read fails', async () => {
    mocks.fetchHubMembership.mockRejectedValue(new Error('offline'))
    renderGames()

    await waitFor(() => expect(screen.getByText('Couldn’t check your entries')).toBeTruthy())
    expect(screen.queryByText('Joined')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Join game' })).toBeNull()
  })

  it('offers all three domestic games from Games', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderGames()

    await waitFor(() => expect(screen.getByText('Match Predictor')).toBeTruthy())
    expect(screen.getByText('Last Man Standing')).toBeTruthy()
    expect(screen.getByText('Predictor Championship')).toBeTruthy()
  })

  it('provides Back to Hub on competition routes', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderGames()

    const back = await screen.findByRole('link', { name: 'Back to Hub' })
    expect(back.getAttribute('href')).toBe('/')
  })
})
