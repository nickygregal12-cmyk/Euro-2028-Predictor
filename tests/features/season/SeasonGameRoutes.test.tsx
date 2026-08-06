import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'
import type { CompetitionGame } from '../../../src/services/supabase/competitionGamesModel'

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
  fetchSeasonLeaderboardPage: vi.fn(),
  fetchSeasonPeriodStandings: vi.fn(),
  fetchMyEntryId: vi.fn(),
  createSeasonLmsRpcGateway: vi.fn(),
  createSeasonLmsRegistrationRpcGateway: vi.fn(),
  createSeasonCupRpcGateway: vi.fn(),
  fetchMyGameLeagues: vi.fn(),
  createGameLeague: vi.fn(),
  joinLeague: vi.fn(),
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))
vi.mock('../../../src/services/supabase/seasonLeaderboard', () => ({
  fetchSeasonLeaderboardPage: mocks.fetchSeasonLeaderboardPage,
}))
vi.mock('../../../src/services/supabase/seasonLms', () => ({
  createSeasonLmsRpcGateway: mocks.createSeasonLmsRpcGateway,
}))
vi.mock('../../../src/services/supabase/seasonLmsRegistration', () => ({
  createSeasonLmsRegistrationRpcGateway: mocks.createSeasonLmsRegistrationRpcGateway,
}))
vi.mock('../../../src/services/supabase/seasonCup', () => ({
  createSeasonCupRpcGateway: mocks.createSeasonCupRpcGateway,
}))
vi.mock('../../../src/services/supabase/seasonPeriodStandings', () => ({
  fetchSeasonPeriodStandings: mocks.fetchSeasonPeriodStandings,
  fetchMyEntryId: mocks.fetchMyEntryId,
}))
vi.mock('../../../src/services/supabase/gameLeagues', () => ({
  fetchMyGameLeagues: mocks.fetchMyGameLeagues,
  createGameLeague: mocks.createGameLeague,
}))
vi.mock('../../../src/services/supabase/leagues', () => ({
  joinLeague: mocks.joinLeague,
}))
vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}))

import {
  SeasonChampionshipRoute,
  SeasonLeaguesRoute,
  SeasonLmsRoute,
  SeasonPlayRoute,
  SeasonStandingsRoute,
} from '../../../src/features/season/SeasonGameRoutes'

const TOURNAMENT_ID = '60000000-0000-0000-0000-000000000001'
const LMS_ID = '60000000-0000-0000-0000-000000000102'
const CUP_ID = '60000000-0000-0000-0000-000000000103'
const ACTIVE = { status: 'active', joinedAt: null, leftAt: null, disqualifiedAt: null }

