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

  /**
   * The rule the nine dead labels broke. A section with no page is absent, not
   * greyed: "Not built yet" is a roadmap, and a roadmap rendered as navigation
   * is what a player reports as an unclickable button.
   */
  it('lists no section it cannot open', () => {
    for (const [game, path] of [
      ['match-predictor', `${BASE}/games/match-predictor`],
      ['lms', `${BASE}/games/lms`],
      ['championship', `${BASE}/games/championship/${CUP_ID}/table`],
    ] as const) {
      const view = render(
        <MemoryRouter initialEntries={[path]}>
          <SeasonGameSubNav game={game} />
        </MemoryRouter>,
      )

      expect(view.container.querySelectorAll('[aria-disabled]')).toHaveLength(0)
      for (const label of ['Trends', 'History', 'Rules']) {
        expect(view.queryByText(label), `${game} still lists ${label}`).toBeNull()
      }

      view.unmount()
    }
  })

  it('renders nothing at all for Last Man Standing, whose one section is the page', () => {
    const view = render(
      <MemoryRouter initialEntries={[`${BASE}/games/lms`]}>
        <SeasonGameSubNav game="lms" />
      </MemoryRouter>,
    )

    // Three of its four tabs were unbuilt, so the fourth is where the player
    // already is. A lone tab restating that is furniture, not navigation, and
    // at the game's own root there is no back link either — the competition
    // shell above already carries "Back to Games". An empty wrapper would hold
    // its gap in the column, so the component declines to render.
    expect(view.container).toBeEmptyDOMElement()
    expect(screen.queryByText('Standings')).toBeNull()
  })

  it('makes the Championship game root an instance chooser', () => {
    renderNav('championship', `${BASE}/games/championship`)

    // One item, and it is the active one, so there is no navigation to draw.
    expect(screen.queryByRole('navigation', { name: 'Predictor Championship navigation' })).toBeNull()
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
    expect(
      screen.getByRole('link', { name: 'Back to Championships' }).getAttribute('href'),
    ).toBe(`${BASE}/games/championship`)
  })
})
