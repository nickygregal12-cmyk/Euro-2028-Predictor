import type { HomeIntent } from '../../vnext/home/VNextHome'
import {
  competitionGameRoute,
  competitionMatchCentreRoute,
  competitionSectionRoute,
} from '../weeklyRoutes'

export type HomeRouteContext = {
  readonly competitionSlug: string
  readonly seasonSlug: string
}

/**
 * TURN ONE HOME INTENT INTO THE ADDRESS THE APPLICATION ALREADY OWNS.
 *
 * Home never carries URLs. It says which accepted surface the player asked to
 * open; this app-layer adapter owns the route helpers. Exact Match Centre
 * navigation keeps the canonical fixture id all the way to the route.
 */
export function homeIntentRoute(context: HomeRouteContext, intent: HomeIntent): string {
  switch (intent.kind) {
    case 'open-predictor':
      return competitionGameRoute(context, 'match-predictor')
    case 'open-leagues':
      return competitionSectionRoute(context, 'leagues')
    case 'open-match':
      return competitionMatchCentreRoute(context, intent.matchId)
    default: {
      const unreachable: never = intent
      return unreachable
    }
  }
}
