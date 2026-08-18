/**
 * The single import surface for vNext workshop fixtures.
 *
 * Everything below is deterministic and offline. There is no Supabase client,
 * no provider call and no `Date.now()` anywhere beneath this file, so a story,
 * a test and a screenshot all see the same matchday.
 */

export { workshopTeams, workshopTeamList } from './teams/teams'
export { workshopPeople } from './players/people'
export {
  MATCHDAY_NOW,
  WORKSHOP_COMPETITION_ID,
  againstTheCrowdMatch,
  deadlineMatch,
  featuredLiveMatch,
  halfTimeLiveMatch,
  liveMatches,
  postponedMatch,
  recentResults,
  settledMatch,
  upcomingMatches,
  workshopMatchday,
} from './matches/matchday'
export { workshopHomeModel } from './home/homeModel'
export { predictorClubs } from './predictor/clubs'
export {
  MATCHWEEK_LOCK_AT,
  PREDICTOR_NOW,
  PREDICTOR_NOW_SETTLED,
  PREDICTOR_NOW_URGENT,
  matchweekFootball,
} from './predictor/matchweek'
export {
  predictorScenarios,
  closingPredictorModel,
  completePredictorModel,
  conflictPredictorModel,
  emptyPredictorModel,
  lockedPredictorModel,
  openPredictorModel,
  reducedPredictorModel,
  settledPredictorModel,
  unavailablePredictorModel,
  untouchedPredictorModel,
} from './predictor/scenarios'
export type { PredictorScenarioName } from './predictor/scenarios'
export { rehearsePredictor } from './predictor/rehearse'
/**
 * Stage 7.5's information-architecture worlds.
 *
 * ONLY THE REGISTRY IS RE-EXPORTED. The competition catalogue and the cast are
 * inputs to the scenarios rather than things a story or a test has any business
 * reaching for — every concept renders a WORLD, never a competition list — so
 * putting them on this surface would publish four names with no callers.
 */
export { iaScenarioNames, iaScenarios } from './ia/scenarios'
export type { IaScenarioName } from './ia/scenarios'
/**
 * Stage 7.6's SELECTED shell worlds.
 *
 * The registry and its premises, and nothing else: the competition identities
 * and the game builders are inputs to the scenarios rather than things a story
 * or a test has any business reaching for. A review surface renders a WORLD.
 */
export {
  shellScenarioNames,
  shellScenarioPremises,
  shellScenarios,
} from './shell/scenarios'
export type { ShellScenarioName } from './shell/scenarios'
/**
 * Stage 8's MATCH worlds.
 *
 * Two registries and their premises, and nothing else. A review surface renders
 * a WORLD; the competitions, the stages and the state builders are inputs to
 * the scenarios rather than things a story or a test has any business reaching
 * for.
 */
export {
  matchesScenarioNames,
  matchesScenarioPremises,
  matchesScenarios,
} from './matches/scenarios'
export type { MatchesScenarioName } from './matches/scenarios'
export {
  matchCentreScenarioNames,
  matchCentreScenarioPremises,
  matchCentreScenarios,
} from './matches/matchCentreScenarios'
export type { MatchCentreScenarioName } from './matches/matchCentreScenarios'
export {
  COMPETITION_NOW,
  DECISION_NOW,
  competitionHomeModel,
  decisionHomeModel,
  homeScenarios,
  newSeasonHomeModel,
} from './home/scenarios'
export type { HomeScenarioName } from './home/scenarios'
/**
 * Stage 9's LEAGUE worlds.
 *
 * The registry and its premises, and nothing else. The people, the league lists
 * and the row builders are inputs to the scenarios rather than things a story
 * or a test has any business reaching for — a review surface renders a WORLD.
 */
export {
  leaguesScenarioNames,
  leaguesScenarioPremises,
  leaguesScenarios,
} from './leagues/scenarios'
export type { LeaguesScenarioName } from './leagues/scenarios'

/**
 * Stage 10's player-profile worlds. Same rule as the leagues group: the row and
 * side builders stay module-local, because a review surface renders a WORLD
 * rather than assembling one.
 */
export {
  playerProfileScenarioNames,
  playerProfileScenarioPremises,
  playerProfileScenarios,
} from './player/scenarios'
export type { PlayerProfileScenarioName } from './player/scenarios'
