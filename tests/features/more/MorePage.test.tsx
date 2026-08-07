import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { MorePage } from '../../../src/features/more/MorePage'

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/more']}>
      <Routes>
        <Route path="/more" element={<MorePage />} />
        <Route path="/account" element={<p>account page</p>} />
        <Route path="/profile" element={<p>profile page</p>} />
        <Route path="/more/scoring" element={<p>games help page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MorePage', () => {
  it('shows only canonical weekly destinations', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.queryByText('Display name')).toBeNull()

    for (const label of ['Account', 'Profile', 'How the games work']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: 'Prediction trends' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bonus Games' })).toBeNull()
  })

  it('routes the Account row to /account', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText('account page')).toBeTruthy()
  })

  it('routes Profile and game help to their canonical weekly routes', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    expect(screen.getByText('profile page')).toBeTruthy()

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'How the games work' }))
    expect(screen.getByText('games help page')).toBeTruthy()
  })
})
