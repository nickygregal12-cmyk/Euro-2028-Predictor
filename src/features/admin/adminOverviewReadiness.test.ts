import { describe, expect, it } from 'vitest'
import type { SeasonGames } from '../../services/supabase/competitionGamesModel'
import type { ProviderReviewQueues } from '../../services/supabase/providerReviewQueuesModel'
import type { SeasonReadiness } from './seasonAdminModel'
import { summariseMatchweekReadiness } from './adminOverviewReadiness'

const fixtures: SeasonReadiness = {
  matchweek: 4,
  matchweekCount: 38,
  fixtures: 10,
  withResult: 0,
  withoutKickoff: 0,
  rows: [],
}

const provider: ProviderReviewQueues = {
  competition: { id: 'season-1', name: 'Premier League', seasonKey: '2026-27' },
  limit: 20,
  queues: [
    { kind: 'result_refusal', unreviewed: 0, items: [] },
    { kind: 'status_observation', unreviewed: 0, items: [] },
    { kind: 'consumption', unreviewed: 0, items: [] },
    { kind: 'kickoff_revision', unreviewed: 0, items: [] },
    { kind: 'window_conflict', unreviewed: 0, items: [] },
  ],
  pendingCalendarProposals: 0,
  recentResultChanges: [],
  clear: true,
}

const games: SeasonGames = {
  competitionMember: false,
  serverNow: '2026-08-20T10:00:00Z',
  games: [
    {
      id: 'game-1',
      gameKey: 'main_predictor',
      active: true,
      displayName: 'Match Predictor',
      registrationOpensAt: null,
      registrationClosesAt: null,
      completedAt: null,
      allowRejoin: true,
      membership: null,
    },
  ],
}

describe('Control Room Matchweek Readiness summary', () => {
  it('reports a clear loaded summary without inventing a current matchweek', () => {
    expect(summariseMatchweekReadiness(fixtures, provider, games)).toEqual({
      state: 'healthy',
      label: 'Loaded readiness sources are clear',
      fixtures: 10,
      fixturesWithoutKickoff: 0,
      providerWork: 0,
      configuredGames: 1,
      activeGames: 1,
    })
  })

  it('treats missing kickoff data as the critical fixture-data condition', () => {
    expect(
      summariseMatchweekReadiness({ ...fixtures, withoutKickoff: 2 }, provider, games),
    ).toMatchObject({ state: 'critical', fixturesWithoutKickoff: 2 })
  })

  it('counts every provider queue plus staged calendar proposals as review work', () => {
    const withProviderWork: ProviderReviewQueues = {
      ...provider,
      queues: provider.queues.map((queue, index) =>
        index === 0 ? { ...queue, unreviewed: 3 } : queue,
      ),
      pendingCalendarProposals: 2,
      clear: false,
    }
    expect(summariseMatchweekReadiness(fixtures, withProviderWork, games)).toMatchObject({
      state: 'warning',
      providerWork: 5,
    })
  })

  it('does not count completed or inactive games as active readiness', () => {
    const inactive: SeasonGames = {
      ...games,
      games: games.games.map((game) => ({ ...game, active: false })),
    }
    expect(summariseMatchweekReadiness(fixtures, provider, inactive)).toMatchObject({
      state: 'warning',
      configuredGames: 1,
      activeGames: 0,
    })
  })
})
