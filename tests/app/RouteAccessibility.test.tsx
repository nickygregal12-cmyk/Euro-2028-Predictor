import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getRouteTitle, RouteAccessibility } from '../../src/app/RouteAccessibility'

function NavigationHarness() {
  const navigate = useNavigate()

  return (
    <>
      <RouteAccessibility />
      <button type="button" onClick={() => navigate('/predict/groups/d')}>
        Open group D
      </button>
      <main id="main-content" tabIndex={-1}>
        Route content
      </main>
    </>
  )
}

describe('RouteAccessibility', () => {
  it('derives stable titles for dynamic and unknown routes', () => {
    expect(getRouteTitle('/predict/groups/d')).toBe('Group D predictions')
    expect(getRouteTitle('/league/league-id')).toBe('League details')
    expect(getRouteTitle('/not-a-real-page')).toBe('Page not found')
  })

  it('sets the document title and exposes a polite route announcement', async () => {
    render(
      <MemoryRouter initialEntries={['/matches']}>
        <RouteAccessibility />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(document.title).toBe('Matches | Euro 2028 Predictor')
    })

    const announcement = screen.getByText('Matches page loaded')
    expect(announcement.getAttribute('aria-live')).toBe('polite')
    expect(announcement.getAttribute('aria-atomic')).toBe('true')
  })

  it('moves focus to main content after client-side navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/matches']}>
        <NavigationHarness />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(document.title).toBe('Matches | Euro 2028 Predictor')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open group D' }))

    await waitFor(() => {
      expect(document.title).toBe('Group D predictions | Euro 2028 Predictor')
      expect(document.activeElement).toBe(screen.getByRole('main'))
    })
  })
})
