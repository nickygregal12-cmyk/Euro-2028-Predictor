import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompetitionDashboardPage } from '../../../src/features/hub/CompetitionDashboardPage'
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

function renderDashboard() {
  render(
    <MemoryRouter initialEntries={['/competitions/premier-league/2026-27']}>
      <Routes>
        <Route
          path="/competitions/:competitionSlug/:seasonSlug"
          element={<CompetitionDashboardPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the competition dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.registerBonusCompetition.mockResolvedValue(undefined)
    mocks.withdrawBonusCompetition.mockResolvedValue(undefined)
  })

  it('joins the game the server named, addressing it by the id from the read', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderDashboard()

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
    renderDashboard()

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
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Joined')).toBeTruthy())
  })

  it('states a refusal as a sentence instead of rendering a dead button', async () => {
    // The whole defect this page had: a control that looked pressable and did
    // nothing. A refused action must not be a button at all.
    mocks.fetchHubMembership.mockResolvedValue(
      season([served({ registrationClosesAt: '2026-08-02T09:00:00Z' })]),
    )
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Entry has closed for this game.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Join game' })).toBeNull()
  })

  it('surfaces a write refusal without claiming which rule refused it', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    mocks.registerBonusCompetition.mockRejectedValueOnce(
      Object.assign(new Error('Registration has closed'), { code: '55000' }),
    )
    renderDashboard()

    const join = await screen.findByRole('button', { name: 'Join game' })
    join.click()

    await waitFor(() =>
      expect(screen.getByText('That change is not allowed right now.')).toBeTruthy(),
    )
  })

  it('claims no membership either way when the read fails', async () => {
    // The catalogue's own default says these games are not joined; a silent
    // fallback to it would assert a state the server never confirmed.
    mocks.fetchHubMembership.mockRejectedValue(new Error('offline'))
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Couldn’t check your entries')).toBeTruthy())
    expect(screen.queryByText('Joined')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Join game' })).toBeNull()
  })

  it('still offers the built game’s route alongside the entry control', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([served()]))
    renderDashboard()

    await waitFor(() => expect(screen.getAllByText('Build pending').length).toBeGreaterThan(0))
  })
})
