import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

const mocks = vi.hoisted(() => ({
  fetchAdminAccessSnapshot: vi.fn(),
}))

vi.mock('../../src/services/supabase/adminAccess', () => ({
  fetchAdminAccessSnapshot: mocks.fetchAdminAccessSnapshot,
  snapshotHasAnyAdminAccess: (access: { isSuperAdmin: boolean; capabilities: readonly string[] }) =>
    access.isSuperAdmin || access.capabilities.length > 0,
}))

import { AdminUtilityEntry } from '../../src/app/vnext/AdminUtilityEntry'

afterEach(() => {
  cleanup()
  mocks.fetchAdminAccessSnapshot.mockReset()
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="path">{location.pathname}</output>
}

function renderEntry(path = '/account') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminUtilityEntry />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('vNext Control Room discovery', () => {
  it('renders absolutely nothing for an ordinary authenticated player', async () => {
    mocks.fetchAdminAccessSnapshot.mockResolvedValue({
      userId: 'player-1',
      email: 'player@example.test',
      isSuperAdmin: false,
      capabilities: [],
    })

    const { container } = renderEntry()
    await waitFor(() => expect(mocks.fetchAdminAccessSnapshot).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Control Room' })).toBeNull())
    expect(container.querySelector('[data-account-route]')).toBeNull()
  })

  it('stays absent when trusted metadata cannot be resolved', async () => {
    mocks.fetchAdminAccessSnapshot.mockRejectedValue(new Error('auth unavailable'))
    renderEntry()
    await waitFor(() => expect(mocks.fetchAdminAccessSnapshot).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Control Room' })).toBeNull())
  })

  it('shows one privileged utility for an allowed admin and navigates through the guarded route', async () => {
    mocks.fetchAdminAccessSnapshot.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.test',
      isSuperAdmin: false,
      capabilities: ['results'],
    })
    const user = userEvent.setup()
    renderEntry()

    const button = await screen.findByRole('button', { name: 'Control Room' })
    expect(button).toHaveAttribute('data-account-route', 'true')
    await user.click(button)
    expect(screen.getByTestId('path')).toHaveTextContent('/admin')
  })

  it('also recognises super-admin metadata without inventing a client capability', async () => {
    mocks.fetchAdminAccessSnapshot.mockResolvedValue({
      userId: 'owner-1',
      email: 'owner@example.test',
      isSuperAdmin: true,
      capabilities: [],
    })
    renderEntry('/competitions/premier-league/2026-27')

    const button = await screen.findByRole('button', { name: 'Control Room' })
    expect(button).toHaveAttribute('data-account-route', 'false')
  })
})
