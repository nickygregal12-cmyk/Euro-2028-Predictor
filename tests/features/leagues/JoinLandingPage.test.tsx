import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinLandingPage } from '../../../src/features/leagues/JoinLandingPage'
import {
  clearPendingJoin,
  getPendingJoin,
  setPendingJoin,
} from '../../../src/features/leagues/pendingJoin'

const mocks = vi.hoisted(() => ({
  auth: {
    userId: null as string | null,
    loading: false,
  },
  fetchLeaguePreview: vi.fn(),
  fetchTournamentData: vi.fn(),
  getOrCreateEntry: vi.fn(),
  joinLeague: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  fetchLeaguePreview: mocks.fetchLeaguePreview,
  joinLeague: mocks.joinLeague,
}))

vi.mock('../../../src/services/supabase/predictions', () => ({
  getOrCreateEntry: mocks.getOrCreateEntry,
}))

vi.mock('../../../src/services/supabase/tournamentData', () => ({
  fetchTournamentData: mocks.fetchTournamentData,
}))

function renderInvite(code = 'ABC234') {
  return render(
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<JoinLandingPage />} />
        <Route path="/auth/signup" element={<p>Signup destination</p>} />
        <Route path="/league" element={<p>League destination</p>} />
        <Route path="/league/:leagueId" element={<p>Joined league destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const preview = {
  id: '00000000-0000-0000-0000-000000000456',
  name: 'Office League',
  memberCount: 1,
  ownerName: 'League Owner',
  isMember: false,
}

describe('JoinLandingPage pending invite boundary', () => {
  beforeEach(() => {
    clearPendingJoin()
    mocks.auth.userId = null
    mocks.auth.loading = false
    mocks.fetchLeaguePreview.mockReset()
    mocks.fetchTournamentData.mockReset()
    mocks.getOrCreateEntry.mockReset()
    mocks.joinLeague.mockReset()
  })

  it('stores the exact invite after commit before redirecting a signed-out visitor', async () => {
    renderInvite('ABC234')

    await screen.findByText('Signup destination')
    expect(getPendingJoin()).toBe('ABC234')
    expect(mocks.fetchLeaguePreview).not.toHaveBeenCalled()
  })

  it('consumes the pending invite and loads its preview once authenticated', async () => {
    setPendingJoin('ABC234')
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.fetchLeaguePreview.mockResolvedValue(preview)

    renderInvite('ABC234')

    await screen.findByRole('heading', { name: 'Office League' })
    await waitFor(() => expect(getPendingJoin()).toBeNull())
    expect(mocks.fetchLeaguePreview).toHaveBeenCalledWith('ABC234')
  })

  it('establishes the preserved Original Predictor membership before joining the league', async () => {
    const userId = '00000000-0000-0000-0000-000000000123'
    const tournamentId = '00000000-0000-0000-0000-000000000789'
    mocks.auth.userId = userId
    mocks.fetchLeaguePreview.mockResolvedValue(preview)
    mocks.fetchTournamentData.mockResolvedValue({ tournament: { id: tournamentId } })
    mocks.getOrCreateEntry.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000321',
      submittedAt: null,
    })
    mocks.joinLeague.mockResolvedValue({ id: preview.id, name: preview.name })

    renderInvite('ABC234')
    fireEvent.click(await screen.findByRole('button', { name: 'Join league' }))

    await screen.findByText('Joined league destination')
    expect(mocks.fetchTournamentData).toHaveBeenCalledOnce()
    expect(mocks.getOrCreateEntry).toHaveBeenCalledWith(userId, tournamentId)
    expect(mocks.joinLeague).toHaveBeenCalledWith('ABC234')
    expect(mocks.getOrCreateEntry.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.joinLeague.mock.invocationCallOrder[0],
    )
  })
})
