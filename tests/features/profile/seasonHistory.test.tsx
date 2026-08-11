import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonHistorySection } from '../../../src/features/profile/SeasonHistorySection'
import { mapSeasonHistoryPage } from '../../../src/services/supabase/seasonHistoryModel'

/**
 * Season history, over contract 161 (`MIG-UI-17`) and contract 156's archive.
 *
 * WHAT THESE ASSERTIONS USED TO PROTECT, and why they changed. The section was
 * built on `get_season_wrapped`, asked once per competition in the PUBLISHED
 * catalogue. That worked and was honest, and it had one hole the surface had to
 * apologise for in its own copy: a season stopped being findable the day it
 * stopped being published, so a player's 2026/27 would vanish from their own
 * history when it was archived. Contract 161 asks the other question — which
 * seasons did YOU play in — so the apology is gone and this test asserts its
 * absence.
 *
 * WHAT STILL HOLDS. Nothing is recomputed; a season still being played is
 * listed and says so rather than being rendered as zeros; and a failed read is
 * a failure rather than an empty history.
 */

function season(overrides: Record<string, unknown> = {}) {
  return {
    tournament_id: 's1',
    season_name: 'Premier League 2026/27',
    season_key: '2026/27',
    kind: 'league_season',
    status: 'complete',
    competition_id: 'c1',
    competition_name: 'Premier League',
    competition_slug: 'premier-league',
    in_published_catalogue: true,
    complete: true,
    wrapped_available: true,
    final: {
      points: 412,
      rank: 7,
      field_size: 1204,
      matchweeks_played: 38,
      finalised_at: '2027-05-25T18:00:00Z',
    },
    games: [{ game_key: 'main_predictor', game_name: 'Match Predictor' }],
    ...overrides,
  }
}

function renderHistory(payload: Record<string, unknown>) {
  const read = vi.fn(async () => mapSeasonHistoryPage(payload))
  render(<SeasonHistorySection read={read} />)
  return read
}

describe('season history', () => {
  it('shows a finished season exactly as the archive stored it', async () => {
    renderHistory({ total: 1, seasons: [season()] })

    expect(await screen.findByText('412')).toBeInTheDocument()
    expect(screen.getByText('7 of 1204')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('Premier League')).toBeInTheDocument()
  })

  it('keeps a season the catalogue no longer publishes, and marks it archived', async () => {
    // The whole point of MIG-UI-17. Before contract 161 this season was
    // invisible to the player who played it.
    renderHistory({
      total: 1,
      seasons: [season({ in_published_catalogue: false, status: 'archived' })],
    })

    expect(await screen.findByText('Premier League')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('no longer apologises for a limit it does not have', async () => {
    renderHistory({ total: 1, seasons: [season()] })
    await screen.findByText('412')

    expect(screen.queryByText(/no longer listed cannot be looked up/)).toBeNull()
    expect(screen.queryByText(/competitions currently published/)).toBeNull()
  })

  it('lists a season still being played, and never as zeros', async () => {
    renderHistory({
      total: 1,
      seasons: [season({ status: 'active', complete: false, wrapped_available: false, final: null })],
    })

    expect(await screen.findByText(/Still being played/)).toBeInTheDocument()
    expect(screen.queryByText('Points')).toBeNull()
  })

  it('distinguishes a finished season with no Wrapped from one still running', async () => {
    renderHistory({
      total: 1,
      seasons: [season({ complete: true, wrapped_available: false, final: null })],
    })

    expect(await screen.findByText(/has finished. Its Wrapped has not been written yet/)).toBeInTheDocument()
  })

  it('prints a rank without a field size rather than inventing one', async () => {
    renderHistory({
      total: 1,
      seasons: [
        season({
          final: { points: 12, rank: 3, field_size: null, matchweeks_played: 2 },
        }),
      ],
    })

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.queryByText(/of null/)).toBeNull()
  })

  it('states the page bound rather than reading as a complete history', async () => {
    renderHistory({
      total: 12,
      limit: 1,
      offset: 0,
      has_more: true,
      seasons: [season()],
    })

    expect(await screen.findByText(/Showing 1 of 12 seasons/)).toBeInTheDocument()
  })

  it('says a player has played nothing yet, and that it will persist afterwards', async () => {
    renderHistory({ total: 0, seasons: [] })

    expect(await screen.findByText(/You have not played a season yet/)).toBeInTheDocument()
    expect(screen.getByText(/stay here afterwards/)).toBeInTheDocument()
  })

  it('reports a failed read as a failure, never as an empty history', async () => {
    render(
      <SeasonHistorySection
        read={vi.fn(async () => {
          throw new Error('network')
        })}
      />,
    )

    expect(await screen.findByText(/could not load your season history/i)).toBeInTheDocument()
    expect(screen.queryByText(/not played a season yet/)).toBeNull()
  })
})
