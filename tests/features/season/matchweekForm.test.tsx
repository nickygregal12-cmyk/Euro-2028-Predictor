import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonMatchweekForm } from '../../../src/features/season/SeasonMatchweekForm'
import { presentMatchweekForm } from '../../../src/features/season/matchweekFormModel'
import type { MatchPredictorFixture } from '../../../src/features/season/matchPredictorModel'
import type { SeasonClubForm } from '../../../src/services/supabase/seasonClubFormModel'
import type { CompetitionTableRow } from '../../../src/services/supabase/competitionTableModel'

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

function tableRow(name: string, over: Partial<CompetitionTableRow> = {}): CompetitionTableRow {
  return {
    position: 3,
    teamId: `t-${name}`,
    teamName: name,
    played: 12,
    won: 7,
    drawn: 3,
    lost: 2,
    goalsFor: 22,
    goalsAgainst: 11,
    goalDifference: 11,
    points: 24,
    adjustment: null,
    boundary: null,
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

/**
 * Contract 160's position, beneath the form.
 *
 * `UI-F06`'s hierarchy is form then table, and the reason is the interesting
 * part: a run of six can flatter or slander a club and where it sits is the
 * season. These assertions protect the two ways that could go wrong — a
 * position invented for a club the table does not hold, and a position that
 * disagrees with the one the same player reads on the fixture they open next.
 */
describe('the table position beside the form', () => {
  const lookup = (name: string) =>
    name === 'Arsenal' ? tableRow('Arsenal', { position: 1, points: 30, played: 12 }) : null

  it('prints the server’s position and record, and derives neither', () => {
    const guide = presentMatchweekForm(FIXTURES, [club('Arsenal')], 6, lookup)
    render(<SeasonMatchweekForm guide={guide!} />)
    expect(screen.getByText(/1st · 30 pts from 12/)).toBeInTheDocument()
  })

  it('shows no position at all for a club the table does not hold', () => {
    const guide = presentMatchweekForm(FIXTURES, [club('Arsenal'), club('Chelsea')], 6, lookup)
    expect(guide?.fixtures[0]?.home.table).not.toBeNull()
    // Chelsea is in the matchweek and not in the table. A default row would be
    // a claim about the football; absence is the truth.
    expect(guide?.fixtures[0]?.away.table).toBeNull()
    render(<SeasonMatchweekForm guide={guide!} />)
    expect(screen.queryAllByText(/pts from/)).toHaveLength(1)
  })

  it('is optional: a competition with no table still shows its form', () => {
    // `get_competition_table` refuses anything that is not a league season, so
    // the panel must not depend on one existing.
    const guide = presentMatchweekForm(FIXTURES, [club('Arsenal')], 6)
    render(<SeasonMatchweekForm guide={guide!} />)
    expect(screen.getByText(/Won 4, drawn 1, lost 1 of the last 6/)).toBeInTheDocument()
    expect(screen.queryByText(/pts from/)).not.toBeInTheDocument()
  })

  it('ordinalises 11th, 12th and 13th rather than 11st, 12nd and 13rd', () => {
    for (const [position, expected] of [
      [11, '11th'],
      [12, '12th'],
      [13, '13th'],
      [21, '21st'],
      [2, '2nd'],
    ] as const) {
      const guide = presentMatchweekForm(FIXTURES, [club('Arsenal')], 6, (name) =>
        name === 'Arsenal' ? tableRow('Arsenal', { position }) : null,
      )
      const { unmount } = render(<SeasonMatchweekForm guide={guide!} />)
      expect(screen.getByText(new RegExp(`${expected} ·`))).toBeInTheDocument()
      unmount()
    }
  })
})
