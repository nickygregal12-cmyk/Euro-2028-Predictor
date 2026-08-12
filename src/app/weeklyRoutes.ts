import { weeklyRoutePatterns, weeklyRoutes } from './shellRoutes'

export { isCompetitionModePath, weeklyRoutePatterns, weeklyRoutes } from './shellRoutes'

export type CompetitionRouteRef = {
  competitionSlug: string
  seasonSlug: string
}

export type CompetitionSection = 'overview' | 'play' | 'matches' | 'games' | 'leagues'
export type DomesticGameRoute = 'match-predictor' | 'lms' | 'championship'

function cleanSegment(value: string, name: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('/')) {
    throw new Error(`Invalid ${name} route segment: ${value}`)
  }
  return trimmed
}

function renderCompetitionPattern(
  pattern: string,
  ref: CompetitionRouteRef,
): string {
  const competition = cleanSegment(ref.competitionSlug, 'competition')
  const season = cleanSegment(ref.seasonSlug, 'season')
  return pattern
    .replace(':competitionSlug', competition)
    .replace(':seasonSlug', season)
}

export function competitionRoute(ref: CompetitionRouteRef): string {
  return renderCompetitionPattern(weeklyRoutePatterns.competition, ref)
}

export function competitionSectionRoute(
  ref: CompetitionRouteRef,
  section: CompetitionSection,
): string {
  switch (section) {
    case 'overview':
      return competitionRoute(ref)
    case 'play':
      return renderCompetitionPattern(weeklyRoutePatterns.play, ref)
    case 'matches':
      return renderCompetitionPattern(weeklyRoutePatterns.matches, ref)
    case 'games':
      return renderCompetitionPattern(weeklyRoutePatterns.games, ref)
    case 'leagues':
      return renderCompetitionPattern(weeklyRoutePatterns.leagues, ref)
    default:
      return assertNever(section)
  }
}

export function competitionMatchCentreRoute(
  ref: CompetitionRouteRef,
  fixtureId: string,
): string {
  return `${renderCompetitionPattern(weeklyRoutePatterns.matches, ref)}/${cleanSegment(
    fixtureId,
    'fixture',
  )}`
}

export function competitionPlayerRoute(
  ref: CompetitionRouteRef,
  playerId: string,
): string {
  return `${renderCompetitionPattern(weeklyRoutePatterns.competition, ref)}/players/${cleanSegment(
    playerId,
    'player',
  )}`
}

/** The competition's Matchday TV screen (`INNOV-006`). */
export function competitionTvRoute(ref: CompetitionRouteRef): string {
  return renderCompetitionPattern(weeklyRoutePatterns.tv, ref)
}

export function competitionGameRoute(
  ref: CompetitionRouteRef,
  game: DomesticGameRoute,
): string {
  switch (game) {
    case 'match-predictor':
      return renderCompetitionPattern(weeklyRoutePatterns.matchPredictor, ref)
    case 'lms':
      return renderCompetitionPattern(weeklyRoutePatterns.lms, ref)
    case 'championship':
      return renderCompetitionPattern(weeklyRoutePatterns.championship, ref)
    default:
      return assertNever(game)
  }
}

export function competitionMatchPredictorRoute(
  ref: CompetitionRouteRef,
  matchweek?: number,
): string {
  const base = competitionGameRoute(ref, 'match-predictor')
  if (matchweek === undefined) return base
  if (!Number.isInteger(matchweek) || matchweek < 1) {
    throw new Error(`Invalid matchweek for a Match Predictor route: ${matchweek}`)
  }
  return `${base}?matchweek=${matchweek}`
}

export function competitionGameStandingsRoute(ref: CompetitionRouteRef): string {
  return renderCompetitionPattern(weeklyRoutePatterns.matchPredictorStandings, ref)
}

export function competitionChampionshipInstanceRoute(
  ref: CompetitionRouteRef,
  competitionId: string,
): string {
  return `${competitionGameRoute(ref, 'championship')}/${cleanSegment(
    competitionId,
    'Championship competition',
  )}`
}

