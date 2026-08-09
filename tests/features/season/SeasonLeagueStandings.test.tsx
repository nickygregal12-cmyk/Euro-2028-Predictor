import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonLeagueStandings } from '../../../src/features/season/SeasonLeagueStandings'
import type { SeasonLeagueStandingsGateway } from '../../../src/features/season/leagueStandingsModel'
import type {
  SeasonLeagueStandingsPage,
  SeasonLeagueStandingsRow,
} from '../../../src/services/supabase/seasonLeagueStandings'

function row(overrides: Partial<SeasonLeagueStandingsRow> = {}): SeasonLeagueStandingsRow {
  return {
    userId: 'user-sam',
    displayName: 'Sam',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: false,
    hasEntry: true,
    ...overrides,
  }
}

function page(overrides: Partial<SeasonLeagueStandingsPage> = {}): SeasonLeagueStandingsPage {
  return {
    rows: [row()],
    totalCount: 1,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

function renderTable(gateway: SeasonLeagueStandingsGateway, leagueId = 'league-1') {
  render(
    <SeasonLeagueStandings gateway={gateway} leagueId={leagueId} leagueName="The Office" />,
  )
}

describe('a season league table', () => {
  it('asks the server for the league it was given', async () => {
    const gateway = { load: vi.fn(async () => page()) }
    renderTable(gateway, 'league-7')

    await waitFor(() => expect(gateway.load).toHaveBeenCalledWith('league-7', null))
  })

  it('shows points beside matchweeks played, because ADR 0012 pairs them', async () => {
    renderTable({ load: vi.fn(async () => page()) })

    expect(await screen.findByText('Sam')).toBeTruthy()
    expect(screen.getByText('84')).toBeTruthy()
    expect(screen.getByText('22')).toBeTruthy()
  })

  it('says "Not entered" in text, not by a dimmed row', async () => {
    // §11.8: status is never conveyed by colour alone, and a greyed row says
    // nothing at all to a screen reader.
    renderTable({
      load: vi.fn(async () =>
        page({
          rows: [row({ hasEntry: false, points: 0, matchweeksPlayed: 0, rank: 2, position: 2 })],
        }),
      ),
    })

    expect(await screen.findByText('Not entered')).toBeTruthy()
  })

  it('states where the caller stands without making them find their own row', async () => {
    renderTable({
      load: vi.fn(async () =>
        page({
          rows: [row({ displayName: 'Alex' })],
          totalCount: 12,
          you: row({ displayName: 'You', rank: 5, position: 5, points: 60 }),
        }),
      ),
    })

    expect(await screen.findByText('You are 5 of 12 on 60 points.')).toBeTruthy()
  })

  it('pins the caller’s row beneath the table when it fell outside the pages loaded', async () => {
    renderTable({
      load: vi.fn(async () =>
        page({
          rows: [row({ displayName: 'Alex' })],
          totalCount: 40,
          you: row({ displayName: 'Dana', rank: 31, position: 31 }),
        }),
      ),
    })

    expect(await screen.findByText('Dana')).toBeTruthy()
  })

  it('appends the next page instead of replacing the one on screen', async () => {
    // A table read downwards is one continuous ordering; re-rendering page two
    // alone would silently drop the context the member scrolled through.
    const load = vi
      .fn<SeasonLeagueStandingsGateway['load']>()
      .mockResolvedValueOnce(
        page({ rows: [row()], totalCount: 2, hasMore: true, nextCursor: 'cafe01' }),
      )
      .mockResolvedValueOnce(
        page({ rows: [row({ displayName: 'Alex', position: 2, rank: 2 })], totalCount: 2 }),
      )
    renderTable({ load })

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Alex')).toBeTruthy()
    expect(screen.getByText('Sam')).toBeTruthy()
    // The cursor is the server's, passed back exactly as issued.
    expect(load).toHaveBeenLastCalledWith('league-1', 'cafe01')
  })

  it('offers no "Load more" when the server said there is none', async () => {
    renderTable({ load: vi.fn(async () => page()) })

    await screen.findByText('Sam')
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('keeps the loaded rows when an append fails, and says so', async () => {
    // Replacing a readable table with an error page costs the member
    // everything they had already read.
    const load = vi
      .fn<SeasonLeagueStandingsGateway['load']>()
      .mockResolvedValueOnce(
        page({ rows: [row()], totalCount: 2, hasMore: true, nextCursor: 'cafe01' }),
      )
      .mockRejectedValueOnce(new Error('offline'))
    renderTable({ load })

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('We could not load more')).toBeTruthy()
    expect(screen.getByText('Sam')).toBeTruthy()
  })

  it('shows a failed first read as a failure, never as an empty table', async () => {
    renderTable({
      load: vi.fn(async () => {
        throw { code: 'insufficient_privilege' }
      }),
    })

    expect(await screen.findByText(/could not load The Office/)).toBeTruthy()
    expect(screen.getByText('You are no longer a member of this league.')).toBeTruthy()
  })

  it('retries the first page from the start after a failure', async () => {
    const load = vi
      .fn<SeasonLeagueStandingsGateway['load']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page())
    renderTable({ load })

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Sam')).toBeTruthy()
    expect(load).toHaveBeenLastCalledWith('league-1', null)
  })

  it('renders an empty league without inventing a row', async () => {
    renderTable({ load: vi.fn(async () => page({ rows: [], totalCount: 0 })) })

    expect(await screen.findByText(/^0 members/)).toBeTruthy()
  })
})
