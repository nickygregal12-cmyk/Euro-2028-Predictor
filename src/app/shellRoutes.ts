export const weeklyRoutes = {
  hub: '/',
  play: '/play',
  matches: '/matches',
  leagues: '/leagues',
  more: '/more',
} as const

/**
 * The signed-in shell needs only to know whether a route belongs to a concrete
 * competition season. Keep that tiny predicate with the five global routes so
 * the full deep-route authority can remain outside the entry chunk.
 */
export function isCompetitionModePath(pathname: string): boolean {
  return /^\/competitions\/[^/]+\/[^/]+(?:\/|$)/.test(pathname)
}
