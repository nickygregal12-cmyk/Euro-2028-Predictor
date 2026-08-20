import { useEffect, useState } from 'react'

/**
 * Whether this device is definitely offline.
 *
 * ONLY ONE DIRECTION OF THIS SIGNAL IS TRUSTWORTHY, and the asymmetry is the
 * whole reason this is a named hook rather than a `navigator.onLine` read at
 * the call site. `false` means the browser has no network interface it can use
 * at all, which is reliable. `true` means only that an interface exists — a
 * captive portal, a dead mobile cell or a router with no upstream all report
 * online. So this answers "definitely offline?" and nothing else, and no code
 * anywhere may read it as "the server is reachable".
 *
 * NOTHING COMPETITIVE MAY BE DECIDED FROM IT. Whether a prediction saved is the
 * server's answer, delivered by `useSeasonMatchPredictor`'s save state; whether
 * a matchweek is locked is the server's too. This exists to explain a failure a
 * player is already looking at, never to predict one and never to suppress an
 * attempt — an optimistic "you are offline, so I will not try" would turn a
 * flaky signal into a refusal the server never made.
 */
export function useOfflineStatus(): boolean {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  )

  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return offline
}
