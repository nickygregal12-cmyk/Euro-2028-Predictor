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
export type { RehearsalCommand } from './predictor/rehearse'
export {
  COMPETITION_NOW,
  DECISION_NOW,
  competitionHomeModel,
  decisionHomeModel,
  homeScenarios,
  newSeasonHomeModel,
} from './home/scenarios'
export type { HomeScenarioName } from './home/scenarios'
