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
      </Routes>
    </MemoryRouter>,
  )
}

describe('MorePage', () => {
  it('keeps only link rows — sign-out and profile details live on Account', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.queryByText('Display name')).toBeNull()
    for (const label of ['Account', 'Profile', 'Games', 'How scoring works']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('routes the Account row to /account', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText('account page')).toBeTruthy()
  })
})
