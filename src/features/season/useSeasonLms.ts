import { useCallback, useEffect, useRef, useState } from 'react'
import { isVersionConflict } from '../../services/supabase/writeConflict'
import { userFacingError } from '../../shared/errors/userFacingError'
import { lmsRefusal } from './lmsRefusal'
import {
  type LmsRoundPage,
  type LmsRoundPresentation,
  type SeasonLmsGateway,
  presentLmsRound,
} from './lmsRoundModel'

/**
 * The season Last Man Standing round: load it, pick in it, live with refusals.
 *
 * A PICK IS NOT OPTIMISTIC, and this is the one place this surface deliberately
 * differs from the Match Predictor card next door. A scoreline is the player's
 * own guess and applying it immediately costs nothing if the save is retried;
 * a Last Man Standing pick consumes a club for the rest of the cycle and can
 * eliminate them. Showing a pick as taken before the server has accepted it
 * would show a player a commitment they may not have made — so the pick lands
 * only when the write returns, and the button says it is saving in the meantime.
 *
 * A VERSION CONFLICT IS TERMINAL, as everywhere else: the row was changed
 * elsewhere, this page is knowingly stale, and guessing which side wins is
 * exactly what a conflict means we cannot do. Recovery is a reload.
 *
 * A SERVER REFUSAL KEEPS ITS MEANING. The write refuses a reused club, a
 * locked round, an eliminated entrant and a non-entrant, and each wants a
 * different thing from the player. `userFacingError` alone would flatten all
 * four into "Something went wrong. Please try again." — advice that is simply
 * wrong for a pick that will be refused every time — so `lmsRefusal`
 * classifies by error CODE and supplies copy of our own. No server message
 * string reaches the player. The presentation model refuses the same cases
 * locally so the page reads honestly before a click; when the two disagree the
 * server wins, because a disagreement means this page was out of date.
 */

export type SeasonLmsState = {
  status: 'loading' | 'ready' | 'failed'
  page: LmsRoundPage | null
  presentation: LmsRoundPresentation | null
  /** Set while a pick is in flight, so the surface can disable the choices. */
  picking: string | null
  /** The server's refusal, or a load failure. */
  error: string | null
  conflict: boolean
  pick: (teamId: string) => void
  reload: () => void
}

export function useSeasonLms(
  gateway: SeasonLmsGateway,
  now: () => Date,
): SeasonLmsState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [page, setPage] = useState<LmsRoundPage | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const sequence = useRef(0)

  const load = useCallback(async () => {
    sequence.current += 1
    const ticket = sequence.current
    setStatus('loading')
    setError(null)
    setConflict(false)
    try {
      const next = await gateway.load()
      if (ticket !== sequence.current) return
      setPage(next)
      setStatus('ready')
    } catch (cause) {
      if (ticket !== sequence.current) return
      setError(userFacingError(cause))
      setStatus('failed')
    }
  }, [gateway])

  useEffect(() => {
    void load()
  }, [load])

  const pick = useCallback(
    (teamId: string) => {
      setPicking(teamId)
      setError(null)
      void (async () => {
        try {
          await gateway.pick(teamId)
          // Reload rather than patching the page locally: the write may have
          // consumed a club, changed the used list and moved the entry outcome,
          // and re-deriving those in the browser would be a second copy of
          // rules the server already applied.
          await load()
        } catch (cause) {
          if (isVersionConflict(cause)) {
            setConflict(true)
            setError('This round changed elsewhere. Reload to see where you stand.')
          } else {
            setError(lmsRefusal(cause))
          }
        } finally {
          setPicking(null)
        }
      })()
    },
    [gateway, load],
  )

  return {
    status,
    page,
    presentation: page ? presentLmsRound(page, now()) : null,
    picking,
    error,
    conflict,
    pick,
    reload: () => void load(),
  }
}
