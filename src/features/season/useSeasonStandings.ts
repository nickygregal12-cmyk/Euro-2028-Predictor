import { useCallback, useEffect, useRef, useState } from 'react'
import type { SeasonLeaderboardRow } from '../../services/supabase/seasonLeaderboard'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  type SeasonStandingsGateway,
  type StandingsView,
  presentStandings,
} from './standingsModel'

/**
 * Season Match Predictor standings, one server-ranked page at a time.
 *
 * PAGING ACCUMULATES, IT DOES NOT REPLACE. "Load more" appends, because a
 * standings table read downwards is one continuous ordering and re-rendering
 * page two on its own would silently drop the context the player scrolled
 * through. Reload, by contrast, starts again from the first page: after a
 * settlement run the ordering itself may have changed, and stitching fresh
 * rows onto stale ones would show a table that never existed on the server.
 *
 * THE CURSOR IS THE SERVER'S, NEVER RECONSTRUCTED. `nextCursor` is passed back
 * exactly as received. Deriving one from the last row's position would put a
 * second paging authority in the browser and break the moment the server
 * changes how it encodes a cursor.
 *
 * A LATE RESPONSE NEVER WINS. Each load takes a sequence number and a response
 * from a superseded request is discarded, so a slow first page cannot land on
 * top of a reload the player asked for afterwards.
 */

export type SeasonStandingsState = {
  status: 'loading' | 'ready' | 'failed'
  view: StandingsView | null
  /** True while a "load more" is in flight; the table stays interactive. */
  loadingMore: boolean
  /** Set when the initial load failed, or a page failed to append. */
  error: string | null
  loadMore: () => void
  reload: () => void
}

export function useSeasonStandings(gateway: SeasonStandingsGateway): SeasonStandingsState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [view, setView] = useState<StandingsView | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accumulated = useRef<SeasonLeaderboardRow[]>([])
  const sequence = useRef(0)
  // Held in a ref as well as in `view` so `loadMore` never needs the cursor as
  // a dependency — a callback that changes identity on every page would remake
  // every handler bound to it.
  const cursor = useRef<string | null>(null)

  const run = useCallback(
    async (mode: 'initial' | 'more') => {
      sequence.current += 1
      const ticket = sequence.current

      if (mode === 'initial') {
        setStatus('loading')
        setError(null)
        accumulated.current = []
        cursor.current = null
      } else {
        setLoadingMore(true)
      }

      try {
        const page = await gateway.load(mode === 'initial' ? null : cursor.current)
        if (ticket !== sequence.current) return

        accumulated.current = [...accumulated.current, ...page.rows]
        cursor.current = page.nextCursor
        setView(presentStandings(page, accumulated.current))
        setStatus('ready')
        setError(null)
      } catch (cause) {
        if (ticket !== sequence.current) return
        setError(userFacingError(cause))
        // A failed *append* keeps the rows already on screen: the player can
        // still read what loaded, and retrying costs one page rather than all.
        if (mode === 'initial') setStatus('failed')
      } finally {
        if (ticket === sequence.current) setLoadingMore(false)
      }
    },
    [gateway],
  )

  useEffect(() => {
    void run('initial')
  }, [run])

  return {
    status,
    view,
    loadingMore,
    error,
    loadMore: useCallback(() => {
      if (cursor.current) void run('more')
    }, [run]),
    reload: useCallback(() => void run('initial'), [run]),
  }
}
