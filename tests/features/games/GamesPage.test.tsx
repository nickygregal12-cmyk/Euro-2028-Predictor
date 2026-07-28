import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GamesPage } from '../../../src/features/games/GamesPage'
import type { BonusGamesRead } from '../../../src/services/supabase/bonusGamesModel'

const mocks = vi.hoisted(() => ({
  fetchBonusGames: vi.fn<() => Promise<BonusGamesRead>>(),
  registerBonusCompetition: vi.fn<() => Promise<void>>(),
  withdrawBonusCompetition: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../../src/services/supabase/bonusGames', () => ({
  fetchBonusGames: mocks.fetchBonusGames,
  registerBonusCompetition: mocks.registerBonusCompetition,
  withdrawBonusCompetition: mocks.withdrawBonusCompetition,
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: { tournament: { id: 'tournament-1' } },
  }),
}))

const SERVER_NOW = '2028-06-27T12:00:00Z'

function koGame(entered: boolean): BonusGamesRead['games'][number] {
  return {
    competition: {
      id: 'comp-ko',
      gameKey: 'ko_predictor',
      tournamentId: 'tournament-1',
      published: true,
      registrationOpensAt: '2028-06-26T00:00:00Z',
      registrationClosesAt: null,
      drawRequired: false,
      drawCompletedAt: null,
      completedAt: null,
    },
    windows: [],
    entrant: entered
      ? {
          competitionId: 'comp-ko',
          userId: 'user-1',
          joinedAt: '2028-06-26T09:00:00Z',
          outcome: 'active',
          pendingInputs: 0,
        }
      : null,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <GamesPage />
    </MemoryRouter>,
  )
}

describe('GamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state when nothing is published', async () => {
    mocks.fetchBonusGames.mockResolvedValue({ serverNow: SERVER_NOW, games: [] })
    renderPage()

    expect(await screen.findByText('No bonus games yet')).toBeTruthy()
  })

  it('offers entry for an open competition and refreshes after registering', async () => {
    mocks.fetchBonusGames.mockResolvedValue({ serverNow: SERVER_NOW, games: [koGame(false)] })
    mocks.registerBonusCompetition.mockResolvedValue(undefined)
    renderPage()

    expect(await screen.findByText('KO Predictor')).toBeTruthy()
    expect(screen.getByText('Registration open — join now')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))

    await waitFor(() => {
      expect(mocks.registerBonusCompetition).toHaveBeenCalledWith('comp-ko')
    })
    await waitFor(() => {
      expect(mocks.fetchBonusGames).toHaveBeenCalledTimes(2)
    })
  })

  it('withdraws only after explicit confirmation', async () => {
    mocks.fetchBonusGames.mockResolvedValue({ serverNow: SERVER_NOW, games: [koGame(true)] })
    mocks.withdrawBonusCompetition.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }))
    const dialog = screen.getByRole('dialog', { name: 'Withdraw from this game?' })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mocks.withdrawBonusCompetition).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Withdraw from this game?' })).getByRole(
        'button',
        { name: 'Withdraw' },
      ),
    )

    await waitFor(() => {
      expect(mocks.withdrawBonusCompetition).toHaveBeenCalledWith('comp-ko')
    })
  })

  it('surfaces a registration failure without losing the hub', async () => {
    mocks.fetchBonusGames.mockResolvedValue({ serverNow: SERVER_NOW, games: [koGame(false)] })
    mocks.registerBonusCompetition.mockRejectedValue(new Error('nope'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Enter' }))

    expect(await screen.findByText('That didn’t work')).toBeTruthy()
    expect(screen.getByText('KO Predictor')).toBeTruthy()
    expect(mocks.fetchBonusGames).toHaveBeenCalledTimes(1)
  })

  it('recovers from a load failure through retry', async () => {
    mocks.fetchBonusGames
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ serverNow: SERVER_NOW, games: [] })
    renderPage()

    expect(await screen.findByText('Couldn’t load the bonus games')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('No bonus games yet')).toBeTruthy()
    expect(mocks.fetchBonusGames).toHaveBeenCalledTimes(2)
  })
})
