import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WelcomePage } from '../../../src/features/welcome/WelcomePage'
import {
  clearPendingJoin,
  setPendingJoin,
} from '../../../src/features/leagues/pendingJoin'

const mocks = vi.hoisted(() => ({
  markWelcomed: vi.fn(),
  auth: {
    displayName: 'Welcome Tester',
    welcomeStatus: 'needed' as 'loading' | 'needed' | 'seen',
  },
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    ...mocks.auth,
    markWelcomed: mocks.markWelcomed,
  }),
}))

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/join/:code" element={<p>Invite destination</p>} />
        <Route path="/predict/groups/A" element={<p>Group A destination</p>} />
        <Route path="/" element={<p>Home destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WelcomePage pending invite continuation', () => {
  beforeEach(() => {
    clearPendingJoin()
    mocks.markWelcomed.mockReset()
    mocks.auth.displayName = 'Welcome Tester'
    mocks.auth.welcomeStatus = 'needed'
  })

  it('resumes the pending invite after showing first-use orientation', () => {
    setPendingJoin('AUTH28')
    renderWelcome()

    expect(screen.getByRole('heading', { name: 'Welcome, Welcome Tester' })).toBeVisible()
    expect(mocks.markWelcomed).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Continue to league invite →' }))
    expect(screen.getByText('Invite destination')).toBeVisible()
  })

  it('keeps Group A as the default first-use destination', () => {
    renderWelcome()

    fireEvent.click(screen.getByRole('button', { name: 'Start with Group A →' }))
    expect(screen.getByText('Group A destination')).toBeVisible()
  })

  it('does not replay an invite when the welcome screen was already seen', () => {
    setPendingJoin('AUTH28')
    mocks.auth.welcomeStatus = 'seen'
    renderWelcome()

    expect(screen.getByText('Home destination')).toBeVisible()
    expect(mocks.markWelcomed).not.toHaveBeenCalled()
  })
})
