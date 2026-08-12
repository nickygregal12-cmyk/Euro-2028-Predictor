import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { SeasonFixtureLeagues } from '../../../src/features/season/SeasonFixtureLeagues'
import { mapSeasonLeagueMatchweekPredictions } from '../../../src/services/supabase/seasonLeaguePredictionsModel'
import { mapSeasonLeagueMovement } from '../../../src/services/supabase/seasonLeagueMovementModel'

/**
 * The Match Centre's "Your leagues" section, after the page started supplying
 * its payload rather than letting the panel fetch it.
 *
 * THE PROPERTY THIS EXISTS FOR is the one the refactor could silently break:
 * contract 150's movement must be read ONCE per revealed league, not once per
 * transition of the payload it arrives beside. Depending on the pages object
 * itself re-ran the fetch every time any league's state changed identity, which
 * is the repeated identical query that lifting the predictions read was meant
 * to remove in the first place.
 */

const REVEALED = {
  league: { id: 'lg-1', name: 'The Office' },
  matchweek: { id: 'mw-5', ordinal: 5, label: 'Matchweek 5', locks_at: null },
  revealed: true,
  server_now: null,
  fixtures: [
    { id: 'fx-1', kickoff_at: null, status: 'played', home: 'Celtic', away: 'Rangers', result: { home: 2, away: 1 } },
  ],
  member_count: 2,
  predicted_count: 2,
  members_returned: 2,
  members_truncated: false,
  members: [
    {
      user_id: 'u-1',
      display_name: 'Ann',
      is_self: false,
      points: 8,
      settled_at: '2026-08-16T20:00:00Z',
      joker_played: false,
      predictions: { 'fx-1': { home: 2, away: 1 } },
    },
    {
      user_id: 'u-2',
      display_name: 'Bob',
      is_self: true,
      points: 3,
      settled_at: '2026-08-16T20:00:00Z',
      joker_played: false,
      predictions: { 'fx-1': { home: 1, away: 0 } },
    },
  ],
}

const HIDDEN = { ...REVEALED, revealed: false, members: [], predicted_count: 0 }

const MOVEMENT = {
  league: { id: 'lg-1', name: 'The Office' },
  matchweek: { id: 'mw-5', ordinal: 5, label: 'Matchweek 5' },
  settled: true,
  server_now: null,
  members: [
    {
      user_id: 'u-2',
      display_name: 'Bob',
      is_self: true,
      points_before: 40,
      points_after: 43,
      points_this_matchweek: 3,
      rank_before: 2,
      rank_after: 1,
      movement: 1,
      gap_to_leader_before: 4,
      gap_to_leader_after: 0,
    },
  ],
}

const LEAGUES = [{ id: 'lg-1', name: 'The Office' }]

function renderPanel(node: React.ReactElement) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('SeasonFixtureLeagues with a supplied payload', () => {
  it('renders the members without asking for the predictions itself', async () => {
    const loadMovement = vi.fn(() => Promise.resolve(mapSeasonLeagueMovement(MOVEMENT)))
    const loadPredictions = vi.fn()

    renderPanel(
      <SeasonFixtureLeagues
        fixtureId="fx-1"
        competitionRoundId="round-5"
        leagues={LEAGUES}
        pages={{
          'lg-1': { kind: 'ready', page: mapSeasonLeagueMatchweekPredictions(REVEALED) },
        }}
        loadPredictions={loadPredictions}
        loadMovement={loadMovement}
      />,
    )

    expect(await screen.findByText('Ann')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    // The page already read it. Asking again would be the same RPC twice.
    expect(loadPredictions).not.toHaveBeenCalled()
  })

  it('reads the movement exactly once for a revealed league', async () => {
    const loadMovement = vi.fn(() => Promise.resolve(mapSeasonLeagueMovement(MOVEMENT)))
    const page = mapSeasonLeagueMatchweekPredictions(REVEALED)

    const view = renderPanel(
      <SeasonFixtureLeagues
        fixtureId="fx-1"
        competitionRoundId="round-5"
        leagues={LEAGUES}
        pages={{ 'lg-1': { kind: 'ready', page } }}
        loadMovement={loadMovement}
      />,
    )

    await screen.findByText('Ann')
    await waitFor(() => expect(loadMovement).toHaveBeenCalledTimes(1))

    // A fresh pages OBJECT carrying the same answer — which is what a parent
    // re-render produces — must not buy a second request.
    view.rerender(
      <MemoryRouter>
        <SeasonFixtureLeagues
          fixtureId="fx-1"
          competitionRoundId="round-5"
          leagues={[{ id: 'lg-1', name: 'The Office' }]}
          pages={{ 'lg-1': { kind: 'ready', page } }}
          loadMovement={loadMovement}
        />
      </MemoryRouter>,
    )

    await screen.findByText('Ann')
    expect(loadMovement).toHaveBeenCalledTimes(1)
  })

  it('never asks for movement on a league that has not revealed', async () => {
    const loadMovement = vi.fn(() => Promise.resolve(mapSeasonLeagueMovement(MOVEMENT)))

    renderPanel(
      <SeasonFixtureLeagues
        fixtureId="fx-1"
        competitionRoundId="round-5"
        leagues={LEAGUES}
        pages={{
          'lg-1': { kind: 'ready', page: mapSeasonLeagueMatchweekPredictions(HIDDEN) },
        }}
        loadMovement={loadMovement}
      />,
    )

    // Hidden, and hidden completely: no member rows and no count of who played.
    expect(
      await screen.findByText(/Predictions are hidden until Matchweek 5 locks/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Ann')).not.toBeInTheDocument()
    expect(loadMovement).not.toHaveBeenCalled()
  })

  it('keeps a failed league distinct from a hidden or an empty one', async () => {
    renderPanel(
      <SeasonFixtureLeagues
        fixtureId="fx-1"
        competitionRoundId="round-5"
        leagues={LEAGUES}
        pages={{ 'lg-1': { kind: 'failed' } }}
        loadMovement={() => Promise.resolve(mapSeasonLeagueMovement(MOVEMENT))}
      />,
    )

    expect(
      await screen.findByText(/This league’s predictions could not be loaded\./),
    ).toBeInTheDocument()
  })

  it('still fetches for itself where no payload is supplied', async () => {
    const loadPredictions = vi.fn(() =>
      Promise.resolve(mapSeasonLeagueMatchweekPredictions(REVEALED)),
    )
    const loadMovement = vi.fn(() => Promise.resolve(mapSeasonLeagueMovement(MOVEMENT)))

    renderPanel(
      <SeasonFixtureLeagues
        fixtureId="fx-1"
        competitionRoundId="round-5"
        leagues={LEAGUES}
        loadPredictions={loadPredictions}
        loadMovement={loadMovement}
      />,
    )

    expect(await screen.findByText('Ann')).toBeInTheDocument()
    expect(loadPredictions).toHaveBeenCalledTimes(1)
  })
})
