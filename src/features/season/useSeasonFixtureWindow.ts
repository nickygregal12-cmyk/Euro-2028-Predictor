import { useCallback, useEffect, useRef, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import { presentFixtureList, type FixtureListView } from './fixtureListModel'
import type { SeasonFixtureList } from '../../services/supabase/seasonFixtureListModel'

/**
 * A moving window of a season's fixtures, a fortnight at a time.
 *
 * THE STEP IS A DATE RANGE, NOT A MATCHWEEK, which is the whole reason contract
 * 139 exists. Stepping by matchweek is what put a postponed November fixture
 * under a September heading; stepping by date asks the question a person
 * actually has — "what is on, around now" — and a rescheduled match turns up
 * where it is played.
 *
 * A LATE RESPONSE NEVER WINS. Stepping quickly issues overlapping reads; each
 * takes a sequence number and a superseded response is discarded, so last
 * fortnight's fixtures cannot land under next fortnight's heading.
 *
 * THE CURRENT WINDOW STAYS ON SCREEN WHILE THE NEXT LOADS. Replacing a readable
 * list with a skeleton on every tap makes a stepper feel broken on a slow
 * connection. It is cleared only when the read fails, because then it would be
 * showing one fortnight under another's dates.
 *
 * THE FIRST WINDOW IS THE SERVER'S. Asking for nothing gets the read's own
 * default — the last week and the next fortnight — so the browser holds no
 * opinion about where "now" starts, and stepping is anchored to what came back
 * rather than to the device clock.
 */

const STEP_DAYS = 14

export type SeasonFixtureWindowGateway = {
  load(window: { from?: string; to?: string }): Promise<SeasonFixtureList>
}

export type SeasonFixtureWindowState = {
  status: 'loading' | 'ready' | 'failed'
  view: FixtureListView | null
  /** The window actually loaded, for the heading. */
  window: { from: string; to: string } | null
  /** True while a step is in flight and the previous window is still shown. */
  stepping: boolean
  error: string | null
  previous: () => void
  next: () => void
  reload: () => void
}

function shift(instant: string, days: number): string {
  const at = new Date(instant)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString()
}

/**
 * `timeZone` is a deterministic override for harnesses and tests. Production
 * omits it, and the shared kickoff authority resolves the viewer's own zone —
 * the competition's persisted zone no longer decides presentation. It is
 * deliberately no longer read off `page.competition.timeZone`: that field is
 * the calendar's, and preferring it here is exactly the behaviour the 10 August
 * direction reverses.
 */
export function useSeasonFixtureWindow(
  gateway: SeasonFixtureWindowGateway,
  timeZone?: string,
): SeasonFixtureWindowState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [view, setView] = useState<FixtureListView | null>(null)
  const [window, setWindow] = useState<{ from: string; to: string } | null>(null)
  const [stepping, setStepping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sequence = useRef(0)
  // Whether anything is on screen, held in a ref rather than read from `view`:
  // reading the state would make it a dependency of `run` and re-run the effect
  // below in a loop.
  const showing = useRef(false)
  const requested = useRef<{ from?: string; to?: string }>({})

  const run = useCallback(
    async (next: { from?: string; to?: string }) => {
      const ticket = ++sequence.current
      requested.current = next
      if (showing.current) setStepping(true)
      else setStatus('loading')
      setError(null)

      try {
        const page = await gateway.load(next)
        if (ticket !== sequence.current) return
        setView(presentFixtureList(page, timeZone))
        setWindow(page.window)
        setStatus('ready')
        showing.current = true
      } catch (cause: unknown) {
        if (ticket !== sequence.current) return
        setError(userFacingError(cause, 'These fixtures could not be loaded.'))
        setStatus('failed')
        setView(null)
        showing.current = false
      } finally {
        if (ticket === sequence.current) setStepping(false)
      }
    },
    [gateway, timeZone],
  )

  useEffect(() => {
    void run({})
  }, [run])

  const step = useCallback(
    (days: number) => {
      // Anchored to the window the SERVER returned, never to a local clock, so
      // a wrong device clock cannot walk the list somewhere the season is not.
      if (!window) return
      void run({ from: shift(window.from, days), to: shift(window.to, days) })
    },
    [run, window],
  )

  return {
    status,
    view,
    window,
    stepping,
    error,
    previous: useCallback(() => step(-STEP_DAYS), [step]),
    next: useCallback(() => step(STEP_DAYS), [step]),
    reload: useCallback(() => void run(requested.current), [run]),
  }
}
