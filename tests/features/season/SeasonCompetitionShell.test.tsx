import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SeasonCompetitionShell } from '../../../src/features/season/SeasonCompetitionShell'
import { seasonShellDestinations } from '../../../src/features/season/seasonDestinations'

const BASE = '/competitions/premier-league/2026-27'
const SCOTTISH = '/competitions/scottish-premiership/2026-27'

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Current route">{`${location.pathname}${location.search}${location.hash}`}</output>
}

function renderShell(path: string, active: 'overview' | 'play' | 'matches' | 'games' | 'leagues') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SeasonCompetitionShell
        competitionName="Premier League"
        seasonLabel="2026/27"
        statusStrip={[]}
        active={active}
        destinations={seasonShellDestinations(BASE)}
      >
        <p>Route content</p>
      </SeasonCompetitionShell>
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('SeasonCompetitionShell', () => {
  it('gives a directly loaded competition page a deterministic Hub exit', () => {
    renderShell(BASE, 'overview')

    expect(screen.getByRole('link', { name: 'Back to Hub' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('link', { name: 'Back to Games' })).toBeNull()
  })

  it('gives a directly loaded game child Back to Games and Back to Hub', () => {
    renderShell(`${BASE}/games/lms`, 'games')

    expect(screen.getByRole('link', { name: 'Back to Games' }).getAttribute('href')).toBe(
      `${BASE}/games`,
    )
    expect(screen.getByRole('link', { name: 'Back to Hub' }).getAttribute('href')).toBe('/')
    expect(screen.getByText('Games').getAttribute('aria-current')).toBe('page')
  })

  it('uses one canonical competition navigation map', () => {
    renderShell(`${BASE}/play`, 'play')

    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('href')).toBe(BASE)
    expect(screen.getByRole('link', { name: 'Matches' }).getAttribute('href')).toBe(`${BASE}/matches`)
    expect(screen.getByRole('link', { name: 'Games' }).getAttribute('href')).toBe(`${BASE}/games`)
    expect(screen.getByRole('link', { name: 'Leagues' }).getAttribute('href')).toBe(`${BASE}/leagues`)
  })

  it('offers the two domestic competition seasons in the quick switcher', () => {
    renderShell(BASE, 'overview')

    const switcher = screen.getByRole('combobox', { name: 'Switch competition' })
    expect(switcher).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Premier League 2026/27' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Scottish Premiership 2026/27' })).toBeTruthy()
  })

  it('switches competition without dropping a deep route, query or hash', () => {
    renderShell(`${BASE}/games/match-predictor/standings?view=month#you`, 'games')

    fireEvent.change(screen.getByRole('combobox', { name: 'Switch competition' }), {
      target: { value: 'scottish-premiership/2026-27' },
    })

    expect(screen.getByLabelText('Current route').textContent).toBe(
      `${SCOTTISH}/games/match-predictor/standings?view=month#you`,
    )
  })
})
