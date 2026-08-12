import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonCompetitionForm } from '../../../src/features/season/SeasonCompetitionForm'
import type { SeasonClubForm } from '../../../src/services/supabase/seasonClubFormModel'

/**
 * Club form in its two layouts.
 *
 * THE PROPERTY THAT MATTERS IS THAT THEY HOLD THE SAME FACTS. `panel` exists
 * because an eight-column table in a 320px contextual column is either a page
 * overflow or a horizontal scroll nobody discovers — not because the panel
 * needs to say less. A layout that quietly drops goals for and against would
 * be a different panel wearing the same name, and it would be invisible in
 * review because both render something plausible.
 *
 * So each number is asserted in both, and the accessible sentence is asserted
 * to be written once rather than twice with a drift between them.
 */

const tokens = { monogram: 'ARS', primary: '#ff0000', secondary: '#ffffff' }

function club(over: Partial<SeasonClubForm> = {}): SeasonClubForm {
  return {
    teamId: 't-1',
    name: 'Arsenal',
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

describe('SeasonCompetitionForm', () => {
  it('renders nothing at all when no club has played', () => {
    // Not a table of zeroes: at the start of a season that is every club in
    // the competition, and it looks broken rather than early.
    const { container } = render(
      <SeasonCompetitionForm
        clubs={[club({ played: 0, won: 0, drawn: 0, lost: 0, form: [] })]}
        matches={6}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('states the window and refuses to call itself a league table', () => {
    render(<SeasonCompetitionForm clubs={[club()]} matches={6} />)
    expect(screen.getByText(/last 6 settled matches/)).toBeInTheDocument()
    expect(screen.getByText(/This is form, not the league table/)).toBeInTheDocument()
  })

  it('carries every number in the panel layout that the table layout has', () => {
    const both = ['6', '4', '1', '12', '5']

    const table = render(<SeasonCompetitionForm clubs={[club()]} matches={6} />)
    const tableRow = within(table.container).getByRole('row', { name: /Arsenal/ })
    for (const value of both) {
      expect(tableRow.textContent, `the table layout is missing ${value}`).toContain(value)
    }
    table.unmount()

    const panel = render(<SeasonCompetitionForm clubs={[club()]} matches={6} layout="panel" />)
    const panelRow = within(panel.container).getByRole('listitem')
    for (const value of both) {
      expect(panelRow.textContent, `the panel layout is missing ${value}`).toContain(value)
    }
  })

  it('speaks the record once, and never the form letters', () => {
    render(<SeasonCompetitionForm clubs={[club()]} matches={6} layout="panel" />)
    // The sentence, not "W W D L W W" read one character at a time.
    expect(
      screen.getByText(/Won 4, drawn 1, lost 1 of the last 6, scoring 12 and conceding 5/),
    ).toBeInTheDocument()
    // The letters are decoration and are hidden from assistive technology.
    for (const letters of screen.getAllByText('W', { selector: 'span' })) {
      expect(letters.closest('[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it('does not repeat the goals in the table layout, where they are their own columns', () => {
    // The shared accessible sentence takes the goals only in the panel. In the
    // table they have headed columns, so repeating them would make a screen
    // reader say each number twice.
    render(<SeasonCompetitionForm clubs={[club()]} matches={6} />)
    expect(screen.getByText(/Won 4, drawn 1, lost 1 of the last 6$/)).toBeInTheDocument()
  })
})
