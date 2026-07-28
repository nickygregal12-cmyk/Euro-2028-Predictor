import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KnockoutPredictionsPage } from '../../../src/features/games/KnockoutPredictionsPage'
import type { KnockoutStoreRead } from '../../../src/services/supabase/knockoutPredictionsModel'
import type { Match, Team } from '../../../src/services/supabase/tournamentData'

const mocks = vi.hoisted(() => ({
  fetchMyKnockoutPredictions: vi.fn<() => Promise<KnockoutStoreRead>>(),
  saveKnockoutPrediction: vi.fn<() => Promise<number>>(),
  deleteKnockoutPrediction: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../../src/services/supabase/knockoutPredictions', () => ({
  fetchMyKnockoutPredictions: mocks.fetchMyKnockoutPredictions,
  saveKnockoutPrediction: mocks.saveKnockoutPrediction,
  deleteKnockoutPrediction: mocks.deleteKnockoutPrediction,
}))

const TEAMS: Team[] = [
  { id: 'team-sco', name: 'Scotland', groupId: 'group-a', slot: 1 },
  { id: 'team-ita', name: 'Italy', groupId: 'group-b', slot: 1 },
]

function knockoutMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-r16-1',
    matchRef: 'R16-1',
    round: 'r16',
    groupId: null,
    matchday: null,
    homeSource: 'W1A',
    awaySource: 'R2B',
    homeTeamId: 'team-sco',
    awayTeamId: 'team-ita',
    matchDate: '2028-06-29',
    kickoffAt: '2028-06-29T19:00:00Z',
    venue: 'Hampden Park',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

const providerState = vi.hoisted(() => ({
  matches: [] as Match[],
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: { id: 'tournament-1' },
      teams: TEAMS,
      matches: providerState.matches,
    },
  }),
}))

const SERVER_NOW = '2028-06-27T12:00:00Z'

function store(overrides: Partial<KnockoutStoreRead> = {}): KnockoutStoreRead {
  return { serverNow: SERVER_NOW, storeEntrant: true, predictions: [], ...overrides }
}

function renderPage() {
  render(
    <MemoryRouter>
      <KnockoutPredictionsPage />
    </MemoryRouter>,
  )
}

describe('KnockoutPredictionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    providerState.matches = [knockoutMatch()]
  })

  it('gates non-entrants towards the Games hub', async () => {
    mocks.fetchMyKnockoutPredictions.mockResolvedValue(store({ storeEntrant: false }))
    renderPage()

    expect(await screen.findByText('Enter a knockout game first')).toBeTruthy()
    expect(screen.queryByText('R16-1', { exact: false })).toBeNull()
  })

  it('saves a decisive scoreline without an advancing pick', async () => {
    mocks.fetchMyKnockoutPredictions.mockResolvedValue(store())
    mocks.saveKnockoutPrediction.mockResolvedValue(0)
    renderPage()

    fireEvent.change(await screen.findByLabelText('Scotland score'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Italy score'), { target: { value: '1' } })
    expect(screen.queryByRole('group', { name: 'Who goes through?' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mocks.saveKnockoutPrediction).toHaveBeenCalledWith({
        matchId: 'match-r16-1',
        homeScore: 2,
        awayScore: 1,
        advancingTeamId: null,
        expectedVersion: null,
      })
    })
  })

  it('requires a who-goes-through pick before saving a draw', async () => {
    mocks.fetchMyKnockoutPredictions.mockResolvedValue(store())
    mocks.saveKnockoutPrediction.mockResolvedValue(0)
    renderPage()

    fireEvent.change(await screen.findByLabelText('Scotland score'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Italy score'), { target: { value: '1' } })

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Scotland through' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mocks.saveKnockoutPrediction).toHaveBeenCalledWith({
        matchId: 'match-r16-1',
        homeScore: 1,
        awayScore: 1,
        advancingTeamId: 'team-sco',
        expectedVersion: null,
      })
    })
  })

  it('echoes the saved version when updating and clears with it', async () => {
    mocks.fetchMyKnockoutPredictions.mockResolvedValue(
      store({
        predictions: [
          {
            matchId: 'match-r16-1',
            homeScore: 2,
            awayScore: 0,
            advancingTeamId: null,
            version: 4,
          },
        ],
      }),
    )
    mocks.deleteKnockoutPrediction.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(mocks.deleteKnockoutPrediction).toHaveBeenCalledWith('match-r16-1', 4)
    })
  })

  it('renders a kicked-off match locked with no save action', async () => {
    providerState.matches = [knockoutMatch({ kickoffAt: '2028-06-26T19:00:00Z' })]
    mocks.fetchMyKnockoutPredictions.mockResolvedValue(store())
    renderPage()

    expect(await screen.findByText('Locked')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('treats an unscheduled kickoff as not yet editable', async () => {
    providerState.matches = [knockoutMatch({ kickoffAt: null })]
    mocks.fetchMyKnockoutPredictions.mockResolvedValue(store())
    renderPage()

    expect(await screen.findByText('Kickoff to be confirmed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
})
