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
  /**
   * The design authority keeps the global navigation visible inside a
   * competition and says the Hub is therefore one click away "without a
   * compensating Back to Hub control", listing the addition of one among the
   * things not to do. The Home tab in the global bar is that control; a link
   * here would be the second one it forbids.
   */
  it('adds no Back to Hub control beside the global navigation', () => {
    renderShell(BASE, 'overview')

    expect(screen.queryByRole('link', { name: 'Back to Hub' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Back to Games' })).toBeNull()
  })

  it('still gives a directly loaded game child its logical parent', () => {
    renderShell(`${BASE}/games/lms`, 'games')

    // `DFA-005` is a different requirement from a way home: a deep route has to
    // say where it sits, and this is that answer rather than a Hub exit.
    expect(screen.getByRole('link', { name: 'Back to Games' }).getAttribute('href')).toBe(
      `${BASE}/games`,
    )
    expect(screen.queryByRole('link', { name: 'Back to Hub' })).toBeNull()
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
