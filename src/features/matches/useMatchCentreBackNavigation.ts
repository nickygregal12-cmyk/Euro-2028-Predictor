import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { matchCentreReturnLocation } from '../../domain/tournament/matchCentreNavigation'

/**
 * Returns to the route that explicitly opened Match Centre. A refreshed or
 * directly shared Match Centre URL has no router state, so the hook falls back
 * to Home instead of depending on an unknown browser-history entry.
 */
export function useMatchCentreBackNavigation() {
  const location = useLocation()
  const navigate = useNavigate()

  return useCallback(() => {
    const returnTo = matchCentreReturnLocation(location.state)
    navigate(
      {
        pathname: returnTo.pathname,
        ...(returnTo.search === undefined ? {} : { search: returnTo.search }),
        ...(returnTo.hash === undefined ? {} : { hash: returnTo.hash }),
      },
      { replace: true },
    )
  }, [location.state, navigate])
}
