import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MorePage } from '../../../src/features/more/MorePage'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
  toggleTheme: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ displayName: 'Nicky', signOut: mocks.signOut }),
}))

vi.mock('../../../src/app/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'dark', toggle: mocks.toggleTheme }),
}))

function renderPage() {
  render(
    <MemoryRouter>
      <MorePage />
    </MemoryRouter>,
  )
}

describe('MorePage sign out', () => {
  beforeEach(() => {
    mocks.signOut.mockReset()
    mocks.signOut.mockResolvedValue(undefined)
    mocks.toggleTheme.mockReset()
  })

  it('does not sign out when the confirmation is cancelled', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
  })

  it('signs out once after explicit confirmation', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledOnce()
      expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
    })
  })
})
