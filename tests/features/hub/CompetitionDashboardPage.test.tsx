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
  fetchSeasonLeaveEligibility: vi.fn<() => Promise<unknown>>(() => new Promise(() => {})),
  // Never resolves by default, so every assertion above holds while the week
  // is still being assembled. One test below gives it a real card.
  loadMatchweekCard: vi.fn<() => Promise<unknown>>(() => new Promise(() => {})),
  loadLmsRound: vi.fn<() => Promise<unknown>>(() => new Promise(() => {})),
  // The week loader asks the play context first and every game read hangs off
  // it, so a hanging context is how the other tests keep the week unassembled.
  loadPlayContext: vi.fn<() => Promise<unknown>>(() => new Promise(() => {})),
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
  createSeasonPlayContextGateway: () => ({ load: () => mocks.loadPlayContext() }),
}))

vi.mock('../../../src/services/supabase/seasonMatchPredictor', () => ({
  createSeasonMatchPredictorRpcGateway: () => ({ load: () => mocks.loadMatchweekCard() }),
}))

vi.mock('../../../src/services/supabase/seasonLms', () => ({
  createSeasonLmsRpcGateway: () => ({ load: () => mocks.loadLmsRound() }),
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

// Contract 140's leave eligibility. Left unresolved by default, which is the
// state the page must already be correct in: every assertion below about the
// Leave control holds while this read has not answered.
vi.mock('../../../src/services/supabase/gameLeaveEligibility', () => ({
  fetchSeasonLeaveEligibility: () => mocks.fetchSeasonLeaveEligibility(),
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

const LMS_ID = '60000000-0000-0000-0000-000000000202'

/** An active Last Man Standing entrant, whose route is not behind a flag. */
function lmsEntrant(): CompetitionGame {
  return served({
    id: LMS_ID,
    gameKey: 'last_man_standing',
    displayName: 'Last Man Standing',
    membership: {
      status: 'active',
      joinedAt: '2026-08-02T09:00:00Z',
      leftAt: null,
      disqualifiedAt: null,
    },
  })
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

  it('makes the primary control the action itself, not a destination', async () => {
    // `DFA-006`'s direct action. The card already printed "pick a club for
    // Round 3" and then offered "Open game", leaving the player to work out
    // that those were the same thing.
    //
    // Asserted on Last Man Standing rather than the Match Predictor because
    // the Match Predictor route is behind `VITE_UI_SEASON_MATCH_PREDICTOR`,
    // which is off here, so that card has no destination at all and correctly
    // says "Build pending". Same code path, no environment stubbing.
    mocks.fetchHubMembership.mockResolvedValue(season([lmsEntrant()]))
    mocks.loadPlayContext.mockResolvedValue({
      tournamentId: '60000000-0000-0000-0000-000000000001',
      competitionName: 'Premier League',
      seasonLabel: '2026/27',
      timeZone: 'Europe/London',
      matchweek: 3,
      matchweekCount: 38,
    })
    mocks.loadLmsRound.mockResolvedValue({
      available: true,
      entered: true,
      entryOutcome: 'active',
      round: {
        windowId: 'w3',
        sequence: 3,
        label: 'Round 3',
        opensAt: '2026-08-05T09:00:00Z',
        locksAt: '2026-08-08T13:30:00Z',
      },
      fixtures: [],
      pick: null,
      pickOutcome: null,
    })
    renderGames()

    expect(await screen.findByRole('button', { name: 'Pick your club' })).toBeTruthy()
  })

  it('keeps "Open game" where the game is asking for nothing', async () => {
    // A place to look rather than a thing to do. Dressing that as a task is how
    // a surface teaches a player to ignore its buttons.
    mocks.fetchHubMembership.mockResolvedValue(season([lmsEntrant()]))
    mocks.loadPlayContext.mockResolvedValue({
      tournamentId: '60000000-0000-0000-0000-000000000001',
      competitionName: 'Premier League',
      seasonLabel: '2026/27',
      timeZone: 'Europe/London',
      matchweek: 3,
      matchweekCount: 38,
    })
    mocks.loadLmsRound.mockResolvedValue({
      available: true,
      entered: true,
      entryOutcome: 'active',
      round: {
        windowId: 'w3',
        sequence: 3,
        label: 'Round 3',
        opensAt: '2026-08-05T09:00:00Z',
        locksAt: '2026-08-08T13:30:00Z',
      },
      fixtures: [],
      pick: { teamId: 't-1' },
      pickOutcome: null,
    })
    renderGames()

    await waitFor(() => expect(screen.getByText(/pick is in/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Pick your club' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Open game' }).length).toBeGreaterThan(0)
  })

  it('renders no button a player cannot press', async () => {
    // Reported as "there's still unclickable buttons". A season that serves no
    // games — measured, the current state of both league seasons — rendered
    // "Build pending", "Checking…" and "Entry unavailable" as disabled
    // controls. Each is a statement, so each is now a sentence, and every
    // button left on the card does something.
    mocks.fetchHubMembership.mockResolvedValue(season([]))
    renderGames()

    // All three cards carry it: the season serves none of its games.
    await waitFor(() => expect(screen.getAllByText(/has not opened/)).toHaveLength(3))

    for (const button of screen.queryAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled, `"${button.textContent}" is a control nobody can use`).toBe(
        false,
      )
    }
    expect(screen.queryByText('Entry unavailable')).toBeNull()
    expect(screen.queryByText('Build pending')).toBeNull()
  })

  it('says which game a competition has not opened, rather than refusing the player', async () => {
    // "Entry unavailable" reads as a refusal of the person. The competition
    // simply has not started the game yet, and the sentence says so by name.
    mocks.fetchHubMembership.mockResolvedValue(season([]))
    renderGames()

    await waitFor(() =>
      expect(screen.getByText(/has not opened\s*Match Predictor\s*yet/)).toBeTruthy(),
    )
  })

  it('withdraws Leave once the server says it would refuse it', async () => {
    // Contract 140. Before it, this page rendered "Leave game" for an entrant
    // whose scoring had started and let them press it, because the fact was
    // invisible until the write raised 55000.
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
    mocks.fetchSeasonLeaveEligibility.mockResolvedValue({
      serverNow: SERVER_NOW,
      games: [
        {
          id: MAIN_PREDICTOR_ID,
          gameKey: 'main_predictor',
          allowed: false,
          reason: 'scoring_started',
        },
      ],
    })
    renderGames()

    await waitFor(() => expect(screen.getByText(/already scored/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Leave game' })).toBeNull()
    expect(mocks.withdrawBonusCompetition).not.toHaveBeenCalled()
  })

  it('keeps the page and the Leave control when the eligibility read fails', async () => {
    // A dashboard that cannot show a player their games because it could not
    // check whether they may leave one is worse than the page that existed
    // before the read. The control goes back to being attempted.
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
    mocks.fetchSeasonLeaveEligibility.mockRejectedValue(new Error('offline'))
    renderGames()

    expect(await screen.findByRole('button', { name: 'Leave game' })).toBeTruthy()
    expect(screen.getByText('Joined')).toBeTruthy()
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

  it('adds no Back to Hub control, because the global Home tab is one', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderGames()

    await waitFor(() => expect(screen.getByText('Match Predictor')).toBeTruthy())
    expect(screen.queryByRole('link', { name: 'Back to Hub' })).toBeNull()
  })
})
