import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonLeagueWorkspace } from '../../../src/features/season/SeasonLeagueWorkspace'
import { mapSeasonLeagueMovement } from '../../../src/services/supabase/seasonLeagueMovementModel'

/**
 * The private league's Table · Matchweek · Members workspace.
 *
 * WHAT THESE ASSERTIONS ARE FOR. The movement line above the tabs is the only
 * place the caller's standing survives a tab change — the Table tab ranks the
 * league, Matchweek and Members do not — so it is carrying more weight than a
 * line about one settled matchweek looks like it is carrying. § 4A is binding
 * on what it may say: never a bare rank.
 *
 * The other half is the negative. An unsettled matchweek must render NO line
 * rather than a position from totals that are still changing, because reporting
 * a climb out of those would show a player a place they never held.
 */

// The Table tab is not under test here; it needs a page-shaped answer and
// nothing more.
const STANDINGS = {
  load: vi.fn(async () => ({
    rows: [],
    totalCount: 0,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
  })),
}

function movement(over: Record<string, unknown> = {}) {
  return mapSeasonLeagueMovement({
    league: { id: 'l-1', name: 'Saturday Night League' },
    matchweek: { id: 'r-12', ordinal: 12, label: 'Matchweek 12' },
    settled: true,
    server_now: '2026-11-02T18:00:00Z',
    members: [
      {
        user_id: 'u-1',
        display_name: 'You',
        is_self: true,
        rank_before: 7,
        rank_after: 4,
        movement: 3,
        points_this_matchweek: 34,
        points_before: 234,
        points_after: 268,
        gap_to_leader_after: 12,
      },
      ...Array.from({ length: 11 }, (_, index) => ({
        user_id: `u-${index + 2}`,
        display_name: `Player ${index + 2}`,
        is_self: false,
        rank_before: index + 1,
        rank_after: index + 1,
        movement: 0,
        points_this_matchweek: 10,
        points_before: 290 - index,
        points_after: 300 - index,
        gap_to_leader_after: index * 3,
      })),
    ],
    ...over,
  })
}

function renderWorkspace(loadMovement?: () => Promise<ReturnType<typeof movement>>) {
  render(
    <SeasonLeagueWorkspace
      leagueId="l-1"
      leagueName="Saturday Night League"
      standings={STANDINGS}
      competitionRoundId={null}
      loadMatchweek={async () => {
        throw new Error('not under test')
      }}
      loadMovement={loadMovement}
      tab="table"
      onTabChange={() => {}}
    />,
  )
}

describe('the private league workspace', () => {
  it('never prints a bare rank: the field size travels with it', async () => {
    // § 4A is binding — "4th of 18 · ↑3", never "4th". `presentLeagueMovement`
    // has computed the field size since it was written and this line printed
    // the ordinal without it.
    renderWorkspace(async () => movement())

    await waitFor(() => expect(screen.getByText(/7th → 4th of 12/)).toBeInTheDocument())
    expect(screen.getByText('↑3')).toBeInTheDocument()
  })

  it('shows the standing above the tabs, so it survives a tab change', async () => {
    // The Table tab ranks the league; Matchweek and Members do not. Without
    // this a player reading their league-mates' predictions has lost sight of
    // where they are.
    renderWorkspace(async () => movement())

    const line = await screen.findByText(/7th → 4th of 12/)
    const tabs = screen.getByRole('tablist')
    // The line's own paragraph, not the span inside it: `compareDocumentPosition`
    // answers about the nodes given, and a descendant of the paragraph is not
    // what precedes the tablist.
    const paragraph = line.closest('p')
    expect(paragraph).not.toBeNull()
    expect(
      paragraph!.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders no line at all from an unsettled matchweek', async () => {
    // Totals that are still changing would show a player a position they never
    // held. Absence is the honest answer.
    renderWorkspace(async () => movement({ settled: false, members: [] }))

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    expect(screen.queryByText(/of 12/)).not.toBeInTheDocument()
  })

  it('renders no line when the movement read fails, and keeps the tabs', async () => {
    // Movement is context, never the point of the page.
    renderWorkspace(async () => {
      throw new Error('network')
    })

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument())
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
  })

  it('offers the three accepted views and no others', async () => {
    renderWorkspace()
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Table', 'Matchweek', 'Members'])
    fireEvent.click(tabs[1]!)
  })
})
