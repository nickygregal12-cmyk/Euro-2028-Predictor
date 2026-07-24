import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
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
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue(undefined)
  })

  it('does not sign out when confirmation is cancelled', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
  })

  it('signs out once only after explicit confirmation', async () => {
    let finishSignOut!: () => void
    mocks.signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSignOut = resolve
        }),
    )
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    const confirm = within(dialog).getByRole('button', { name: 'Sign out' })

    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: 'Sign out?' })).toBeTruthy()

    finishSignOut()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
    })
  })

  it('keeps the dialog open with a safe retry message after failure', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('internal provider detail'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    let dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    expect(
      await screen.findByRole('alert', {
        name: 'We couldn’t sign you out. Check your connection and try again.',
      }),
    ).toBeTruthy()
    expect(screen.queryByText('internal provider detail')).toBeNull()

    dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
    })
  })
})
