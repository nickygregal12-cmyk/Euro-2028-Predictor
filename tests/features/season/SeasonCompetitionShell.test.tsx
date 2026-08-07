import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SeasonCompetitionShell } from '../../../src/features/season/SeasonCompetitionShell'
import { seasonShellDestinations } from '../../../src/features/season/seasonDestinations'

const BASE = '/competitions/premier-league/2026-27'
const SCOTTISH = '/competitions/scottish-premiership/2026-27'

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

  it('offers a one-tap switch to the other domestic competition', () => {
    renderShell(BASE, 'overview')

    expect(
      screen.getByRole('link', { name: 'Switch to Scottish Premiership' }).getAttribute('href'),
    ).toBe(SCOTTISH)
  })

  it('switches competition without dropping a deep route, query or hash', () => {
    renderShell(`${BASE}/games/match-predictor/standings?view=month#you`, 'games')

    expect(
      screen.getByRole('link', { name: 'Switch to Scottish Premiership' }).getAttribute('href'),
    ).toBe(`${SCOTTISH}/games/match-predictor/standings?view=month#you`)
  })
})
