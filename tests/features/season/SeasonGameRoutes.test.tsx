import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  createSeasonCupDiscoveryRpcGateway: vi.fn(),
  createSeasonCupPlayerViewRpcGateway: vi.fn(),
  fetchMyGameLeagues: vi.fn(),
  createGameLeague: vi.fn(),
  joinLeague: vi.fn(),
  fetchSeasonLeagueStandingsPage: vi.fn(),
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
vi.mock('../../../src/services/supabase/seasonCupPlayer', () => ({
  createSeasonCupDiscoveryRpcGateway: mocks.createSeasonCupDiscoveryRpcGateway,
  createSeasonCupPlayerViewRpcGateway: mocks.createSeasonCupPlayerViewRpcGateway,
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
// The Leagues route resolves which matchweek a head-to-head compares through
// contract 121's play context, and reads the comparison itself through contract
// 129. Neither is exercised here — this suite is about route resolution — so
// both stand in, and the head-to-head's own behaviour is proven directly
// against its decoder and panel.
vi.mock('../../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({ load: () => new Promise(() => {}) }),
}))

vi.mock('../../../src/services/supabase/seasonHeadToHead', () => ({
  fetchSeasonHeadToHead: vi.fn(),
}))

vi.mock('../../../src/services/supabase/seasonLeagueStandings', () => ({
  fetchSeasonLeagueStandingsPage: mocks.fetchSeasonLeagueStandingsPage,
}))
vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}))

import {
  SeasonChampionshipFixtureRoute,
  SeasonChampionshipRoute,
  SeasonChampionshipTableRoute,
  SeasonLeaguesRoute,
  SeasonLmsRoute,
  SeasonPlayRoute,
  SeasonStandingsRoute,
} from '../../../src/features/season/SeasonGameRoutes'

const TOURNAMENT_ID = '60000000-0000-0000-0000-000000000001'
const LMS_ID = '60000000-0000-0000-0000-000000000102'
const CUP_ID = '60000000-0000-0000-0000-000000000103'
const PRIVATE_CUP_ID = 'd3fa0007-2026-4808-8000-000000000001'
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
const PREMIER = '/competitions/premier-league/2026-27'
const STANDINGS = `${DASHBOARD}/games/match-predictor/standings`
const LMS = `${DASHBOARD}/games/lms`
const CHAMPIONSHIP = `${DASHBOARD}/games/championship`
const CHAMPIONSHIP_INSTANCE = `${CHAMPIONSHIP}/:competitionId`
const CHAMPIONSHIP_TABLE = `${CHAMPIONSHIP_INSTANCE}/table`

