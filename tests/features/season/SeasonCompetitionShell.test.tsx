import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SeasonCompetitionShell } from '../../../src/features/season/SeasonCompetitionShell'
import { seasonShellDestinations } from '../../../src/features/season/seasonDestinations'
import { PlayerCompetitionsProvider } from '../../../src/app/providers/PlayerCompetitionsProvider'

const BASE = '/competitions/premier-league/2026-27'
const SCOTTISH = '/competitions/scottish-premiership/2026-27'

function renderShell(path: string, active: 'overview' | 'play' | 'matches' | 'games' | 'leagues') {
  render(
    <MemoryRouter initialEntries={[path]}>
      {/* The masthead's competition selector reads the shell's membership. In
          a test there is no provider answer, so it renders its loading shape —
          which is the state these assertions want anyway: the shell's own
          navigation must be right before any read returns. */}
      <PlayerCompetitionsProvider>
      <SeasonCompetitionShell
        competitionName="Premier League"
        seasonLabel="2026/27"
        statusStrip={[]}
        active={active}
        destinations={seasonShellDestinations(BASE)}
      >
        <p>Route content</p>
      </SeasonCompetitionShell>
      </PlayerCompetitionsProvider>
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

  /**
   * The masthead used to carry "Switch to Scottish Premiership", built by
   * asking whether the current slug was `premier-league` and picking the other
   * one, with the season hard-coded. It was the clearest place the
   * two-competition world was written into the code rather than the data, and
   * on a platform of twenty competitions it would offer exactly one of them.
   * These assertions are the record that it is gone.
   */
  it('offers a compact competition selector rather than one hard-coded rival', () => {
    renderShell(BASE, 'overview')

    expect(screen.queryByRole('link', { name: /Switch to/ })).toBeNull()
    // The selector names the competition the player is in — the masthead
    // heading says it too, which is why this asks the disclosure by role.
    expect(screen.getByRole('group')).toHaveTextContent('Premier League')
    expect(screen.getByRole('link', { name: 'All competitions' })).toHaveAttribute(
      'href',
      '/competitions',
    )
  })

  it('never assembles a destination from a second competition it was not told about', () => {
    // With no membership answer there is no other competition to offer, and the
    // selector says so rather than guessing at one.
    renderShell(`${BASE}/games/match-predictor/standings?view=month#you`, 'games')

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links.some((href) => href?.startsWith(SCOTTISH))).toBe(false)
  })
})
