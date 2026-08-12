import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonMatchweekForm } from '../../../src/features/season/SeasonMatchweekForm'
import { presentMatchweekForm } from '../../../src/features/season/matchweekFormModel'
import type { MatchPredictorFixture } from '../../../src/features/season/matchPredictorModel'
import type { SeasonClubForm } from '../../../src/services/supabase/seasonClubFormModel'

/**
 * `UI-F06`'s football half, on the surface that had none of it.
 *
 * The panel beside the prediction card held only the post-lock consensus, so
 * it was empty at exactly the moment a player is deciding what to enter and
 * full afterwards. These assertions protect the three things that make the
 * addition truthful rather than decorative:
 *
 *   * "we could not read the form" and "no club has played" are different
 *     states with different renderings, and only the second is a fact about
 *     the football;
 *   * the panel states its own window and a club that has played fewer
 *     matches than it shows its own count;
 *   * nothing in it recommends, ranks or predicts.
 */

const tokens = { monogram: 'XXX', primary: '#000000', secondary: '#ffffff' }

function fixture(id: string, home: string, away: string): MatchPredictorFixture {
  return {
    fixtureId: id,
    kickoffAt: '2026-08-15T14:00:00Z',
    home: { name: home, shortName: home.slice(0, 3), tokens },
    away: { name: away, shortName: away.slice(0, 3), tokens },
    prediction: null,
    result: null,
    points: null,
  }
}

function club(name: string, over: Partial<SeasonClubForm> = {}): SeasonClubForm {
  return {
    teamId: `t-${name}`,
    name,
    tokens,
    played: 6,
    won: 4,
    drawn: 1,
    lost: 1,
    goalsFor: 12,
    goalsAgainst: 5,
    form: ['W', 'W', 'D', 'L', 'W', 'W'],
    ...over,
  }
}

const FIXTURES = [fixture('f-1', 'Arsenal', 'Chelsea'), fixture('f-2', 'Celtic', 'Rangers')]

describe('presentMatchweekForm', () => {
  it('renders no guide at all when the form read has not answered', () => {
    // Absent, not empty. An empty panel beside a prediction card reads as
    // "these clubs have played nothing", which is a claim about the football
    // rather than about this build's ability to read it.
    expect(presentMatchweekForm(FIXTURES, null, 6)).toBeNull()
    expect(presentMatchweekForm(FIXTURES, [club('Arsenal')], null)).toBeNull()
  })

  it('keeps the card’s order rather than ranking the clubs', () => {
    const guide = presentMatchweekForm(
      FIXTURES,
      [club('Chelsea', { won: 6, form: ['W', 'W', 'W', 'W', 'W', 'W'] }), club('Arsenal')],
      6,
    )
    // Chelsea is in better form and is still the AWAY club of the first
    // fixture, because the panel is read alongside a card the player fills in
    // top to bottom.
    expect(guide?.fixtures.map((row) => row.fixtureId)).toEqual(['f-1', 'f-2'])
    expect(guide?.fixtures[0]?.home.name).toBe('Arsenal')
    expect(guide?.fixtures[0]?.away.name).toBe('Chelsea')
  })

  it('reports a matchweek where nothing has settled as empty, not as absent', () => {
    const guide = presentMatchweekForm(
      FIXTURES,
      FIXTURES.flatMap((row) => [
        club(row.home.name, { played: 0, won: 0, drawn: 0, lost: 0, form: [] }),
        club(row.away.name, { played: 0, won: 0, drawn: 0, lost: 0, form: [] }),
      ]),
      6,
    )
    expect(guide).not.toBeNull()
    expect(guide?.empty).toBe(true)
  })

  it('carries the window the server was asked for rather than a chosen number', () => {
    expect(presentMatchweekForm(FIXTURES, [club('Arsenal')], 4)?.window).toBe(4)
  })
})

describe('SeasonMatchweekForm', () => {
  it('renders nothing when no club in the matchweek has played', () => {
    const guide = presentMatchweekForm(
      FIXTURES,
      [club('Arsenal', { played: 0, won: 0, drawn: 0, lost: 0, form: [] })],
      6,
    )
    const { container } = render(<SeasonMatchweekForm guide={guide!} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('states each club’s record over its own played count', () => {
    const guide = presentMatchweekForm(
      FIXTURES,
      [club('Arsenal', { played: 4, won: 2, drawn: 1, lost: 1, form: ['W', 'D', 'L', 'W'] })],
      6,
    )
    render(<SeasonMatchweekForm guide={guide!} />)
    // "of the last 4", not "of the last 6": a record over four matches is not
    // a record over six, and the window is stated separately above.
    expect(screen.getByText(/Won 2, drawn 1, lost 1 of the last 4/)).toBeInTheDocument()
    expect(screen.getByText(/last 6 settled matches/)).toBeInTheDocument()
  })

  it('says so where a club has not played, rather than showing an empty run', () => {
    const guide = presentMatchweekForm(
      FIXTURES,
      [club('Arsenal'), club('Celtic', { played: 0, won: 0, drawn: 0, lost: 0, form: [] })],
      6,
    )
    render(<SeasonMatchweekForm guide={guide!} />)
    expect(screen.getAllByText('No settled matches yet').length).toBeGreaterThan(0)
  })

  it('recommends nothing, ranks nothing and predicts nothing', () => {
    const guide = presentMatchweekForm(FIXTURES, [club('Arsenal'), club('Chelsea')], 6)
    render(<SeasonMatchweekForm guide={guide!} />)
    const text = document.body.textContent ?? ''
    for (const forbidden of [/best pick/i, /favourite/i, /likely/i, /% chance/i, /predicted score/i]) {
      expect(text, `the form panel makes a claim it cannot support: ${forbidden}`).not.toMatch(
        forbidden,
      )
    }
    // And it offers no control: it is context, never an action.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
