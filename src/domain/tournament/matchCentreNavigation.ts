export type MatchCentreReturnPath = {
  pathname: string
  search?: string | undefined
  hash?: string | undefined
}

export type MatchCentreLocation = {
  pathname: string
  state: {
    returnTo: MatchCentreReturnPath
  }
}

function safeMatchRef(matchRef: string): string {
  const trimmed = matchRef.trim()
  if (!trimmed) throw new Error('Match Centre navigation requires a match reference')
  return encodeURIComponent(trimmed)
}

/**
 * Builds one canonical Match Centre location while preserving an explicit
 * return destination. Callers should pass the current route rather than rely
 * exclusively on browser history, which may be absent after a refresh or a
 * shared deep link.
 */
export function matchCentreLocation(
  matchRef: string,
  returnTo: MatchCentreReturnPath,
): MatchCentreLocation {
  return {
    pathname: `/match/${safeMatchRef(matchRef)}`,
    state: {
      returnTo: {
        pathname: returnTo.pathname || '/',
        search: returnTo.search || undefined,
        hash: returnTo.hash || undefined,
      },
    },
  }
}

export function matchCentreReturnLocation(
  state: unknown,
  fallback: MatchCentreReturnPath = { pathname: '/' },
): MatchCentreReturnPath {
  if (!state || typeof state !== 'object' || !('returnTo' in state)) return fallback

  const returnTo = (state as { returnTo?: unknown }).returnTo
  if (!returnTo || typeof returnTo !== 'object' || !('pathname' in returnTo)) return fallback

  const pathname = (returnTo as { pathname?: unknown }).pathname
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return fallback

  const search = (returnTo as { search?: unknown }).search
  const hash = (returnTo as { hash?: unknown }).hash

  return {
    pathname,
    search: typeof search === 'string' && search.startsWith('?') ? search : undefined,
    hash: typeof hash === 'string' && hash.startsWith('#') ? hash : undefined,
  }
}