describe('the season game routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSeasonLmsRpcGateway.mockReturnValue({ load: vi.fn(), pick: vi.fn() })
    mocks.createSeasonCupDiscoveryRpcGateway.mockReturnValue({
      load: vi.fn(() => new Promise(() => {})),
    })
    mocks.createSeasonCupPlayerViewRpcGateway.mockReturnValue({
      load: vi.fn(() => new Promise(() => {})),
    })
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

    renderRoute(<SeasonStandingsRoute />, STANDINGS, `${PREMIER}/games/match-predictor/standings`)

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

    renderRoute(<SeasonLmsRoute />, LMS, `${PREMIER}/games/lms`)

    await waitFor(() =>
      expect(mocks.createSeasonLmsRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
      }),
    )
    await waitFor(() =>
      expect(mocks.createSeasonLmsRegistrationRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
        competitionId: LMS_ID,
        userId: 'user-1',
      }),
    )
  })

  it('discovers Championship instances from the season instead of treating the public id as the game', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: CUP_ID, gameKey: 'predictor_cup' })]),
    )

    renderRoute(<SeasonChampionshipRoute />, CHAMPIONSHIP, `${PREMIER}/games/championship`)

    await waitFor(() =>
      expect(mocks.createSeasonCupDiscoveryRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
      }),
    )
    expect(mocks.createSeasonCupPlayerViewRpcGateway).not.toHaveBeenCalled()
  })

  it('opens a private Championship from the competition id in the URL', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: CUP_ID, gameKey: 'predictor_cup' })]),
    )

    renderRoute(
      <SeasonChampionshipFixtureRoute />,
      CHAMPIONSHIP_INSTANCE,
      `${PREMIER}/games/championship/${PRIVATE_CUP_ID}`,
    )

    await waitFor(() =>
      expect(mocks.createSeasonCupPlayerViewRpcGateway).toHaveBeenCalledWith({
        competitionId: PRIVATE_CUP_ID,
      }),
    )
    // A guessed private id must never acquire the public self-registration path.
    expect(mocks.createSeasonLmsRegistrationRpcGateway).not.toHaveBeenCalled()
  })

  it('keeps public Championship self-registration only on the known public instance', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: CUP_ID, gameKey: 'predictor_cup' })]),
    )

    renderRoute(
      <SeasonChampionshipTableRoute />,
      CHAMPIONSHIP_TABLE,
      `${PREMIER}/games/championship/${CUP_ID}/table`,
    )

    await waitFor(() =>
      expect(mocks.createSeasonCupPlayerViewRpcGateway).toHaveBeenCalledWith({
        competitionId: CUP_ID,
      }),
    )
    await waitFor(() =>
      expect(mocks.createSeasonLmsRegistrationRpcGateway).toHaveBeenCalledWith({
        tournamentId: TOURNAMENT_ID,
        competitionId: CUP_ID,
        userId: 'user-1',
      }),
    )
  })

  it('renders inside the competition shell, naming the competition', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(<SeasonStandingsRoute />, STANDINGS, `${PREMIER}/games/match-predictor/standings`)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Premier League' })).toBeTruthy())
    expect(screen.getByRole('navigation', { name: /sections/ })).toBeTruthy()
  })

  it('gives the scrollable sub-nav keyboard access and canonical section links', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(<SeasonStandingsRoute />, STANDINGS, `${PREMIER}/games/match-predictor/standings`)

    const nav = await screen.findByRole('navigation', { name: /sections/ })
    expect(nav.getAttribute('tabindex')).toBe('0')

    const overview = screen.getByRole('link', { name: 'Overview' })
    expect(overview.getAttribute('href')).toBe(PREMIER)
    expect(screen.getByRole('link', { name: 'Matches' }).getAttribute('href')).toBe(
      `${PREMIER}/matches`,
    )
    expect(screen.getByText('Games').getAttribute('aria-current')).toBe('page')
    expect(
      screen.getByRole('link', { name: 'Back to Match Predictor' }).getAttribute('href'),
    ).toBe(`${PREMIER}/games/match-predictor`)
  })

  it('does not dress the shell with a placeholder identity before the season resolves', async () => {
    mocks.fetchHubMembership.mockReturnValue(new Promise(() => {}))

    renderRoute(<SeasonStandingsRoute />, STANDINGS, `${PREMIER}/games/match-predictor/standings`)

    expect(screen.queryByRole('navigation', { name: /sections/ })).toBeNull()
  })

  it('lists only the joined games on Play, and links each to its canonical surface', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([
        game({ id: CUP_ID, gameKey: 'predictor_cup', membership: ACTIVE }),
        game({ id: LMS_ID, gameKey: 'last_man_standing' }),
      ]),
    )

    renderRoute(<SeasonPlayRoute />, `${DASHBOARD}/play`, `${PREMIER}/play`)

    const link = await screen.findByRole('link', { name: /Predictor Championship/ })
    expect(link.getAttribute('href')).toBe(`${PREMIER}/games/championship`)
    expect(screen.queryByText('Last Man Standing')).toBeNull()
  })

  it('points an empty Play at Overview rather than rendering a bare empty list', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(<SeasonPlayRoute />, `${DASHBOARD}/play`, `${PREMIER}/play`)

    await waitFor(() =>
      expect(screen.getByText('You have not joined a game here yet')).toBeTruthy(),
    )
    const overview = screen.getByRole('link', { name: /See the games/ })
    expect(overview.getAttribute('href')).toBe(PREMIER)
  })

  it('says so when the season does not list the game, rather than rendering blank', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(<SeasonChampionshipRoute />, CHAMPIONSHIP, `${PREMIER}/games/championship`)

    await waitFor(() =>
      expect(
        screen.getByText('The Predictor Championship is not part of this season'),
      ).toBeTruthy(),
    )
    expect(mocks.createSeasonCupDiscoveryRpcGateway).not.toHaveBeenCalled()
  })

  it('reports an unknown competition slug instead of resolving nothing', async () => {
    renderRoute(
      <SeasonStandingsRoute />,
      STANDINGS,
      '/competitions/not-a-league/1999-00/games/match-predictor/standings',
    )

    await waitFor(() =>
      expect(screen.getByText('This competition season could not be found.')).toBeTruthy(),
    )
    expect(mocks.fetchHubMembership).not.toHaveBeenCalled()
  })

  it('scopes the leagues surface to the season’s Match Predictor competition', async () => {
    const MAIN_ID = '60000000-0000-0000-0000-000000000101'
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: MAIN_ID, gameKey: 'main_predictor' })]),
    )

    renderRoute(<SeasonLeaguesRoute />, `${DASHBOARD}/leagues`, `${PREMIER}/leagues`)

    await waitFor(() => expect(mocks.fetchMyGameLeagues).toHaveBeenCalledWith(MAIN_ID))
  })

  it('reaches contract 128’s season league read from the browser at all', async () => {
    // The defect this closes is a server authority nobody could call — the
    // shape contracts 86, 98, 116, 118, 120 and 128 each had to fix. A league
    // table that no route wires up is indistinguishable from one that does not
    // exist, so the wiring is asserted here rather than assumed.
    const LEAGUE_ID = '60000000-0000-0000-0000-0000000009a1'
    mocks.fetchHubMembership.mockResolvedValue(season([game({ gameKey: 'main_predictor' })]))
    mocks.fetchMyGameLeagues.mockResolvedValue([
      {
        id: LEAGUE_ID,
        name: 'The Office',
        inviteCode: 'ABC123',
        memberCount: 4,
        isOwner: true,
        ownerName: 'Sam',
        lastActivityAt: null,
      },
    ])
    mocks.fetchSeasonLeagueStandingsPage.mockResolvedValue({
      rows: [],
      totalCount: 0,
      pageSize: 50,
      hasMore: false,
      nextCursor: null,
      you: null,
    })

    renderRoute(<SeasonLeaguesRoute />, `${DASHBOARD}/leagues`, `${PREMIER}/leagues`)

    fireEvent.click(await screen.findByRole('button', { name: 'View The Office table' }))

    await waitFor(() =>
      expect(mocks.fetchSeasonLeagueStandingsPage).toHaveBeenCalledWith(LEAGUE_ID, {
        after: null,
      }),
    )
  })

  it('says so when the season runs no game a league could rank', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ id: LMS_ID, gameKey: 'last_man_standing' })]),
    )

    renderRoute(<SeasonLeaguesRoute />, `${DASHBOARD}/leagues`, `${PREMIER}/leagues`)

    await waitFor(() =>
      expect(screen.getByText('The Match Predictor is not part of this season')).toBeTruthy(),
    )
    expect(mocks.fetchMyGameLeagues).not.toHaveBeenCalled()
  })

  it('refuses league creation in words when the caller has not joined Match Predictor', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({ gameKey: 'main_predictor' })]))

    renderRoute(<SeasonLeaguesRoute />, `${DASHBOARD}/leagues`, `${PREMIER}/leagues`)

    expect(
      await screen.findByText(/Join the Match Predictor before creating a league/),
    ).toBeTruthy()
  })

  it('gives every season game page a way through to Leagues', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game({})]))

    renderRoute(<SeasonStandingsRoute />, STANDINGS, `${PREMIER}/games/match-predictor/standings`)

    const leagues = await screen.findByRole('link', { name: 'Leagues' })
    expect(leagues.getAttribute('href')).toBe(`${PREMIER}/leagues`)
  })

  it('shows a failed resolve as a failure, never as an empty page', async () => {
    mocks.fetchHubMembership.mockRejectedValue(new Error('offline'))

    renderRoute(<SeasonStandingsRoute />, STANDINGS, `${PREMIER}/games/match-predictor/standings`)

    await waitFor(() =>
      expect(screen.getByText('This season could not be loaded right now.')).toBeTruthy(),
    )
  })
})
