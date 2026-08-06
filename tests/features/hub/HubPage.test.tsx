import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HubPage } from '../../../src/features/hub/HubPage'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))

function joinedPremierLeague(): HubSeasonMembership {
  return {
    seasonName: 'Premier League 2026/27',
    tournamentId: '60000000-0000-0000-0000-000000000001',
    seasonStatus: 'active',
    seasonGames: {
      competitionMember: true,
      serverNow: '2026-08-06T12:00:00Z',
      games: [
        {
          id: '60000000-0000-0000-0000-000000000101',
          gameKey: 'main_predictor',
          active: true,
          displayName: 'Main Predictor',
          registrationOpensAt: null,
          registrationClosesAt: null,
          completedAt: null,
          allowRejoin: false,
          membership: {
            status: 'active',
            joinedAt: '2026-08-01T10:00:00Z',
            leftAt: null,
            disqualifiedAt: null,
          },
        },
      ],
    },
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <HubPage />
    </MemoryRouter>,
  )
}

describe('HubPage membership states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claims no membership while the read is loading', () => {
    mocks.fetchHubMembership.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.queryByText('Joined')).toBeNull()
    expect(screen.queryByText(/You have not joined a competition yet/)).toBeNull()
  })

  it('shows real membership once the read lands', async () => {
    mocks.fetchHubMembership.mockResolvedValue([joinedPremierLeague()])
    renderPage()

    expect(await screen.findByText('Joined')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Premier League' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'View Premier League' })).toBeNull()
  })

  it('keeps a competition with no active membership in Discover', async () => {
    mocks.fetchHubMembership.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/You have not joined a competition yet/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View Premier League' })).toBeTruthy()
    expect(screen.queryByText('Joined')).toBeNull()
  })

  it('reports a failed read instead of claiming nothing is joined', async () => {
    mocks.fetchHubMembership.mockRejectedValue(new Error('membership backend down'))
    renderPage()

    expect(await screen.findByText('Couldn’t check your competitions')).toBeTruthy()
    expect(screen.queryByText(/You have not joined a competition yet/)).toBeNull()
    expect(screen.queryByText('Joined')).toBeNull()
    expect(screen.queryByText('membership backend down')).toBeNull()
  })

  it('retries the read from the failure alert', async () => {
    mocks.fetchHubMembership
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([joinedPremierLeague()])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.queryByText('Couldn’t check your competitions')).toBeNull()
    })
    expect(await screen.findByText('Joined')).toBeTruthy()
    expect(mocks.fetchHubMembership).toHaveBeenCalledTimes(2)
  })
})
