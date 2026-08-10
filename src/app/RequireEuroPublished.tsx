import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { AuthSplash } from '../features/auth/AuthSplash'
import {
  fetchEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../services/supabase/euroPublication'

export type RequireEuroPublishedProps = {
  /** Injectable only so the route-control behaviour is directly testable. */
  readState?: () => Promise<EuroPublicationSnapshot>
}

/**
 * Refuse Euro-only player routes while Contract 143 says the tournament is
 * hidden. This is the EURO-004 control: the route itself consumes server-owned
 * publication truth rather than trusting catalogue/navigation omission.
 *
 * A failed or malformed read also refuses. Publication must fail closed.
 * Once an owner advances the lifecycle out of `hidden`, this guard permits the
 * route and the existing tournament providers decide the tournament data.
 *
 * Admin preparation is intentionally not wrapped by this component. A hidden
 * tournament still needs an authorised results workspace; hiding a player route
 * must not remove an owner's ability to prepare it for publication.
 */
export function RequireEuroPublished({
  readState = fetchEuroPublicationState,
}: RequireEuroPublishedProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    readState()
      .then((snapshot) => {
        if (active) setAllowed(snapshot.state !== 'hidden')
      })
      .catch(() => {
        if (active) setAllowed(false)
      })

    return () => {
      active = false
    }
  }, [readState])

  if (allowed === null) return <AuthSplash />
  if (!allowed) return <Navigate to="/" replace />
  return <Outlet />
}
