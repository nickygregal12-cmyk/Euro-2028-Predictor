import { useEffect, useRef, useState, type ReactNode } from 'react'
import { subscribeToMatchResultChanges } from '../../services/supabase/liveResults'
import { useAuth } from '../../features/auth/AuthProvider'
import { COALESCE_MS, liveUpdatesEnabled } from './liveResultsConfig'
import { LiveResultsContext } from './liveResultsContext'

// One subscription for the whole application, published as a number.
//
// Consumers depend on `resultsVersion`, never on the transport. A component
// that wants to be live adds the number to its effect dependencies and keeps
// fetching exactly the way it already did -- so the live path and the
// first-load path are the same code, and there is no second way for standings
// to arrive.
//
// WHY A PROVIDER AND NOT A HOOK PER CONSUMER. ADR 0008 rejected realtime
// fan-out, and this repository carries a 2.6M-request incident behind that
// concern. Five components each calling a subscribe hook is five sockets; a
// provider is one, whatever the tree does above it.

export function LiveResultsProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [resultsVersion, setResultsVersion] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // No channel when the flag is off, and none before there is a session:
    // `matches` is readable by authenticated users, so an anonymous subscriber
    // would be opening a socket that is entitled to nothing.
    if (!liveUpdatesEnabled || !userId) return

    const unsubscribe = subscribeToMatchResultChanges(() => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setResultsVersion((version) => version + 1)
      }, COALESCE_MS)
    })

    return () => {
      // Order matters: drop the channel first so nothing can schedule a new
      // timer while this one is being cleared.
      unsubscribe()
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [userId])

  return (
    <LiveResultsContext.Provider value={resultsVersion}>{children}</LiveResultsContext.Provider>
  )
}
