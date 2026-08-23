import type { SeasonGames } from '../../services/supabase/competitionGamesModel'
import type { ProviderReviewQueues } from '../../services/supabase/providerReviewQueuesModel'
import type { SeasonReadiness } from './seasonAdminModel'

type MatchweekReadinessSummary = {
  readonly state: 'healthy' | 'warning' | 'critical'
  readonly label: string
  readonly fixtures: number
  readonly fixturesWithoutKickoff: number
  readonly providerWork: number
  readonly configuredGames: number
  readonly activeGames: number
}

/**
 * A PRESENTATION SUMMARY OVER THREE SERVER-OWNED READS, not a fourth readiness
 * authority. The selected season and matchweek are explicit inputs from the
 * operator; this function never guesses which round is current and never
 * predicts whether a protected write would be accepted.
 *
 * The summary can therefore say only what the three reads establish:
 *   - a fixture card exists and every fixture has a kickoff;
 *   - provider ingestion has nothing waiting for human review/decision;
 *   - at least one configured game is active and unfinished.
 *
 * Missing kickoffs are critical because the existing season-opening authority
 * cannot derive a round window without them. Provider work or no active game is
 * a warning: both need an operator to inspect their owning workspace, but this
 * client does not invent the action that resolves them.
 */
export function summariseMatchweekReadiness(
  fixtures: SeasonReadiness,
  provider: ProviderReviewQueues,
  games: SeasonGames,
): MatchweekReadinessSummary {
  const providerWork =
    provider.pendingCalendarProposals +
    provider.queues.reduce((total, queue) => total + queue.unreviewed, 0)
  const activeGames = games.games.filter(
    (game) => game.active && game.completedAt === null,
  ).length

  const critical = fixtures.fixtures === 0 || fixtures.withoutKickoff > 0
  const warning = providerWork > 0 || activeGames === 0

  return {
    state: critical ? 'critical' : warning ? 'warning' : 'healthy',
    label: critical
      ? 'Fixture data needs attention'
      : warning
        ? 'Operator review needed'
        : 'Loaded readiness sources are clear',
    fixtures: fixtures.fixtures,
    fixturesWithoutKickoff: fixtures.withoutKickoff,
    providerWork,
    configuredGames: games.games.length,
    activeGames,
  }
}
