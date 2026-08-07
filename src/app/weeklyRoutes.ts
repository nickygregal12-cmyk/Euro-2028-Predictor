export type CompetitionRouteRef = {
  competitionSlug: string
  seasonSlug: string
}

export type CompetitionSection = 'overview' | 'play' | 'matches' | 'games' | 'leagues'
export type DomesticGameRoute = 'match-predictor' | 'lms' | 'championship'

export const weeklyRoutes = {
  hub: '/',
  play: '/play',
  matches: '/matches',
  leagues: '/leagues',
  more: '/more',
} as const

function cleanSegment(value: string, name: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('/')) {
    throw new Error(`Invalid ${name} route segment: ${value}`)
  }
  return trimmed
}

export function competitionRoute(ref: CompetitionRouteRef): string {
  const competition = cleanSegment(ref.competitionSlug, 'competition')
  const season = cleanSegment(ref.seasonSlug, 'season')
  return `/competitions/${competition}/${season}`
}

export function competitionSectionRoute(
  ref: CompetitionRouteRef,
  section: CompetitionSection,
): string {
  const base = competitionRoute(ref)
  switch (section) {
    case 'overview':
      return base
    case 'play':
      return `${base}/play`
    case 'matches':
      return `${base}/matches`
    case 'games':
      return `${base}/games`
    case 'leagues':
      return `${base}/leagues`
    default:
      return assertNever(section)
  }
}

export function competitionGameRoute(
  ref: CompetitionRouteRef,
  game: DomesticGameRoute,
): string {
  const games = competitionSectionRoute(ref, 'games')
  switch (game) {
    case 'match-predictor':
      return `${games}/match-predictor`
    case 'lms':
      return `${games}/lms`
    case 'championship':
      return `${games}/championship`
    default:
      return assertNever(game)
  }
}

export function competitionGameStandingsRoute(ref: CompetitionRouteRef): string {
  return `${competitionGameRoute(ref, 'match-predictor')}/standings`
}

export function competitionRefFromPath(pathname: string): CompetitionRouteRef | null {
  const match = pathname.match(/^\/competitions\/([^/]+)\/([^/]+)(?:\/|$)/)
  if (!match?.[1] || !match[2]) return null
  return { competitionSlug: match[1], seasonSlug: match[2] }
}

/** Preserve the current competition-local suffix while replacing its season. */
export function switchCompetitionPath(
  pathname: string,
  target: CompetitionRouteRef,
): string {
  if (!competitionRefFromPath(pathname)) {
    throw new Error(`Cannot switch competition outside competition mode: ${pathname}`)
  }
  return pathname.replace(/^\/competitions\/[^/]+\/[^/]+/, competitionRoute(target))
}

export function isCompetitionModePath(pathname: string): boolean {
  return competitionRefFromPath(pathname) !== null
}

export type LogicalParent = {
  href: string
  label:
    | 'Back to Hub'
    | 'Back to Competition'
    | 'Back to Games'
    | 'Back to Match Predictor'
    | 'Back to Leagues'
    | 'Back to Matches'
    | 'Back to More'
}

/**
 * Deterministic weekly parent for routes whose parent can be derived from their
 * address alone. Browser history is deliberately irrelevant here.
 *
 * The deeper canonical route families are included before they ship so a direct
 * not-found URL still has the same useful fallback the eventual page will own.
 */
export function logicalWeeklyParent(pathname: string): LogicalParent | null {
  const ref = competitionRefFromPath(pathname)
  if (ref) {
    const competition = competitionRoute(ref)
    const matches = competitionSectionRoute(ref, 'matches')
    const games = competitionSectionRoute(ref, 'games')
    const leagues = competitionSectionRoute(ref, 'leagues')
    const matchPredictor = competitionGameRoute(ref, 'match-predictor')

    if (
      pathname === competitionGameStandingsRoute(ref) ||
      pathname.startsWith(`${competitionGameStandingsRoute(ref)}/`)
    ) {
      return { href: matchPredictor, label: 'Back to Match Predictor' }
    }
    if (pathname.startsWith(`${games}/`)) {
      return { href: games, label: 'Back to Games' }
    }
    if (pathname.startsWith(`${matches}/`)) {
      return { href: matches, label: 'Back to Matches' }
    }
    if (pathname.startsWith(`${leagues}/`)) {
      return { href: leagues, label: 'Back to Leagues' }
    }
    if (pathname.startsWith(`${competition}/players/`)) {
      return { href: competition, label: 'Back to Competition' }
    }
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  if (
    pathname === weeklyRoutes.play ||
    pathname === weeklyRoutes.matches ||
    pathname === weeklyRoutes.leagues ||
    pathname === weeklyRoutes.more
  ) {
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  if (pathname === '/account' || pathname === '/profile' || pathname === '/more/scoring') {
    return { href: weeklyRoutes.more, label: 'Back to More' }
  }

  if (/^\/profile\/[^/]+$/.test(pathname) || /^\/h2h\/[^/]+$/.test(pathname)) {
    return { href: weeklyRoutes.leagues, label: 'Back to Leagues' }
  }
  if (/^\/league\/[^/]+$/.test(pathname)) {
    return { href: weeklyRoutes.leagues, label: 'Back to Leagues' }
  }
  if (/^\/match\/[^/]+$/.test(pathname)) {
    return { href: weeklyRoutes.matches, label: 'Back to Matches' }
  }

  return null
}

function assertNever(value: never): never {
  throw new Error(`Unsupported weekly route value: ${String(value)}`)
}
