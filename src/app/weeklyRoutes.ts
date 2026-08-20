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

/**
 * One fixture's own Match Centre, at an address of its own.
 *
 * SELF-CONTAINED, AND THAT IS THE POINT. It carries no date hint and needs
 * none: contract 148's `get_season_fixture` is addressed by the fixture id, so
 * the route resolves the fixture directly instead of loading a date window and
 * searching it.
 *
 * WHAT IT REPLACED. The route used to take an `?on=` day, load a three-week
 * window around it and look for the fixture in the result — which meant a
 * perfectly valid link to a match outside that window was answered "that match
 * is not in this window". That workaround existed only because no read was
 * addressed by fixture id; `MIG-UI-11` recorded the gap and contract 148 closed
 * it, so nothing generates or consumes the query any more.
 */
export function competitionMatchCentreRoute(
  ref: CompetitionRouteRef,
  fixtureId: string,
): string {
  return `${renderCompetitionPattern(weeklyRoutePatterns.matches, ref)}/${cleanSegment(
    fixtureId,
    'fixture',
  )}`
}

/**
 * One player's season inside a competition — what they scored and, after each
 * matchweek's own lock, what they predicted (contract 151).
 *
 * IT IS A COMPETITION-SCOPED ADDRESS, deliberately. A player's season is a fact
 * about them IN a competition: points, rank and prediction history are all
 * per-season, and a platform-level `/profile/:id` would have to pick one season
 * to show or invent a combined total that no authority computes.
 *
 * IT IS NOT A DIRECTORY. The address is reachable only from somewhere that
 * already names the player — a private-league table, the Match Centre — and the
 * server refuses a caller who shares no private league with them.
 */
export function competitionPlayerRoute(
  ref: CompetitionRouteRef,
  playerId: string,
): string {
  return `${renderCompetitionPattern(weeklyRoutePatterns.competition, ref)}/players/${cleanSegment(
    playerId,
    'player',
  )}`
}

/**
 * The competition's Matchday TV screen (`INNOV-006`). Read-only, and outside
 * the signed-in shell.
 */
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

/**
 * The Match Predictor, opened at a NAMED matchweek.
 *
 * A QUERY RATHER THAN A SEGMENT, deliberately. The matchweek is an opening
 * position, not an identity: `.../games/match-predictor` is one page whose
 * default is "the matchweek you can play now", and a path segment would make
 * every link that omits it a different route. A query also degrades correctly —
 * an absent, unparseable or out-of-range value falls back to the current
 * matchweek instead of 404ing, which is what a shared or stale link should do.
 *
 * WHY IT EXISTS. Until now the route always opened at the current matchweek, so
 * a player looking at a September fixture had no way to reach the card that
 * predicts it. That was reported as navigation that does not flow, and it was
 * exactly right.
 */
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

/**
 * The create-private-play corridor for this competition.
 *
 * Reached from Games and from the Leagues empty state, which is why it has an
 * address rather than being a sheet on one of them.
 */
export function competitionCreatePrivatePlayRoute(ref: CompetitionRouteRef): string {
  return renderCompetitionPattern(weeklyRoutePatterns.createPrivatePlay, ref)
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
}

/**
 * Deterministic weekly parent for routes whose parent can be derived from their
 * address alone. Browser history is deliberately irrelevant here.
 *
 * Championship instances are one level below the game index. The instance is
 * the parent of My Fixture/Table/Fixtures, while the Championship index is the
 * parent of the instance itself. That keeps a direct/reloaded URL useful and
 * avoids treating a private competition as if it were the only Championship.
 */
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
    // INNOV-006. The television screen's own Exit link goes here, and this is
    // the same answer stated once so the two cannot drift.
    if (pathname === competitionTvRoute(ref)) {
      return { href: competition, label: 'Back to Competition' }
    }
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  if (
    pathname === weeklyRoutes.play ||
    pathname === weeklyRoutes.matches ||
    pathname === weeklyRoutes.leagues ||
    // Discovery sits under the Hub: it is how a player finds a competition to
    // play, and it is reached from the Hub and from the rail.
    pathname === weeklyRoutes.competitions ||
    pathname === weeklyRoutes.more
  ) {
    return { href: weeklyRoutes.hub, label: 'Back to Hub' }
  }

  if (pathname === '/account' || pathname === '/profile' || pathname === '/more/scoring') {
    return { href: weeklyRoutes.more, label: 'Back to More' }
  }

  // The Euro tournament's own profiles. `/tournament/profile` is the player's
  // own and belongs under More beside the platform profile it sits next to;
  // another player's is reached from private play, as the head-to-head is.
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

  return null
}

function assertNever(value: never): never {
  throw new Error(`Unsupported weekly route value: ${String(value)}`)
}
