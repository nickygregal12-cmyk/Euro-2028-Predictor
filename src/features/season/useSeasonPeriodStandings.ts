import { useCallback, useEffect, useRef, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  type PeriodStandingsView,
  type SeasonPeriodStandingsGateway,
  presentPeriodStandings,
} from './periodStandingsModel'

/**
 * The two derived season tables, one period at a time.
 *
 * THE CALLER'S ENTRY IS READ ONCE AND KEPT. It cannot change while the surface
 * is open — an entry is created at join and never replaced — so re-reading it
 * on every period switch would be a second round trip for an answer already
 * held. It is read alongside the first table rather than before it, so a slow
 * entry read never delays the table.
 *
 * SWITCHING PERIOD IS A LOAD, NOT A FILTER. The month and form tables are two
 * different server answers over the same scores; deriving one from the other
 * in the browser would put the retention rules in the client, which is exactly
 * where ADR 0012's authority does not live.
 *
 * A LATE RESPONSE NEVER WINS. Each load takes a sequence number, so a slow
 * month table cannot land on top of the form table the player switched to
 * afterwards.
 *
 * A FAILED READ IS A FAILURE, NEVER AN EMPTY TABLE. `get_season_period_standings`
 * raises rather than returning an empty monthly table when a settled matchweek
 * has no play window, precisely so an operator learns the calendar was never
 * derived. Rendering that as "no months yet" would throw away the one signal
 * the contract went out of its way to send.
 */

export type SeasonPeriodStandingsState = {
  status: 'loading' | 'ready' | 'failed'
  period: 'month' | 'form'
  view: PeriodStandingsView | null
  error: string | null
  setPeriod: (period: 'month' | 'form') => void
  reload: () => void
}

export function useSeasonPeriodStandings(
  gateway: SeasonPeriodStandingsGateway,
): SeasonPeriodStandingsState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [period, setPeriodState] = useState<'month' | 'form'>('form')
  const [view, setView] = useState<PeriodStandingsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sequence = useRef(0)
  const entryId = useRef<string | null>(null)
  const entryRead = useRef(false)

  const run = useCallback(
    async (next: 'month' | 'form') => {
      sequence.current += 1
      const ticket = sequence.current
      setStatus('loading')
      setError(null)

      try {
        const [standings, mine] = await Promise.all([
          gateway.load(next),
          entryRead.current ? Promise.resolve(entryId.current) : gateway.myEntryId(),
        ])
        if (ticket !== sequence.current) return

        entryId.current = mine
        entryRead.current = true
        setView(presentPeriodStandings(standings, mine))
        setStatus('ready')
      } catch (cause) {
        if (ticket !== sequence.current) return
        setError(userFacingError(cause))
        setStatus('failed')
      }
    },
    [gateway],
  )

  useEffect(() => {
    void run(period)
  }, [run, period])

  return {
    status,
    period,
    view,
    error,
    setPeriod: useCallback((next: 'month' | 'form') => setPeriodState(next), []),
    reload: useCallback(() => void run(period), [run, period]),
  }
}