function game(overrides: Partial<CompetitionGame>): CompetitionGame {
  return {
    id: 'game-1',
    gameKey: 'main_predictor',
    active: true,
    displayName: 'Main Predictor',
    registrationOpensAt: null,
    registrationClosesAt: null,
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
      tournamentId: TOURNAMENT_ID,
      seasonStatus: 'active',
      seasonGames: {
        competitionMember: true,
        serverNow: '2026-08-06T12:00:00Z',
        games,
      },
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

const DASHBOARD = '/competitions/:competitionSlug/:seasonSlug'

describe('the season game routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSeasonLmsRpcGateway.mockReturnValue({ load: vi.fn(), pick: vi.fn() })
    mocks.createSeasonCupRpcGateway.mockReturnValue({ load: vi.fn(() => new Promise(() => {})) })
    mocks.createSeasonLmsRegistrationRpcGateway.mockReturnValue({
      load: vi.fn(() => new Promise(() => {})),
      join: vi.fn(),
    })
    mocks.fetchSeasonLeaderboardPage.mockReturnValue(new Promise(() => {}))
    mocks.fetchSeasonPeriodStandings.mockReturnValue(new Promise(() => {}))
    mocks.fetchMyEntryId.mockResolvedValue(null)
    mocks.fetchMyGameLeagues.mockResolvedValue([])
  })

  it('resolves the season from the URL and hands the standings its id', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/premier-league/2026-27/standings',
    )

    // The catalogue's exact season row name, never a slug turned into an id.
    await waitFor(() =>
      expect(mocks.fetchHubMembership).toHaveBeenCalledWith(['Premier League 2026/27']),
    )
    await waitFor(() =>
      expect(mocks.fetchSeasonLeaderboardPage).toHaveBeenCalledWith(TOURNAMENT_ID, {
        after: null,
      }),
    )
  })

  it('gives Last Man Standing both its season and its competition id', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: LMS_ID, gameKey: 'last_man_standing' })]),
    )

    renderRoute(
      <SeasonLmsRoute />,
      `${DASHBOARD}/last-man-standing`,
      '/competitions/premier-league/2026-27/last-man-standing',
    )

    await waitFor(() =>
      expect(mocks.createSeasonLmsRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
      }),
    )
    // Registration needs the competition, which only the server read supplies.
    await waitFor(() =>
      expect(mocks.createSeasonLmsRegistrationRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
        competitionId: LMS_ID,
        userId: 'user-1',
      }),
    )
  })

  it('gives the Championship the competition id the read named', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: CUP_ID, gameKey: 'predictor_cup' })]),
    )

    renderRoute(
      <SeasonChampionshipRoute />,
      `${DASHBOARD}/championship`,
      '/competitions/premier-league/2026-27/championship',
    )

    await waitFor(() =>
      expect(mocks.createSeasonCupRpcGateway).toHaveBeenCalledWith({
        competitionId: CUP_ID,
      }),
    )
  })

  it('renders inside the competition shell, naming the competition', async () => {
    // Consistency with the Match Predictor route: every season game page sits
    // in the same shell, so competition identity does not appear and vanish
    // between one game and the next.
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/premier-league/2026-27/standings',
    )

    await waitFor(() => expect(screen.getByText('Premier League')).toBeTruthy())
    expect(screen.getByRole('navigation', { name: /sections/ })).toBeTruthy()
  })

  it('gives the scrollable sub-nav keyboard access, and a real way back to Overview', async () => {
    // `scrollable-region-focusable`, serious: §7.3 makes this bar scroll
    // horizontally on narrow screens, and when every item in it was a
    // non-interactive label the region had no keyboard-focusable content — a
    // keyboard or switch user could neither reach it nor scroll it. The mobile
    // browser suite caught it the first time the shell was ever scanned.
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/premier-league/2026-27/standings',
    )

    const nav = await screen.findByRole('navigation', { name: /sections/ })
    expect(nav.getAttribute('tabindex')).toBe('0')

    // Overview is a real destination, so the region also has focusable content
    // of its own rather than only being reachable as a scroll container.
    const overview = screen.getByRole('link', { name: 'Overview' })
    expect(overview.getAttribute('href')).toBe('/competitions/premier-league/2026-27')

    // The sections with no season implementation stay labels, not dead links.
    expect(screen.queryByRole('link', { name: 'Matches' })).toBeNull()
  })

  it('does not dress the shell with a placeholder identity before the season resolves', async () => {
    // A masthead reading "Competition" would assert something untrue while the
    // read is still in flight.
    mocks.fetchHubMembership.mockReturnValue(new Promise(() => {}))

    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/premier-league/2026-27/standings',
    )

    expect(screen.queryByRole('navigation', { name: /sections/ })).toBeNull()
  })

  it('gives the Championship a registration gateway, so "not entered" is not a dead end', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: CUP_ID, gameKey: 'predictor_cup' })]),
    )

    renderRoute(
      <SeasonChampionshipRoute />,
      `${DASHBOARD}/championship`,
      '/competitions/premier-league/2026-27/championship',
    )

    // Entry is join_competition_game for every game key, so the Championship
    // uses the same gateway the LMS route does.
    await waitFor(() =>
      expect(mocks.createSeasonLmsRegistrationRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
        competitionId: CUP_ID,
        userId: 'user-1',
      }),
    )
  })

  it('lists only the joined games on Play, and links each to its surface', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([
        game({ id: CUP_ID, gameKey: 'predictor_cup', membership: ACTIVE }),
        game({ id: LMS_ID, gameKey: 'last_man_standing' }),
      ]),
    )

    renderRoute(
      <SeasonPlayRoute />,
      `${DASHBOARD}/play`,
      '/competitions/premier-league/2026-27/play',
    )

    const link = await screen.findByRole('link', { name: /Predictor Championship/ })
    expect(link.getAttribute('href')).toBe('/competitions/premier-league/2026-27/championship')
    // Not joined, so not listed — that is what separates Play from Overview.
    expect(screen.queryByText('Last Man Standing')).toBeNull()
  })

  it('points an empty Play at Overview rather than rendering a bare empty list', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(
      <SeasonPlayRoute />,
      `${DASHBOARD}/play`,
      '/competitions/premier-league/2026-27/play',
    )

    await waitFor(() =>
      expect(screen.getByText('You have not joined a game here yet')).toBeTruthy(),
    )
    const overview = screen.getByRole('link', { name: /See the games/ })
    expect(overview.getAttribute('href')).toBe('/competitions/premier-league/2026-27')
  })

  it('says so when the season does not list the game, rather than rendering blank', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(
      <SeasonChampionshipRoute />,
      `${DASHBOARD}/championship`,
      '/competitions/premier-league/2026-27/championship',
    )

    await waitFor(() =>
      expect(
        screen.getByText('The Predictor Championship is not part of this season'),
      ).toBeTruthy(),
    )
    expect(mocks.createSeasonCupRpcGateway).not.toHaveBeenCalled()
  })

  it('reports an unknown competition slug instead of resolving nothing', async () => {
    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/not-a-league/1999-00/standings',
    )

    await waitFor(() =>
      expect(screen.getByText('This competition season could not be found.')).toBeTruthy(),
    )
    expect(mocks.fetchHubMembership).not.toHaveBeenCalled()
  })

  it('scopes the leagues surface to the season’s Main Predictor competition', async () => {
    // A private league belongs to a game, not to a competition: ADR 0011 keeps
    // each game's standings its own and `leagues.game_competition_id` says the
    // same in storage. The season row id would be the wrong key.
    const MAIN_ID = '60000000-0000-0000-0000-000000000101'
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: MAIN_ID, gameKey: 'main_predictor' })]),
    )

    renderRoute(
      <SeasonLeaguesRoute />,
      `${DASHBOARD}/leagues`,
      '/competitions/premier-league/2026-27/leagues',
    )

    await waitFor(() => expect(mocks.fetchMyGameLeagues).toHaveBeenCalledWith(MAIN_ID))
  })

  it('says so when the season runs no game a league could rank', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: LMS_ID, gameKey: 'last_man_standing' })]),
    )

    renderRoute(
      <SeasonLeaguesRoute />,
      `${DASHBOARD}/leagues`,
      '/competitions/premier-league/2026-27/leagues',
    )

    await waitFor(() =>
      expect(screen.getByText('The Main Predictor is not part of this season')).toBeTruthy(),
    )
    expect(mocks.fetchMyGameLeagues).not.toHaveBeenCalled()
  })

  it('refuses league creation in words when the caller has not joined the Main Predictor', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({ gameKey: 'main_predictor' })]))

    renderRoute(
      <SeasonLeaguesRoute />,
      `${DASHBOARD}/leagues`,
      '/competitions/premier-league/2026-27/leagues',
    )

    expect(
      await screen.findByText(/Join the Main Predictor before creating a league/),
    ).toBeTruthy()
  })

  it('gives every season game page a way through to Leagues', async () => {
    // §7.3's fifth section now has a season implementation, so it stops being
    // an unavailable label and becomes a real destination in the sub-nav.
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/premier-league/2026-27/standings',
    )

    const leagues = await screen.findByRole('link', { name: 'Leagues' })
    expect(leagues.getAttribute('href')).toBe('/competitions/premier-league/2026-27/leagues')
  })

  it('shows a failed resolve as a failure, never as an empty page', async () => {
    mocks.fetchHubMembership.mockRejectedValue(new Error('offline'))

    renderRoute(
      <SeasonStandingsRoute />,
      `${DASHBOARD}/standings`,
      '/competitions/premier-league/2026-27/standings',
    )

    await waitFor(() =>
      expect(screen.getByText('This season could not be loaded right now.')).toBeTruthy(),
    )
  })
})
