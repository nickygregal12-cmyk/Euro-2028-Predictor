import {
  competitionRoute,
  competitionSectionRoute,
  type CompetitionRouteRef,
} from '../../app/weeklyRoutes'
import type { SeasonShellSection } from './SeasonCompetitionShell'

/** One competition navigation map, constructed by the canonical route authority. */
export function seasonShellDestinations(
  base: string,
): Partial<Record<SeasonShellSection, string>> {
  const ref = competitionRefFromBase(base)
  return {
    overview: competitionSectionRoute(ref, 'overview'),
    play: competitionSectionRoute(ref, 'play'),
    matches: competitionSectionRoute(ref, 'matches'),
    games: competitionSectionRoute(ref, 'games'),
    leagues: competitionSectionRoute(ref, 'leagues'),
  }
}

export function seasonBasePath(competitionSlug: string, seasonSlug: string): string {
  return competitionRoute({ competitionSlug, seasonSlug })
}

function competitionRefFromBase(base: string): CompetitionRouteRef {
  const match = base.match(/^\/competitions\/([^/]+)\/([^/]+)$/)
  if (!match?.[1] || !match[2]) throw new Error(`Invalid competition base route: ${base}`)
  return { competitionSlug: match[1], seasonSlug: match[2] }
}
