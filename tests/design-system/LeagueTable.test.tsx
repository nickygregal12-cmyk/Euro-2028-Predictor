import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  LeagueTable,
  type LeagueTableRow,
  type LeagueZone,
} from '../../src/design-system/LeagueTable'
import type { ClubIdentityTokens } from '../../src/design-system/ClubIdentity'

/**
 * The cases below are the ones where a wrong answer still looks like a table.
 * Zone boundaries are off-by-one prone, a split divider in the wrong place
 * misdescribes a competition, and a movement arrow that defaults to "up" when
 * there is no history is a confident lie.
 */

const CLUB: ClubIdentityTokens = { monogram: 'ABC', primary: '#EF0107' }

function row(position: number, over: Partial<LeagueTableRow> = {}): LeagueTableRow {
  return {
    position,
    name: `Club ${position}`,
    club: CLUB,
    played: 38,
    goalDifference: 0,
    points: 50,
    ...over,
  }
}

const ZONES: LeagueZone[] = [
  { from: 1, to: 1, kind: 'champion', label: 'Champions' },
  { from: 2, to: 3, kind: 'europe', label: 'Champions League' },
  { from: 6, to: 6, kind: 'relegation', label: 'Relegation' },
]

/** The row element for a position, found through its accessible club name. */
function rowFor(container: HTMLElement, position: number): HTMLElement {
  const cell = within(container).getByText(`Club ${position}`)
  const found = cell.closest('[role="row"]')
  if (!found) throw new Error(`No row found for position ${position}`)
  return found as HTMLElement
}

describe('LeagueTable — zones', () => {
  it('applies a zone to every position inside its inclusive range', () => {
    const { container } = render(
      <LeagueTable caption="Test" rows={[1, 2, 3].map((p) => row(p))} zones={ZONES} />,
    )

    expect(rowFor(container, 1).getAttribute('class')).toContain('champion')
    // Both ends of the 2–3 range: an exclusive `to` would drop position 3.
    expect(rowFor(container, 2).getAttribute('class')).toContain('europe')
    expect(rowFor(container, 3).getAttribute('class')).toContain('europe')
  })

  it('leaves a position in no zone unstyled', () => {
    const { container } = render(
      <LeagueTable caption="Test" rows={[4, 5].map((p) => row(p))} zones={ZONES} />,
    )

    for (const position of [4, 5]) {
      const className = rowFor(container, position).getAttribute('class') ?? ''
      expect(className).not.toContain('champion')
      expect(className).not.toContain('europe')
      expect(className).not.toContain('relegation')
    }
  })

  it('names the zone in the accessible row description, so colour is not the only signal', () => {
    render(<LeagueTable caption="Test" rows={[row(1)]} zones={ZONES} />)

    expect(screen.getByText('— Champions', { exact: false })).toBeTruthy()
  })

  it('renders every row unstyled when no zones are supplied', () => {
    const { container } = render(<LeagueTable caption="Test" rows={[1, 2, 3].map((p) => row(p))} />)

    for (const position of [1, 2, 3]) {
      const className = rowFor(container, position).getAttribute('class') ?? ''
      expect(className).not.toContain('champion')
    }
  })
})

describe('LeagueTable — the Scottish split', () => {
  it('renders the divider after splitAfter, not before it', () => {
    render(
      <LeagueTable
        caption="Test"
        rows={[1, 2, 3, 4].map((p) => row(p))}
        splitAfter={2}
        splitLabels={{ top: 'Top half', bottom: 'Bottom half' }}
      />,
    )

    // The divider belongs to the first row of the lower half — position 3.
    const divider = screen.getByText('Bottom half')
    const group = divider.closest('[role="row"]')?.parentElement
    expect(within(group as HTMLElement).getByText('Club 3')).toBeTruthy()
  })

  it('omits the divider entirely when splitAfter is not set', () => {
    render(<LeagueTable caption="Test" rows={[1, 2, 3, 4].map((p) => row(p))} />)

    expect(screen.queryByText('Bottom half')).toBeNull()
  })

  it('does not restart numbering across the divider', () => {
    // The split divides the fixture list, not the table. Points and positions
    // carry through it, so a table showing 1..6 twice would be wrong.
    render(<LeagueTable caption="Test" rows={[1, 2, 3, 4].map((p) => row(p))} splitAfter={2} />)

    expect(screen.getByText('Club 4')).toBeTruthy()
    expect(screen.getAllByText('3')).toBeTruthy()
  })
})

describe('LeagueTable — number formatting', () => {
  it('signs a positive goal difference and leaves negative and zero alone', () => {
    render(
      <LeagueTable
        caption="Test"
        rows={[
          row(1, { goalDifference: 45 }),
          row(2, { goalDifference: 0 }),
          row(3, { goalDifference: -12 }),
        ]}
      />,
    )

    expect(screen.getByText('+45')).toBeTruthy()
    // Zero is not positive: "+0" would be wrong.
    expect(screen.getByText('0')).toBeTruthy()
    expect(screen.getByText('-12')).toBeTruthy()
  })
})

describe('LeagueTable — movement', () => {
  it('omits movement entirely when absent rather than defaulting to an arrow', () => {
    // The failure this guards: a table with no previous round rendering every
    // club as having risen.
    render(<LeagueTable caption="Test" rows={[row(1)]} />)

    expect(screen.queryByLabelText('Up')).toBeNull()
    expect(screen.queryByLabelText('Down')).toBeNull()
  })

  it("omits movement for 'none' as well as for undefined", () => {
    render(<LeagueTable caption="Test" rows={[row(1, { movement: 'none' })]} />)

    expect(screen.queryByLabelText('Up')).toBeNull()
    expect(screen.queryByLabelText('Down')).toBeNull()
  })

  it('renders up and down movement with an accessible label', () => {
    render(
      <LeagueTable
        caption="Test"
        rows={[row(1, { movement: 'up' }), row(2, { movement: 'down' })]}
      />,
    )

    expect(screen.getByLabelText('Up')).toBeTruthy()
    expect(screen.getByLabelText('Down')).toBeTruthy()
  })
})

describe('LeagueTable — structure', () => {
  it('uses ARIA table roles because the visual grid replaces native table layout', () => {
    render(<LeagueTable caption="Premier League" rows={[row(1)]} />)

    expect(screen.getByRole('table', { name: 'Premier League' })).toBeTruthy()
    expect(screen.getAllByRole('columnheader').length).toBe(5)
  })

  it('renders each club through ClubIdentity rather than any other path', () => {
    // ADR 0017: one rendering path. If a row ever draws a club directly, this
    // is where it shows up.
    render(<LeagueTable caption="Test" rows={[row(1, { name: 'Arsenal' })]} />)

    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
  })
})
