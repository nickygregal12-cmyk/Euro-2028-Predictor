import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SeasonGameSubNav } from '../../../src/features/season/SeasonGameSubNav'

const BASE = '/competitions/premier-league/2026-27'

function renderNav(game: 'match-predictor' | 'lms' | 'championship', path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SeasonGameSubNav game={game} />
    </MemoryRouter>,
  )
}

describe('SeasonGameSubNav', () => {
  it('gives Match Predictor live Play and Standings destinations', () => {
    renderNav('match-predictor', `${BASE}/games/match-predictor`)

    expect(screen.getByText('Play').getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Standings' }).getAttribute('href')).toBe(
      `${BASE}/games/match-predictor/standings`,
    )
    expect(screen.getByText('Trends').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('History').getAttribute('aria-disabled')).toBe('true')
  })

  it('keeps Match Predictor standings connected to Competition Games', () => {
    renderNav('match-predictor', `${BASE}/games/match-predictor/standings`)

    expect(screen.getByText('Standings').getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Play' }).getAttribute('href')).toBe(
      `${BASE}/games/match-predictor`,
    )
    expect(screen.getByRole('link', { name: 'Back to Games' }).getAttribute('href')).toBe(
      `${BASE}/games`,
    )
  })

  it('shows the accepted LMS navigation without inventing unbuilt routes', () => {
    renderNav('lms', `${BASE}/games/lms`)

    expect(screen.getByText('Pick').getAttribute('aria-current')).toBe('page')
    for (const label of ['Standings', 'History', 'Rules']) {
      expect(screen.getByText(label).getAttribute('aria-disabled')).toBe('true')
    }
  })

  it('names the delivered Championship surface Table and keeps future views disabled', () => {
    renderNav('championship', `${BASE}/games/championship`)

    expect(screen.getByText('Table').getAttribute('aria-current')).toBe('page')
    for (const label of ['My Fixture', 'Fixtures', 'History']) {
      expect(screen.getByText(label).getAttribute('aria-disabled')).toBe('true')
    }
  })
})
