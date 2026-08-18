import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type {
  SeasonLeaderboardPage,
  SeasonLeaderboardRow,
} from '../../../src/services/supabase/seasonLeaderboard'
import type { SeasonStandingsGateway } from '../../../src/features/season/standingsModel'
import { useSeasonStandings } from '../../../src/features/season/useSeasonStandings'

/**
 * The standings paging hook.
 *
 * Three properties are worth executable protection, because each one fails
 * silently rather than loudly if it regresses:
 *
 * 1. Paging APPENDS. A "load more" that replaced would show page two alone and
 *    look like a short table rather than a bug.
 * 2. Reload RESTARTS. After a settlement the ordering itself can change, so
 *    stitching a fresh page onto stale rows renders a table that never existed.
 * 3. A superseded response never lands. A slow first page arriving after a
 *    reload would overwrite newer data with older, which is indistinguishable
 *    from "the server sent stale rows".
 *
 * The cursor is also asserted to travel back exactly as issued: reconstructing
 * one in the browser would be a second paging authority.
 */

function row(over: Partial<SeasonLeaderboardRow> = {}): SeasonLeaderboardRow {
  return {
    displayName: 'Ada',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    // Contract 191's identity. Present on every row the server produces, so a
    // builder that omitted it would let the model be exercised against a shape
    // the database cannot return.
    playerRef: 'entry-ada',
    reach: 'compare',
    playerId: null,
    ...over,
  }
}

function pageOf(
  names: readonly string[],
  over: Partial<SeasonLeaderboardPage> = {},
): SeasonLeaderboardPage {
  return {
    rows: names.map((displayName, index) => row({ displayName, position: index + 1 })),
    totalCount: 100,
    pageSize: 25,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...over,
  }
}

function Harness({ gateway }: { gateway: SeasonStandingsGateway }) {
  const { status, view, error, loadMore, reload } = useSeasonStandings(gateway)
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="names">{(view?.rows ?? []).map((r) => r.displayName).join(',')}</span>
      <button onClick={loadMore}>more</button>
      <button onClick={reload}>reload</button>
    </div>
  )
}

describe('the season standings hook', () => {
  it('appends the next page rather than replacing the table', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(pageOf(['Ada', 'Bo'], { hasMore: true, nextCursor: 'c1' }))
      .mockResolvedValueOnce(pageOf(['Cleo', 'Dee']))
    render(<Harness gateway={{ load }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('more').click())

    expect(screen.getByTestId('names').textContent).toBe('Ada,Bo,Cleo,Dee')
  })

  it('sends the server cursor back exactly as issued', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(pageOf(['Ada'], { hasMore: true, nextCursor: 'opaque::42' }))
      .mockResolvedValueOnce(pageOf(['Bo']))
    render(<Harness gateway={{ load }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('more').click())

    expect(load).toHaveBeenNthCalledWith(1, null)
    expect(load).toHaveBeenNthCalledWith(2, 'opaque::42')
  })

  it('restarts from the first page on reload instead of stitching', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(pageOf(['Ada', 'Bo'], { hasMore: true, nextCursor: 'c1' }))
      .mockResolvedValueOnce(pageOf(['Cleo']))
      .mockResolvedValueOnce(pageOf(['Zoë']))
    render(<Harness gateway={{ load }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('more').click())
    expect(screen.getByTestId('names').textContent).toBe('Ada,Bo,Cleo')

    await act(async () => void screen.getByText('reload').click())
    expect(screen.getByTestId('names').textContent).toBe('Zoë')
    expect(load).toHaveBeenLastCalledWith(null)
  })

  it('discards a superseded response so a slow page cannot overwrite a newer one', async () => {
    let releaseFirst: (page: SeasonLeaderboardPage) => void = () => {}
    const load = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<SeasonLeaderboardPage>((resolve) => (releaseFirst = resolve)),
      )
      .mockResolvedValueOnce(pageOf(['Fresh']))

    render(<Harness gateway={{ load }} />)
    // Reload while the first request is still in flight, then let the stale
    // one finish last. Without the sequence guard it would win by arriving.
    await act(async () => void screen.getByText('reload').click())
    await waitFor(() => expect(screen.getByTestId('names').textContent).toBe('Fresh'))

    await act(async () => {
      releaseFirst(pageOf(['Stale']))
      await Promise.resolve()
    })

    expect(screen.getByTestId('names').textContent).toBe('Fresh')
  })

  it('keeps the loaded rows readable when an append fails', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(pageOf(['Ada', 'Bo'], { hasMore: true, nextCursor: 'c1' }))
      .mockRejectedValueOnce(new Error('network'))
    render(<Harness gateway={{ load }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('more').click())

    // Still ready, still showing what loaded — the failure is reported beside
    // the table rather than replacing it.
    expect(screen.getByTestId('status').textContent).toBe('ready')
    expect(screen.getByTestId('names').textContent).toBe('Ada,Bo')
    expect(screen.getByTestId('error').textContent).not.toBe('')
  })

  it('reports an initial load failure as a failed page', async () => {
    const load = vi.fn().mockRejectedValue(new Error('network'))
    render(<Harness gateway={{ load }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('failed'))
    expect(screen.getByTestId('error').textContent).not.toBe('')
  })

  it('does not request another page when the server offered no cursor', async () => {
    const load = vi.fn().mockResolvedValue(pageOf(['Ada']))
    render(<Harness gateway={{ load }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('more').click())

    expect(load).toHaveBeenCalledTimes(1)
  })
})
