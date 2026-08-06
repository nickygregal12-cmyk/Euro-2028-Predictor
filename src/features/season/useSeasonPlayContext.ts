import { useEffect, useState } from 'react'
import {
  presentSeasonPlay,
  type SeasonPlayContext,
  type SeasonPlayContextGateway,
  type SeasonPlayState,
} from './seasonPlayContextModel'

/**
 * Resolves the season a URL names, once per address.
 *
 * The load is guarded against arriving after the address changed. Without that,
 * navigating from one season to another while the first read is in flight can
 * settle the first response into the second season's state — and because every
 * subsequent read takes the season id from here, the player would then be
 * writing predictions into the competition they navigated away from. That is
 * the one failure this hook exists to make impossible, so the guard is here
 * rather than left to the caller.
 */
export function useSeasonPlayContext(
  gateway: SeasonPlayContextGateway,
  competitionSlug: string | undefined,
  seasonKey: string | undefined,
): SeasonPlayState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [context, setContext] = useState<SeasonPlayContext | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!competitionSlug || !seasonKey) {
      // React Router only mounts this with both parameters present, so this is
      // a type narrowing rather than a state the router can produce. It refuses
      // rather than calling the RPC with a null it would raise on anyway.
      setStatus('failed')
      setContext(null)
      setError(new Error('That competition season does not exist'))
      return
    }

    let cancelled = false
    setStatus('loading')
    setContext(null)
    setError(null)

    gateway
      .load(competitionSlug, seasonKey)
      .then((loaded) => {
        if (cancelled) return
        setContext(loaded)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause)
        setStatus('failed')
      })

    return () => {
      cancelled = true
    }
  }, [gateway, competitionSlug, seasonKey])

  return presentSeasonPlay({ status, context, error })
}
