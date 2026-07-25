import { render, screen, waitFor } from '@testing-library/react'
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
  joinLeague: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  fetchLeaguePreview: mocks.fetchLeaguePreview,
  joinLeague: mocks.joinLeague,
}))

function renderInvite(code = 'ABC234') {
  return render(
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<JoinLandingPage />} />
        <Route path="/auth/signup" element={<p>Signup destination</p>} />
        <Route path="/league" element={<p>League destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinLandingPage pending invite boundary', () => {
  beforeEach(() => {
    clearPendingJoin()
    mocks.auth.userId = null
    mocks.auth.loading = false
    mocks.fetchLeaguePreview.mockReset()
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
    mocks.fetchLeaguePreview.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000456',
      name: 'Office League',
      memberCount: 1,
      ownerName: 'League Owner',
      isMember: false,
    })

    renderInvite('ABC234')

    await screen.findByRole('heading', { name: 'Office League' })
    await waitFor(() => expect(getPendingJoin()).toBeNull())
    expect(mocks.fetchLeaguePreview).toHaveBeenCalledWith('ABC234')
  })
})
