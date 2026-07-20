import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { NotFoundPage } from '../../../src/features/notfound/NotFoundPage'

// The catch-all route now shows a real recovery view instead of silently
// redirecting to Home (hygiene batch item 5).

describe('NotFoundPage / catch-all route', () => {
  it('renders a 404 recovery view with a clear way back', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /gone walkabout/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument()
  })

  it('an unknown path resolves to the 404 view (not the home route)', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <Routes>
          <Route path="/" element={<div>home content</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.queryByText('home content')).not.toBeInTheDocument()
  })

  it('back-to-home navigates to /', async () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <Routes>
          <Route path="/" element={<div>home content</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /back to home/i }))
    expect(await screen.findByText('home content')).toBeInTheDocument()
  })
})
