import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  onAuthChange: vi.fn(),
  serviceSignOut: vi.fn(),
  removeCurrentPushSubscription: vi.fn(),
  fetchMyProfile: vi.fn(),
  fetchWelcomedAt: vi.fn(),
  markWelcomedNow: vi.fn(),
}))

vi.mock('../../../src/services/supabase/auth', () => ({
  getCurrentSession: mocks.getCurrentSession,
  onAuthChange: mocks.onAuthChange,
  signOut: mocks.serviceSignOut,
}))
vi.mock('../../../src/services/pushNotifications', () => ({
  removeCurrentPushSubscription: mocks.removeCurrentPushSubscription,
}))
vi.mock('../../../src/services/supabase/profile', () => ({
  fetchMyProfile: mocks.fetchMyProfile,
  fetchWelcomedAt: mocks.fetchWelcomedAt,
  markWelcomedNow: mocks.markWelcomedNow,
}))

import { AuthProvider, useAuth } from '../../../src/features/auth/AuthProvider'

let signOut: (() => Promise<void>) | undefined

function Probe() {
  const auth = useAuth()
  signOut = auth.signOut
  return <span>{auth.userId ?? 'signed-out'}</span>
}

beforeEach(() => {
  vi.clearAllMocks()
  signOut = undefined
  mocks.getCurrentSession.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.onAuthChange.mockReturnValue(vi.fn())
  mocks.fetchMyProfile.mockResolvedValue({ displayName: 'Ada' })
  mocks.fetchWelcomedAt.mockResolvedValue({ welcomedAt: '2026-01-01T00:00:00Z' })
  mocks.removeCurrentPushSubscription.mockResolvedValue(undefined)
  mocks.serviceSignOut.mockResolvedValue(undefined)
})

async function renderAuthenticatedProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  await screen.findByText('user-1')
  await waitFor(() => expect(signOut).toBeTypeOf('function'))
}

describe('AuthProvider sign out', () => {
  it('removes this browser push endpoint before destroying the session', async () => {
    await renderAuthenticatedProvider()

    await act(async () => signOut?.())

    expect(mocks.removeCurrentPushSubscription).toHaveBeenCalledOnce()
    expect(mocks.serviceSignOut).toHaveBeenCalledOnce()
    expect(mocks.removeCurrentPushSubscription.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.serviceSignOut.mock.invocationCallOrder[0] as number,
    )
  })

  it('keeps the session available for retry when endpoint cleanup fails', async () => {
    mocks.removeCurrentPushSubscription.mockRejectedValue(new Error('delete failed'))
    await renderAuthenticatedProvider()

    await expect(signOut?.()).rejects.toThrow('delete failed')

    expect(mocks.serviceSignOut).not.toHaveBeenCalled()
    expect(screen.getByText('user-1')).toBeInTheDocument()
  })
})
