import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LmsPage } from '../../../src/features/games/LmsPage'
import type { LmsRead, LmsWindowRead } from '../../../src/services/supabase/lmsModel'
import type { Team } from '../../../src/services/supabase/tournamentData'

const mocks = vi.hoisted(() => ({
  fetchMyLms: vi.fn<() => Promise<LmsRead>>(),
  saveLmsSelection: vi.fn<() => Promise<number>>(),
}))

vi.mock('../../../src/services/supabase/lms', () => ({
  fetchMyLms: mocks.fetchMyLms,
  saveLmsSelection: mocks.saveLmsSelection,
}))

const TEAMS: Team[] = [
  { id: 'team-sco', name: 'Scotland', groupId: 'group-a', slot: 1 },
  { id: 'team-ita', name: 'Italy', groupId: 'group-a', slot: 2 },
  { id: 'team-fra', name: 'France', groupId: 'group-a', slot: 3 },
  { id: 'team-ger', name: 'Germany', groupId: 'group-a', slot: 4 },
]

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: { tournament: { id: 'tournament-1' }, teams: TEAMS },
  }),
}))

const SERVER_NOW = '2028-06-09T12:00:00Z'

function window(overrides: Partial<LmsWindowRead> = {}): LmsWindowRead {
  return {
    id: 'win-md1',
    sequence: 1,
    label: 'Matchday 1',
    opensAt: '2028-06-07T12:00:00Z',
    locksAt: '2028-06-09T13:00:00Z',
    settlesAt: null,
    mySelection: null,
    fixtures: [
      {
        matchId: 'match-1',
        round: 'group',
        kickoffAt: '2028-06-09T14:00:00Z',
        homeTeamId: 'team-sco',
        awayTeamId: 'team-ita',
        resultState: 'scheduled',
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
      },
      {
        matchId: 'match-2',
        round: 'group',
        kickoffAt: '2028-06-09T17:00:00Z',
        homeTeamId: 'team-fra',
        awayTeamId: 'team-ger',
        resultState: 'scheduled',
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
      },
    ],
    ...overrides,
  }
}

function read(overrides: Partial<LmsRead> = {}): LmsRead {
  return {
    serverNow: SERVER_NOW,
    competitionId: 'comp-lms',
    entrant: { joinedAt: '2028-06-01T09:00:00Z', outcome: 'active' },
    entrantCount: 5,
    remainingCount: 5,
    usedTeamIds: [],
    windows: [window()],
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <LmsPage />
    </MemoryRouter>,
  )
}

describe('LmsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gates non-entrants towards the Games hub', async () => {
    mocks.fetchMyLms.mockResolvedValue(read({ entrant: null }))
    renderPage()

    expect(await screen.findByText('You haven’t entered Last Man Standing')).toBeTruthy()
    expect(screen.queryByText('Matchday 1')).toBeNull()
  })

  it('saves a pick from the open round with the stored version', async () => {
    mocks.fetchMyLms.mockResolvedValue(read())
    mocks.saveLmsSelection.mockResolvedValue(0)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Scotland' }))

    await waitFor(() => {
      expect(mocks.saveLmsSelection).toHaveBeenCalledWith('win-md1', 'team-sco', null)
    })
  })

  it('disables teams already used in earlier rounds', async () => {
    mocks.fetchMyLms.mockResolvedValue(read({ usedTeamIds: ['team-ita'] }))
    renderPage()

    expect(await screen.findByRole('button', { name: 'Italy' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Scotland' })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('shows a locked round with the pick outcome and no buttons', async () => {
    mocks.fetchMyLms.mockResolvedValue(
      read({
        entrant: { joinedAt: '2028-06-01T09:00:00Z', outcome: 'survived' },
        remainingCount: 2,
        usedTeamIds: ['team-sco'],
        windows: [
          window({
            locksAt: '2028-06-09T11:00:00Z',
            mySelection: { teamId: 'team-sco', version: 0 },
            fixtures: [
              {
                matchId: 'match-1',
                round: 'group',
                kickoffAt: '2028-06-09T14:00:00Z',
                homeTeamId: 'team-sco',
                awayTeamId: 'team-ita',
                resultState: 'confirmed',
                homeScore: 2,
                awayScore: 0,
                winnerTeamId: 'team-sco',
              },
            ],
          }),
        ],
      }),
    )
    renderPage()

    expect(await screen.findByText('Still standing — pick again next round.')).toBeTruthy()
    expect(screen.getByText('2 of 5 still standing')).toBeTruthy()
    expect(screen.getByText(/Survived/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Italy' })).toBeNull()
  })

  it('tells an eliminated player the truth and offers no picks', async () => {
    mocks.fetchMyLms.mockResolvedValue(
      read({
        entrant: { joinedAt: '2028-06-01T09:00:00Z', outcome: 'eliminated' },
        remainingCount: 1,
      }),
    )
    renderPage()

    expect(
      await screen.findByText('You’ve been eliminated. Thanks for playing!'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Scotland' })).toBeNull()
  })
})