export function competitionChampionshipTableRoute(
  ref: CompetitionRouteRef,
  competitionId: string,
): string {
  return `${competitionChampionshipInstanceRoute(ref, competitionId)}/table`
}

export function competitionChampionshipFixturesRoute(
  ref: CompetitionRouteRef,
  competitionId: string,
): string {
  return `${competitionChampionshipInstanceRoute(ref, competitionId)}/fixtures`
}

export function competitionRefFromPath(pathname: string): CompetitionRouteRef | null {
  const match = pathname.match(/^\/competitions\/([^/]+)\/([^/]+)(?:\/|$)/)
  if (!match?.[1] || !match[2]) return null
  return { competitionSlug: match[1], seasonSlug: match[2] }
}

export type LogicalParent = {
  href: string
  label:
    | 'Back to Hub'
    | 'Back to Competition'
    | 'Back to Games'
    | 'Back to Match Predictor'
    | 'Back to Championships'
    | 'Back to Championship'
    | 'Back to Leagues'
    | 'Back to Matches'
    | 'Back to More'
    | 'Back to Predict'
}

export function logicalWeeklyParent(pathname: string): LogicalParent | null {
  const ref = competitionRefFromPath(pathname)
  if (ref) {
    const competition = competitionRoute(ref)
    const matches = competitionSectionRoute(ref, 'matches')
    const games = competitionSectionRoute(ref, 'games')
    const leagues = competitionSectionRoute(ref, 'leagues')
    const matchPredictor = competitionGameRoute(ref, 'match-predictor')
    const championship = competitionGameRoute(ref, 'championship')

    if (
      pathname === competitionGameStandingsRoute(ref) ||
      pathname.startsWith(`${competitionGameStandingsRoute(ref)}/`)
    ) {
      return { href: matchPredictor, label: 'Back to Match Predictor' }
    }

    if (pathname.startsWith(`${championship}/`)) {
      const suffix = pathname.slice(championship.length + 1)
      const [competitionId, child, ...rest] = suffix.split('/').filter(Boolean)
      if (competitionId && (child || rest.length > 0)) {
        return {
          href: competitionChampionshipInstanceRoute(ref, competitionId),
          label: 'Back to Championship',
        }
      }
      if (competitionId) {
        return { href: championship, label: 'Back to Championships' }
      }
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
    if (pathname === competitionTvRoute(ref)) {
      return { href: competition, label: 'Back to Competition' }
    }
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  if (
    pathname === weeklyRoutes.play ||
    pathname === weeklyRoutes.matches ||
    pathname === weeklyRoutes.leagues ||
    pathname === weeklyRoutes.competitions ||
    pathname === weeklyRoutes.more
  ) {
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  if (pathname === '/account' || pathname === '/profile' || pathname === '/more/scoring') {
    return { href: weeklyRoutes.more, label: 'Back to More' }
  }

  if (pathname === '/tournament/profile') {
    return { href: weeklyRoutes.more, label: 'Back to More' }
  }

  if (/^\/tournament\/profile\/[^/]+$/.test(pathname) || /^\/h2h\/[^/]+$/.test(pathname)) {
    return { href: weeklyRoutes.leagues, label: 'Back to Leagues' }
  }
  if (/^\/league\/[^/]+$/.test(pathname)) {
    return { href: weeklyRoutes.leagues, label: 'Back to Leagues' }
  }
  if (/^\/match\/[^/]+$/.test(pathname)) {
    return { href: weeklyRoutes.matches, label: 'Back to Matches' }
  }

  // Euro tournament journey parents. Which deployment may serve these paths is
  // decided by the site/TournamentJourney boundary, not by this pure path map.
  if (pathname.startsWith('/predict/')) {
    return { href: '/predict', label: 'Back to Predict' }
  }
  if (pathname.startsWith('/games/')) {
    return { href: '/games', label: 'Back to Games' }
  }
  if (pathname === '/predict' || pathname === '/games' || pathname === '/prediction-trends') {
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  return null
}

function assertNever(value: never): never {
  throw new Error(`Unsupported weekly route value: ${String(value)}`)
}
