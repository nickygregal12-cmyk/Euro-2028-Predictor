import { useCallback, useEffect, useRef, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  type MatchesView,
  type SeasonMatchesGateway,
  presentMatches,
} from './matchesModel'

/**
 * One matchweek of fixtures at a time, with a stepper.
 *
 * THE MATCHWEEK IS THIS HOOK'S STATE, and the server's answer is what bounds
 * it. `matchweekCount` comes from the read rather than from the route, so
 * stepping cannot walk off the end of a season the browser guessed the length
 * of — and the first load is the only thing that establishes where the bounds
 * are, which is why `hasPrevious`/`hasNext` are computed from the loaded page
 * rather than from the requested number.
 *
 * A LATE RESPONSE NEVER WINS. Stepping quickly through matchweeks issues
 * overlapping reads; each takes a sequence number and a superseded response is
 * discarded, so matchweek 4's fixtures cannot land under matchweek 6's heading.
 *
 * THE PREVIOUS MATCHWEEK STAYS ON SCREEN WHILE THE NEXT LOADS. Replacing a
 * readable fixture list with a skeleton on every tap makes a stepper feel
 * broken on a slow connection; the view is only cleared when the read fails,
 * because then it would be showing one matchweek under another's number.
 */

export type SeasonMatchesState = {
  status: 'loading' | 'ready' | 'failed'
  view: MatchesView | null
  /** True while a step is in flight and a previous matchweek is still shown. */
  stepping: boolean
  error: string | null
  goTo: (matchweek: number) => void
  previous: () => void
  next: () => void
  reload: () => void
}

export function useSeasonMatches(
  gateway: SeasonMatchesGateway,
  timeZone: string,
  openAt: number,
): SeasonMatchesState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [view, setView] = useState<MatchesView | null>(null)
  const [stepping, setStepping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sequence = useRef(0)
  const shown = useRef(openAt)
  // Whether anything is on screen, held in a ref rather than read from `view`.
  // Reading the state would make it a dependency of `run`, which would rebuild
  // the callback on every load and re-run the effect below in a loop.
  const showing = useRef(false)
  const bound = useRef<number | null>(null)

  const run = useCallback(
    async (matchweek: number) => {
      sequence.current += 1
      const ticket = sequence.current
      shown.current = matchweek
      setError(null)
      // A first load has nothing to keep on screen; a step does.
      if (showing.current) setStepping(true)
      else setStatus('loading')

      try {
        const page = await gateway.load(matchweek)
        if (ticket !== sequence.current) return
        setView(presentMatches(page, timeZone))
        bound.current = page.matchweekCount
        showing.current = true
        setStatus('ready')
      } catch (cause) {
        if (ticket !== sequence.current) return
        setError(userFacingError(cause))
        setStatus('failed')
        // Cleared deliberately: a failed step must not leave one matchweek's
        // fixtures sitting under another matchweek's number.
        setView(null)
        showing.current = false
      } finally {
        if (ticket === sequence.current) setStepping(false)
      }
    },
    [gateway, timeZone],
  )

  useEffect(() => {
    void run(openAt)
  }, [run, openAt])

  const goTo = useCallback(
    (matchweek: number) => {
      // Bounded by the server's own count, established by the first load.
      if (matchweek < 1) return
      if (bound.current !== null && matchweek > bound.current) return
      void run(matchweek)
    },
    [run],
  )

  return {
    status,
    view,
    stepping,
    error,
    goTo,
    previous: useCallback(() => goTo(shown.current - 1), [goTo]),
    next: useCallback(() => goTo(shown.current + 1), [goTo]),
    reload: useCallback(() => void run(shown.current), [run]),
  }
}
