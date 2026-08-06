import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SeasonCupPhasePage } from '../../../src/features/season/SeasonCupPhasePage'
import { createDevSeasonCupGateway } from '../../../src/dev/seasonCupGateway'

/**
 * The Championship phase surface, on the states a reviewer cannot conjure from
 * a healthy database — above all the split, which no hosted environment has
 * produced yet and which must read as a continuation, never an elimination.
 */

describe('the Predictor Championship phase page', () => {
  it('renders the league-phase table with entrants at ranks, never identifiers', async () => {
    render(<SeasonCupPhasePage gateway={createDevSeasonCupGateway('initial')} />)

    await waitFor(() => expect(screen.getByText('League phase')).toBeTruthy())
    expect(screen.getByText('Group of 6, ranked from settled rounds.')).toBeTruthy()
    // The label and the tag both print "You" on the caller's row.
    expect(screen.getAllByText('You').length).toBeGreaterThan(0)
    // The raw identifier is a key, never rendered text.
    expect(screen.queryByText(/entrant-\d/)).toBeNull()
  })

  it('explains the split as a continuation, with no elimination reading', async () => {
    render(<SeasonCupPhasePage gateway={createDevSeasonCupGateway('split')} />)

    await waitFor(() => expect(screen.getByText('The split')).toBeTruthy())
    expect(screen.getByText('Your group has reached the split')).toBeTruthy()
    expect(screen.getByText(/Points carry through/)).toBeTruthy()
    expect(screen.queryByText(/you (are|were|have been) eliminated/i)).toBeNull()
  })

  it('shows shared ranks as the server assigned them', async () => {
    render(<SeasonCupPhasePage gateway={createDevSeasonCupGateway('tied_ranks')} />)

    await waitFor(() => expect(screen.getAllByText('=2')).toHaveLength(2))
  })

  it('tells a non-entrant they are not entered, and shows no table', async () => {
    render(<SeasonCupPhasePage gateway={createDevSeasonCupGateway('not_entered')} />)

    await waitFor(() => expect(screen.getByText('You are not entered')).toBeTruthy())
    expect(screen.queryByText('League phase')).toBeNull()
  })

  it('renders an empty table as honestly empty, naming what fills it', async () => {
    render(<SeasonCupPhasePage gateway={createDevSeasonCupGateway('empty_table')} />)

    await waitFor(() => expect(screen.getByText('No table yet')).toBeTruthy())
    expect(screen.getByText(/Confirmed results decide it/)).toBeTruthy()
  })

  it('renders a load failure as a failure with a retry, never an empty table', async () => {
    render(<SeasonCupPhasePage gateway={createDevSeasonCupGateway('load_failed')} />)

    await waitFor(() =>
      expect(screen.getByText('We could not load your Championship group')).toBeTruthy(),
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText('No table yet')).toBeNull()
  })
})
