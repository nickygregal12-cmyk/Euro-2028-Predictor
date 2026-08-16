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
