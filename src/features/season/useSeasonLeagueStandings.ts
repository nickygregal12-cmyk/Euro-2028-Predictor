import { useCallback, useEffect, useRef, useState } from 'react'
import type { SeasonLeagueStandingsRow } from '../../services/supabase/seasonLeagueStandings'
import {
  type LeagueStandingsView,
  type SeasonLeagueStandingsGateway,
  leagueStandingsRefusal,
  presentLeagueStandings,
} from './leagueStandingsModel'

/**
 * One season private league's table, a server-ranked page at a time.
 *
 * The paging discipline is `useSeasonStandings`'s, deliberately, because it is
 * the same problem: pages ACCUMULATE rather than replace, since a table read
 * downwards is one continuous ordering; a reload starts again from page one,
 * because after a settlement run the ordering itself may have changed and
 * stitching fresh rows onto stale ones would show a table that never existed;
 * the cursor is passed back exactly as the server issued it, never
 * reconstructed from the last row; and a late response never wins, so a slow
 * first page cannot land on top of a reload that followed it.
 *
 * WHAT IS DIFFERENT HERE IS THE LEAGUE ID. The hook is mounted per league and
 * reloads from page one when it changes — a cursor issued for one league's
 * ordering means nothing in another's, so the accumulated rows and the cursor
 * are both discarded rather than carried across.
 *
 * A REFUSAL IS CLASSIFIED, NOT PASSED THROUGH. Losing league membership while
 * the table is open is an ordinary outcome with its own sentence; the generic
 * "something went wrong" would leave the member guessing.
 */

export type SeasonLeagueStandingsState = {
  status: 'loading' | 'ready' | 'failed'
  view: LeagueStandingsView | null
  /** True while a "load more" is in flight; the table stays readable. */
  loadingMore: boolean
  /** Set when the initial load failed, or when a page failed to append. */
  error: string | null
  loadMore: () => void
  reload: () => void
}

export function useSeasonLeagueStandings(
  gateway: SeasonLeagueStandingsGateway,
  leagueId: string,
): SeasonLeagueStandingsState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [view, setView] = useState<LeagueStandingsView | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accumulated = useRef<SeasonLeagueStandingsRow[]>([])
  const sequence = useRef(0)
  // Held in a ref as well as in `view` so `loadMore` never takes the cursor as
  // a dependency: a callback whose identity changed on every page would remake
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
        const page = await gateway.load(leagueId, mode === 'initial' ? null : cursor.current)
        if (ticket !== sequence.current) return

        accumulated.current = [...accumulated.current, ...page.rows]
        cursor.current = page.nextCursor
        setView(presentLeagueStandings(page, accumulated.current))
        setStatus('ready')
        setError(null)
      } catch (cause) {
        if (ticket !== sequence.current) return
        setError(leagueStandingsRefusal(cause))
        // A failed APPEND keeps the rows already on screen: the member can
        // still read what loaded, and retrying costs one page rather than all.
        if (mode === 'initial') setStatus('failed')
      } finally {
        if (ticket === sequence.current) setLoadingMore(false)
      }
    },
    [gateway, leagueId],
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
