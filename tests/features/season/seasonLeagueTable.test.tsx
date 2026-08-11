import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonLeagueTable } from '../../../src/features/season/SeasonLeagueTable'
import { mapCompetitionTable } from '../../../src/services/supabase/competitionTableModel'

/**
 * The competition's league table (`MIG-UI-13`, contract 160).
 *
 * WHY THIS SEGMENT DID NOT EXIST BEFORE. The register recorded that a table is
 * "not approximable in the browser": it carries the competition's own points
 * values, tie-break order, deductions and published boundaries, and contract
 * 141's form derivation is capped at twenty matches and knows none of them. The
 * Matches section therefore shipped Recent form and no Table control at all,
 * because a dead segment is worse than a missing one. Contract 160 supplies the
 * rules, so these assertions are about not undoing that reasoning:
 *
 *   1. the ORDER and the POSITION are the server's, never the array's;
 *   2. a boundary is drawn only where the server publishes one, and is never
 *      inferred from a club being bottom;
 *   3. a deduction is shown because it explains the table, and is never
 *      re-applied — it is already inside `points`;
 *   4. an incomplete season says so rather than reading as final.
 */

function row(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    team_id: 't1',
    team_name: 'Arsenal',
    played: 10,
    won: 7,
    drawn: 2,
    lost: 1,
    goals_for: 20,
    goals_against: 8,
    goal_difference: 12,
    points: 23,
    adjustment: null,
    boundary: null,
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    season: {
      id: 's1',
      name: 'Premier League 2026/27',
      season_key: '2026-27',
      status: 'active',
      display_timezone: 'Europe/London',
    },
    rules: {
      configured: true,
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      tie_breakers: ['goal_difference', 'goals_for'],
      promotion_places: 0,
      playoff_places: 0,
      relegation_places: 0,
    },
    rows: [row()],
    provenance: {
      fixtures_counted: 100,
      fixtures_outstanding: 280,
      fixtures_excluded: 0,
      fixtures_awarded: 0,
      last_result_at: '2026-10-01T14:00:00Z',
      provider_confirmed: 100,
      administrator_confirmed: 0,
      providers: ['sportmonks'],
    },
    ...overrides,
  }
}

function renderTable(overrides: Record<string, unknown> = {}) {
  const read = vi.fn(async () => mapCompetitionTable(payload(overrides)))
  render(<SeasonLeagueTable read={read} />)
  return read
}

describe('the competition league table', () => {
  it('prints the server’s position rather than the array index', async () => {
    // Deliberately out of array order with a shared position: the server has
    // already decided, and renumbering here would quietly disagree the first
    // time a stored tie-break order changes.
    renderTable({
      rows: [
        row({ position: 3, team_id: 't3', team_name: 'Chelsea', points: 18 }),
        row({ position: 1, team_id: 't1', team_name: 'Arsenal', points: 23 }),
      ],
    })

    const rows = await screen.findAllByRole('row')
    const body = rows.slice(1)
    expect(within(body[0]!).getByRole('rowheader').textContent).toContain('Chelsea')
    expect(within(body[0]!).getAllByRole('cell')[0]).toHaveTextContent('3')
    expect(within(body[1]!).getAllByRole('cell')[0]).toHaveTextContent('1')
  })

  it('shows a deduction beside the club and never re-applies it', async () => {
    renderTable({
      rows: [row({ team_name: 'Everton', points: 17, adjustment: -6 })],
    })

    // The total is what the server sent: 17, not 23.
    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]!).getAllByRole('cell').at(-1)).toHaveTextContent('17')
    expect(screen.getByText(/Everton: -6 points, already included above/)).toBeInTheDocument()
  })

  it('draws a boundary only where the competition publishes one', async () => {
    renderTable({
      rules: {
        configured: true,
        points_win: 3,
        points_draw: 1,
        points_loss: 0,
        tie_breakers: ['goal_difference'],
        promotion_places: 0,
        playoff_places: 0,
        relegation_places: 0,
      },
      rows: [row({ boundary: null }), row({ position: 20, team_id: 't20', team_name: 'Bottom' })],
    })

    await screen.findByRole('table')
    // Bottom of the table, and no relegation marking, because the server
    // published no relegation boundary.
    expect(screen.queryByText('Relegation')).toBeNull()
    expect(screen.queryByText('Promotion')).toBeNull()
  })

  it('names the boundaries the server did publish', async () => {
    renderTable({
      rows: [
        row({ boundary: 'promotion' }),
        row({ position: 5, team_id: 't5', team_name: 'Fifth', boundary: 'playoff' }),
        row({ position: 20, team_id: 't20', team_name: 'Bottom', boundary: 'relegation' }),
      ],
    })

    expect(await screen.findByText('Promotion')).toBeInTheDocument()
    expect(screen.getByText('Play-offs')).toBeInTheDocument()
    expect(screen.getByText('Relegation')).toBeInTheDocument()
  })

  it('says the season is incomplete rather than reading as final', async () => {
    renderTable()

    expect(await screen.findByText(/100 of 380 matches played/)).toBeInTheDocument()
  })

  it('says final when nothing is outstanding', async () => {
    renderTable({
      provenance: {
        fixtures_counted: 380,
        fixtures_outstanding: 0,
        fixtures_excluded: 0,
        fixtures_awarded: 0,
        last_result_at: '2027-05-24T15:00:00Z',
        provider_confirmed: 380,
        administrator_confirmed: 0,
        providers: ['sportmonks'],
      },
    })

    expect(await screen.findByText(/— final/)).toBeInTheDocument()
  })

  it('states the competition’s own tie-break order, in its own sequence', async () => {
    renderTable()

    expect(
      await screen.findByText(/separated by Goal difference, then Goals scored/),
    ).toBeInTheDocument()
  })

  it('says when the competition has not published its own rules', async () => {
    renderTable({
      rules: {
        configured: false,
        points_win: 3,
        points_draw: 1,
        points_loss: 0,
        tie_breakers: ['goal_difference'],
        promotion_places: 0,
        playoff_places: 0,
        relegation_places: 0,
      },
    })

    expect(await screen.findByText(/has not published its own rules/)).toBeInTheDocument()
  })

  it('reports a failed read as a failure, never as an empty table', async () => {
    const read = vi.fn(async () => {
      throw new Error('network')
    })
    render(<SeasonLeagueTable read={read} />)

    expect(await screen.findByText(/could not load the table/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('says a season with nothing settled has no table yet', async () => {
    renderTable({ rows: [] })

    expect(await screen.findByText(/No result has been settled/)).toBeInTheDocument()
  })

  it('signs the goal difference so it cannot be read as anything else', async () => {
    renderTable({
      rows: [
        row({ goal_difference: 12 }),
        row({ position: 20, team_id: 't20', team_name: 'Bottom', goal_difference: -18 }),
      ],
    })

    await screen.findByRole('table')
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText('-18')).toBeInTheDocument()
  })
})
