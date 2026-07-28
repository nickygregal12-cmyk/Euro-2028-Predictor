import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OtherPlayerProfilePage } from '../../../src/features/profile/OtherPlayerProfilePage'

const mocks = vi.hoisted(() => ({
  fetchPlayerProfile: vi.fn(),
}))

const context = vi.hoisted(() => ({
  tournamentData: {
    status: 'ready' as const,
    data: {
      tournament: {
        id: 'tournament-1',
        lockAt: '2028-06-09T19:00:00Z',
      },
      teams: [{ id: 'team-1', name: 'Scotland' }],
      groups: [],
      matches: [],
    },
  },
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1', displayName: 'Current Player' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => context.tournamentData,
}))

vi.mock('../../../src/services/supabase/playerProfile', () => ({
  fetchPlayerProfile: mocks.fetchPlayerProfile,
}))

function tree() {
  return (
    <MemoryRouter initialEntries={['/profile/rival-1']}>
      <Routes>
        <Route path="/profile/:playerId" element={<OtherPlayerProfilePage />} />
        <Route path="/h2h/:rivalId" element={<div>H2H route</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function hiddenProfile() {
  return {
    playerId: 'rival-1',
    displayName: 'Rival Player',
    leagueCount: 2,
    hasEntry: true,
    locked: false,
    lockAt: '2028-06-09T19:00:00Z',
    detail: null,
  }
}

function fullProfile() {
  return {
    ...hiddenProfile(),
    locked: true,
    detail: {
      totalPoints: 37,
      rank: 2,
      predictions: {
        groupMatches: [],
        progression: [{ teamId: 'team-1', stage: 'CHAMPION' as const }],
      },
      events: [
        {
          id: 'event-1',
          category: 'group_matches' as const,
          explanation: 'Scotland 2–1 England · exact score',
          points: 5,
        },
      ],
    },
  }
}

describe('OtherPlayerProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders only the safe hidden summary before lock', async () => {
    mocks.fetchPlayerProfile.mockResolvedValue(hiddenProfile())

    render(tree())

    expect(await screen.findByText('Rival Player')).toBeVisible()
    expect(screen.getByText(/2 leagues · Entry in/)).toBeVisible()
    expect(screen.getByText(/Predictions and stats are hidden/)).toBeVisible()
    expect(screen.queryByText('Points')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'H2H' })).not.toBeInTheDocument()
  })

  it('renders a distinct post-lock no-entry state', async () => {
    mocks.fetchPlayerProfile.mockResolvedValue({
      ...hiddenProfile(),
      hasEntry: false,
      locked: true,
    })

    render(tree())

    expect(await screen.findByText('No submitted entry')).toBeVisible()
    expect(screen.getByText('Rival Player')).toBeVisible()
    expect(screen.queryByText('Points')).not.toBeInTheDocument()
  })

  it('renders authoritative full detail and opens H2H', async () => {
    mocks.fetchPlayerProfile.mockResolvedValue(fullProfile())

    render(tree())

    expect(await screen.findByText('Rival Player')).toBeVisible()
    expect(screen.getByText('37')).toBeVisible()
    expect(screen.getByText('2nd')).toBeVisible()
    expect(screen.getByText('Scotland')).toBeVisible()
    expect(screen.getByText('Group matches')).toBeVisible()
    expect(screen.queryByRole('button', { name: /view full entry/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'H2H' }))
    expect(await screen.findByText('H2H route')).toBeVisible()
  })

  it('retries a transient profile read without reloading the route', async () => {
    mocks.fetchPlayerProfile
      .mockRejectedValueOnce(new Error('profile read offline'))
      .mockResolvedValueOnce(hiddenProfile())

    render(tree())

    expect(await screen.findByText("Couldn't load this profile")).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByText('Rival Player')).toBeVisible())
    expect(mocks.fetchPlayerProfile).toHaveBeenCalledTimes(2)
  })
})
