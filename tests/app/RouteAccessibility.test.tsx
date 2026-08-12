import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { getRouteTitle, RouteAccessibility } from '../../src/app/RouteAccessibility'

const LMS_PATH = '/competitions/premier-league/2026-27/games/lms'

function NavigationHarness() {
  const navigate = useNavigate()

  return (
    <>
      <RouteAccessibility />
      <button type="button" onClick={() => navigate(LMS_PATH)}>
        Open Premier League LMS
      </button>
      <main id="main-content" tabIndex={-1}>
        Route content
      </main>
    </>
  )
}

describe('RouteAccessibility', () => {
  it('derives stable titles for canonical dynamic and unknown routes', () => {
    expect(getRouteTitle(LMS_PATH)).toBe('Premier League 2026/27 Last Man Standing')
    // Titled now, not 404: the tournament's journeys are registered as of
    // 11 August 2026 and refused on the Hub by the deployment gate rather than
    // by being absent. See `routeTitleCoverage.test.ts` for the same inversion.
    expect(getRouteTitle('/predict/groups/d')).toBe('Group predictions')
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
      expect(document.title).toBe('Matches | Football Prediction Hub')
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
      expect(document.title).toBe('Matches | Football Prediction Hub')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open Premier League LMS' }))

    await waitFor(() => {
      expect(document.title).toBe(
        'Premier League 2026/27 Last Man Standing | Football Prediction Hub',
      )
      expect(document.activeElement).toBe(screen.getByRole('main'))
    })
  })
})
