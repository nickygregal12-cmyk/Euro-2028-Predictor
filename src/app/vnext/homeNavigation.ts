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
 * TURN ONE HOME ACTION INTO THE ADDRESS THE APPLICATION ALREADY OWNS.
 *
 * Home never carries URLs. It emits what the player pressed; this app-layer
 * adapter is where competition routes already belong. `watchLive` is the one
 * action whose destination is an exact fixture, so its intent carries the
 * canonical fixture id instead of degrading the promise "Match centre" into
 * the generic Matches destination.
 */
export function homeIntentRoute(context: HomeRouteContext, intent: HomeIntent): string {
  switch (intent.actionType) {
    case 'predict':
    case 'review':
      return competitionGameRoute(context, 'match-predictor')
    case 'joinLeague':
      return competitionSectionRoute(context, 'leagues')
    case 'watchLive':
      return competitionMatchCentreRoute(context, intent.matchId)
    default: {
      const unreachable: never = intent.actionType
      return unreachable
    }
  }
}
