import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MorePage } from '../../../src/features/more/MorePage'

const { signOutMock, toggleThemeMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => undefined),
  toggleThemeMock: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    displayName: 'Test Player',
    signOut: signOutMock,
  }),
}))

vi.mock('../../../src/app/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggle: toggleThemeMock,
  }),
}))

describe('MorePage sign out', () => {
  beforeEach(() => {
    signOutMock.mockClear()
    toggleThemeMock.mockClear()
  })

  it('requires confirmation and keeps cancellation safe', async () => {
    render(
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    const firstDialog = screen.getByRole('dialog', { name: 'Sign out?' })
    expect(signOutMock).not.toHaveBeenCalled()

    fireEvent.click(within(firstDialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
    expect(signOutMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const confirmation = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull())
  })
})
