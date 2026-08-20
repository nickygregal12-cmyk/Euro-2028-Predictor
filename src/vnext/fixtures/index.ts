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

/**
 * Stage 11's Last Man Standing worlds. Same rule as the other groups: the
 * option and fixture builders stay module-local, because a review surface
 * renders a WORLD rather than assembling one.
 */
export { lmsScenarioNames, lmsScenarioPremises, lmsScenarios } from './lms/scenarios'
export type { LmsScenarioName } from './lms/scenarios'

/**
 * Stage 12's Predictor Championship worlds. Same rule again: the seat and side
 * builders stay module-local, because a review surface renders a WORLD rather
 * than assembling one.
 */
export {
  championshipScenarioNames,
  championshipScenarioPremises,
  championshipScenarios,
} from './championship/scenarios'
export type { ChampionshipScenarioName } from './championship/scenarios'

/**
 * Stage 13's Account worlds. Same rule again — and one addition worth naming:
 * the binding world here is `unnameableFollow`, a follow no read this page
 * makes can put a name to. A fixture that quietly gave it a name would hide the
 * one state the surface exists to handle honestly.
 */
export {
  accountScenarioNames,
  accountScenarioPremises,
  accountScenarios,
} from './account/scenarios'
export type { AccountScenarioName } from './account/scenarios'

/**
 * Stage 13's Games hub worlds. The binding world here is `leftAndUncertain`: a
 * player who left the one game whose catalogue row refuses a rejoin once the
 * competition is running. A fixture that resolved that into a yes or a no would
 * be asserting a fact `competition_is_running` withholds from every browser.
 */
export {
  gamesScenarioNames,
  gamesScenarioPremises,
  gamesScenarios,
} from './games/scenarios'
export type { GamesScenarioName } from './games/scenarios'

/**
 * Stage 13's Discovery worlds. The binding world is `followUnknown`: the
 * preferences read failed, so the page draws no follow control at all. A
 * fixture that resolved that into a yes or a no would hide the state this
 * surface is careful about — following is an upsert, and a follow re-sent for a
 * competition already followed clears the player's favourite club.
 */
export {
  discoveryScenarioNames,
  discoveryScenarioPremises,
  discoveryScenarios,
} from './discovery/scenarios'
export type { DiscoveryScenarioName } from './discovery/scenarios'

/**
 * Stage 13's Invite worlds. Every refusal the server can make has a world,
 * because the binding property of that surface is that it never offers a button
 * the database would refuse — and a fixture set holding only the happy path
 * would let that be reviewed as "there is a Join button, good".
 */
export {
  inviteScenarioNames,
  inviteScenarioPremises,
  inviteScenarios,
} from './invite/scenarios'
export type { InviteScenarioName } from './invite/scenarios'

/**
 * Stage 13's onboarding worlds. The binding world is `games`: it holds a game
 * the player has ALREADY JOINED beside one they can choose, because those two
 * must never look alike — an unticked box would invite a player to choose what
 * they already have, and a ticked one would make Finish look like it were about
 * to join them twice.
 */
export {
  onboardingScenarioNames,
  onboardingScenarioPremises,
  onboardingScenarios,
} from './onboarding/scenarios'
export type { OnboardingScenarioName } from './onboarding/scenarios'

/* ---- Season Wrapped (contract 156) -------------------------------------- */

export {
  wrappedScenarioNames,
  wrappedScenarioPremises,
  wrappedScenarios,
} from './wrapped/scenarios'
export type { WrappedScenarioName } from './wrapped/scenarios'
