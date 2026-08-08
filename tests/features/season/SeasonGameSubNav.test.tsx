import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SeasonGameSubNav } from '../../../src/features/season/SeasonGameSubNav'

const BASE = '/competitions/premier-league/2026-27'
const CUP_ID = '60000000-0000-0000-0000-000000000103'

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

  it('makes the Championship game root an instance chooser', () => {
    renderNav('championship', `${BASE}/games/championship`)

    expect(screen.getByText('Championships').getAttribute('aria-current')).toBe('page')
    expect(screen.queryByText('My Fixture')).toBeNull()
  })

  it('makes My Fixture, Table and Fixtures live inside a selected Championship', () => {
    const instance = `${BASE}/games/championship/${CUP_ID}`
    renderNav('championship', `${instance}/table`)

    expect(screen.getByText('Table').getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'My Fixture' }).getAttribute('href')).toBe(instance)
    expect(screen.getByRole('link', { name: 'Fixtures' }).getAttribute('href')).toBe(
      `${instance}/fixtures`,
    )
    expect(screen.getByText('History').getAttribute('aria-disabled')).toBe('true')
    expect(
      screen.getByRole('link', { name: 'Back to Championships' }).getAttribute('href'),
    ).toBe(`${BASE}/games/championship`)
  })
})
