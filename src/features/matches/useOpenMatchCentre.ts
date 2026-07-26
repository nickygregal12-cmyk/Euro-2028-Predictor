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
      navigate(
        matchCentreLocation(matchRef, {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        }),
      )
    },
    [location.hash, location.pathname, location.search, navigate],
  )
}
