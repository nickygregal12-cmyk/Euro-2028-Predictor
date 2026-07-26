import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { matchCentreLocation } from '../../domain/tournament/matchCentreNavigation'

/**
 * Opens Match Centre with an explicit return destination derived from the
 * current route. Entry-point components do not need to construct router state
 * or duplicate route strings.
 */
export function useOpenMatchCentre() {
  const location = useLocation()
  const navigate = useNavigate()

  return useCallback(
    (matchRef: string) => {
      const destination = matchCentreLocation(matchRef, {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })

      // React Router accepts navigation state through NavigateOptions rather
      // than as part of the `To` object. Keeping that boundary explicit ensures
      // the Match Centre back action can restore the originating route.
      navigate(destination.pathname, { state: destination.state })
    },
    [location.hash, location.pathname, location.search, navigate],
  )
}
