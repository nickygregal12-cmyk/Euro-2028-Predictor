import type { MatchCentreIntent } from '../../vnext/matches/VNextMatchCentre'
import {
  competitionGameRoute,
  competitionSectionRoute,
  type CompetitionSeasonRef,
} from '../weeklyRoutes'

/**
 * Turn the Match Centre's presentation intent into an application address.
 *
 * The vNext surface deliberately knows no routes. It only says which related
 * destination the player chose; the app adapter owns the URL. Keeping the
 * mapping here also means every visible related control has one deterministic
 * answer rather than each host growing its own switch.
 */
export function matchCentreIntentRoute(
  context: CompetitionSeasonRef,
  intent: MatchCentreIntent,
): string | null {
  if (intent.kind !== 'link') return null

  switch (intent.link) {
    case 'match-predictor':
      return competitionGameRoute(context, 'match-predictor')
    case 'competition-matches':
      return competitionSectionRoute(context, 'matches')
  }
}
