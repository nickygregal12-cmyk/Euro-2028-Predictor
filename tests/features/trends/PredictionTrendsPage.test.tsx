import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PredictionTrendsPage } from '../../../src/features/trends/PredictionTrendsPage'
import type { AvailablePredictionConsensus } from '../../../src/services/supabase/predictionConsensusResponse'

const mocks = vi.hoisted(() => ({
  fetchPredictionConsensus: vi.fn(),
  fetchConsensusPlayers: vi.fn(),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: { id: 'tournament-1' },
      teams: [{ id: 'team-scotland', name: 'Scotland' }],
      matches: [],
    },
  }),
}))

vi.mock('../../../src/features/shared/useTournamentEntryLocked', () => ({
  useTournamentEntryLocked: () => true,
}))

vi.mock('../../../src/services/supabase/predictionConsensus', () => ({
  fetchPredictionConsensus: mocks.fetchPredictionConsensus,
  fetchConsensusPlayers: mocks.fetchConsensusPlayers,
}))

function consensus(overrides: Partial<AvailablePredictionConsensus> = {}): AvailablePredictionConsensus {
  return {
    suppressed: false,
    minimumEntries: 10,
    serverNow: '2028-06-14T12:00:00Z',
    lockedAt: '2028-06-14T12:00:00Z',
    submittedEntries: 12,
    championRace: [{ teamId: 'team-scotland', picks: 5 }],
    peoplesFinal: [],
    goldenBoot: [{ playerId: 'player-1', teamId: 'team-scotland', picks: 4 }],
    mostAgreedMatch: null,
    mostDividedMatch: null,
    mostTrustedTeam: null,
    goalsSpread: { minimum: 1, median: 2, maximum: 5, average: 2.5, distinctTotals: 3, distribution: [] },
    onlyYou: [],
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <PredictionTrendsPage />
    </MemoryRouter>,
  )
}

describe('PredictionTrendsPage player-name availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps a failed player-name read distinct from picks genuinely referencing no players', async () => {
    mocks.fetchPredictionConsensus.mockResolvedValue(consensus())
    mocks.fetchConsensusPlayers.mockRejectedValue(new Error('players offline'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Player names are temporarily unavailable',
    )
    expect(screen.getByText('Official squad player')).toBeVisible()
  })

  it('does not warn when player names load successfully', async () => {
    mocks.fetchPredictionConsensus.mockResolvedValue(consensus())
    mocks.fetchConsensusPlayers.mockResolvedValue([
      { id: 'player-1', name: 'Erling Haaland', teamId: 'team-scotland' },
    ])

    renderPage()

    expect(await screen.findByText('Erling Haaland')).toBeVisible()
    expect(screen.queryByText('Player names are temporarily unavailable')).not.toBeInTheDocument()
  })

  it('does not warn when there are no Golden Boot picks to name', async () => {
    mocks.fetchPredictionConsensus.mockResolvedValue(consensus({ goldenBoot: [] }))
    mocks.fetchConsensusPlayers.mockResolvedValue([])

    renderPage()

    const goldenBootSection = await screen.findByRole('heading', { name: 'Golden Boot picks' })
    expect(goldenBootSection.closest('section')).toHaveTextContent(
      'No submitted selections are available.',
    )
    expect(screen.queryByText('Player names are temporarily unavailable')).not.toBeInTheDocument()
    expect(mocks.fetchConsensusPlayers).toHaveBeenCalledWith([])
  })

  it('does not fetch player names when the consensus is suppressed', async () => {
    mocks.fetchPredictionConsensus.mockResolvedValue({
      suppressed: true,
      reason: 'not_enough_entries',
      minimumEntries: 10,
      submittedEntries: 3,
      serverNow: '2028-06-14T12:00:00Z',
      lockedAt: '2028-06-14T12:00:00Z',
    })

    renderPage()

    expect(await screen.findByText('Not enough entries yet')).toBeVisible()
    expect(mocks.fetchConsensusPlayers).not.toHaveBeenCalled()
  })
})
