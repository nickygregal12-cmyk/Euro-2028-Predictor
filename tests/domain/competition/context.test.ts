import { describe, expect, it } from 'vitest'
import {
  resolveCompetitionContext,
  type CompetitionLiveMatchData,
  type CompetitionMatchData,
  type CompetitionProgressData,
  type CompetitionStatus,
  type CompetitionUserData,
} from '../../../src/domain/competition/context'
import {
  mainPredictorLockPolicy,
  originalPredictorLockPolicy,
  type GameConfig,
} from '../../../src/domain/competition/game'
import type {
  CompetitionConfig,
  LeagueSeasonCompetitionConfig,
  TournamentCompetitionConfig,
} from '../../../src/domain/competition/kinds'

const tournamentConfig: TournamentCompetitionConfig = {
  id: 'euro-2028',
  name: 'Euro 2028',
  kind: 'tournament',
  competitionTimeZone: 'UTC',
  bounds: { startsAt: '2028-06-10T00:00:00Z', endsAt: '2028-07-10T00:00:00Z' },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
}

const seasonConfig: LeagueSeasonCompetitionConfig = {
  id: 'premier-league-2027-28',
  name: 'Premier League 2027/28',
  kind: 'league_season',
  competitionTimeZone: 'UTC',
  bounds: { startsAt: '2027-08-01T00:00:00Z', endsAt: '2028-05-31T23:59:59Z' },
  primaryStage: 'league',
  progression: 'rolling_matchweeks',
  matchweeks: { count: 38 },
}

const tournamentGame: GameConfig = {
  id: 'original-predictor',
  name: 'Original Predictor',
  kind: 'original_predictor',
  lockPolicy: originalPredictorLockPolicy(),
}

const seasonGame: GameConfig = {
  id: 'main-predictor',
  name: 'Main Predictor',
  kind: 'main_predictor',
  lockPolicy: mainPredictorLockPolicy(38),
}

const FIXTURES: readonly { config: CompetitionConfig; game: GameConfig }[] = [
  { config: tournamentConfig, game: tournamentGame },
  { config: seasonConfig, game: seasonGame },
]

const DEFAULT_PROGRESS: CompetitionProgressData = {
  hasStarted: false,
  regularStageComplete: false,
  nextStageReady: false,
  knockoutStarted: false,
  finalConfirmed: false,
  allCompetitionsSettled: false,
  markedComplete: false,
}

const DEFAULT_ENTRY: CompetitionUserData['entry'] = {
  exists: true,
  complete: true,
  valid: true,
  submitted: true,
  autoSubmitted: false,
  activeLockScopeId: 'scope-1',
}

const DEFAULT_ACTIONS: CompetitionUserData['actions'] = {
  accountOrEntryBlockingError: false,
  hasOutstandingPrediction: false,
  activeLiveMatchIds: [],
  cupTieBreakRequired: false,
  lmsSelectionRequired: false,
  sharedKnockoutPredictionRequired: false,
  matchAwaitingAttention: false,
  leagueInviteAvailable: false,
  urgentWindowMinutes: 120,
}

type ContextOptions = {
  now?: string
  matches?: readonly CompetitionMatchData[]
  liveMatches?: readonly CompetitionLiveMatchData[]
  feedAvailable?: boolean
  progress?: Partial<CompetitionProgressData>
  entry?: Partial<CompetitionUserData['entry']>
  competitions?: readonly { id: string; candidateStatuses: readonly CompetitionStatus[] }[]
  actions?: Partial<CompetitionUserData['actions']>
  previouslyLockedScopeIds?: readonly string[]
}

function match(
  id: string,
  kickoffAt: string,
  overrides: Partial<CompetitionMatchData> = {},
): CompetitionMatchData {
  return {
    id,
    lockScopeId: 'scope-1',
    kickoffAt,
    administrationState: 'scheduled',
    officialState: 'unconfirmed',
    corrected: false,
    ...overrides,
  }
}

function resolveFixture(config: CompetitionConfig, game: GameConfig, options: ContextOptions = {}) {
  const now = new Date(options.now ?? '2028-06-10T09:00:00Z')
  const matches = options.matches ?? [match('match-1', '2028-06-10T18:00:00Z')]
  const previouslyLocked = new Set(options.previouslyLockedScopeIds ?? [])
  const observedAt = new Date(now.getTime() - 60 * 60_000).toISOString()
  const validUntil = new Date(now.getTime() + 12 * 60 * 60_000).toISOString()
  const lockScopes = Array.from({ length: game.lockPolicy.scopeCount }, (_, index) => {
    const id = `scope-${index + 1}`
    const assigned = matches.filter((item) => item.lockScopeId === id)
    const fixtures = assigned.length > 0
      ? assigned.map((item) => ({ id: item.id, kickoffAt: item.kickoffAt }))
      : [{ id: `${id}-fixture`, kickoffAt: new Date(now.getTime() + (index + 2) * 86_400_000).toISOString() }]
    return {
      id,
      type: game.lockPolicy.scope,
      fixtureData: { observedAt, validUntil, fixtures },
      previouslyLocked: previouslyLocked.has(id),
    }
  })

  return resolveCompetitionContext(
    config,
    game,
    {
      progress: { ...DEFAULT_PROGRESS, ...options.progress },
      lockScopes,
      matches,
    },
    {
      feedAvailable: options.feedAvailable ?? true,
      matches: options.liveMatches ?? [],
    },
    {
      entry: { ...DEFAULT_ENTRY, ...options.entry },
      competitions: options.competitions ?? [],
      actions: { ...DEFAULT_ACTIONS, ...options.actions },
    },
    now,
  )
}

for (const { config, game } of FIXTURES) {
  describe(`architecture §11 fake-clock fixtures — ${config.kind}`, () => {
    it('entries-open incomplete', () => {
      const context = resolveFixture(config, game, {
        entry: { complete: false, valid: false, submitted: false },
      })
      expect(context.entryState).toBe('incomplete')
    })

    it('entries-open submitted', () => {
      const context = resolveFixture(config, game)
      expect(context.entryState).toBe('submitted')
    })

    it('locked with opening match tomorrow', () => {
      const context = resolveFixture(config, game, {
        matches: [match('match-1', '2028-06-11T18:00:00Z')],
        previouslyLockedScopeIds: ['scope-1'],
      })
      expect(context.entryState).toBe('locked')
      expect(context.matches[0]?.state).toBe('scheduled_locked')
    })

    it('first match today not started', () => {
      const context = resolveFixture(config, game)
      expect(context.dayState).toBe('before_first_match')
      expect(context.matches[0]?.state).toBe('scheduled_editable')
    })

    it('one live match', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T18:30:00Z',
        liveMatches: [{ matchId: 'match-1', state: 'in_play', homeScore: 1, awayScore: 0, minute: 30 }],
        actions: { activeLiveMatchIds: ['match-1'] },
      })
      expect(context.dayState).toBe('matches_live')
      expect(context.liveMatches.map((item) => item.id)).toEqual(['match-1'])
      expect(context.nextUserAction).toBe('follow_live_match')
    })

    it('two simultaneous live', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T18:30:00Z',
        matches: [match('match-1', '2028-06-10T18:00:00Z'), match('match-2', '2028-06-10T18:00:00Z')],
        liveMatches: [
          { matchId: 'match-1', state: 'in_play', homeScore: 1, awayScore: 0, minute: 30 },
          { matchId: 'match-2', state: 'in_play', homeScore: 0, awayScore: 0, minute: 30 },
        ],
      })
      expect(context.liveMatches).toHaveLength(2)
      expect(context.dayState).toBe('matches_live')
    })

    it('between matches', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T14:00:00Z',
        matches: [
          match('match-1', '2028-06-10T10:00:00Z', { officialState: 'scored' }),
          match('match-2', '2028-06-10T18:00:00Z'),
        ],
      })
      expect(context.dayState).toBe('between_matches')
      expect(context.completedToday).toHaveLength(1)
      expect(context.upcomingToday).toHaveLength(1)
    })

    it('awaiting confirmation', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T12:15:00Z',
        matches: [match('match-1', '2028-06-10T10:00:00Z')],
        liveMatches: [{ matchId: 'match-1', state: 'full_time', homeScore: 2, awayScore: 1, minute: 90 }],
      })
      expect(context.dayState).toBe('awaiting_confirmation')
      expect(context.awaitingConfirmation[0]?.state).toBe('full_time_unconfirmed')
    })

    it('day complete', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T21:00:00Z',
        matches: [match('match-1', '2028-06-10T18:00:00Z', { officialState: 'scored' })],
      })
      expect(context.dayState).toBe('day_complete')
    })

    it('rest day', () => {
      const context = resolveFixture(config, game, {
        matches: [match('match-1', '2028-06-11T18:00:00Z')],
      })
      expect(context.dayState).toBe('no_matches_today')
    })

    it('stage transition', () => {
      const context = resolveFixture(config, game, {
        progress: { hasStarted: true, regularStageComplete: true, nextStageReady: false },
      })
      expect(context.competitionPhase.state).toBe('stage_transition')
      expect(context.competitionPhase.stageKind).toBe(config.primaryStage)
    })

    it('knockout window open', () => {
      const context = resolveFixture(config, game, {
        progress: { hasStarted: true, regularStageComplete: true, nextStageReady: true, knockoutStarted: true },
        competitions: [{ id: 'knockout', candidateStatuses: ['entered', 'action_required'] }],
      })
      expect(context.competitionPhase).toEqual({ state: 'knockout_stage', stageKind: 'knockout' })
      expect(context.competitions.knockout).toBe('action_required')
    })

    it('spectator post-lock', () => {
      const context = resolveFixture(config, game, {
        entry: { exists: false, complete: false, valid: false, submitted: false },
        previouslyLockedScopeIds: ['scope-1'],
      })
      expect(context.entryState).toBe('no_valid_entry')
    })

    it('Cup-eliminated user', () => {
      const context = resolveFixture(config, game, {
        competitions: [{ id: 'cup', candidateStatuses: ['entered', 'eliminated'] }],
      })
      expect(context.competitions.cup).toBe('eliminated')
    })

    it('Cup live knockout tie', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T18:30:00Z',
        competitions: [{ id: 'cup', candidateStatuses: ['entered', 'round_live'] }],
        liveMatches: [{ matchId: 'match-1', state: 'in_play', homeScore: 1, awayScore: 1, minute: 30 }],
      })
      expect(context.competitions.cup).toBe('round_live')
      expect(context.dayState).toBe('matches_live')
    })

    it('LMS action required', () => {
      const context = resolveFixture(config, game, {
        competitions: [{ id: 'lms', candidateStatuses: ['entered', 'action_required'] }],
        actions: { lmsSelectionRequired: true },
      })
      expect(context.competitions.lms).toBe('action_required')
      expect(context.nextUserAction).toBe('make_lms_selection')
    })

    it('feed unavailable', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T18:30:00Z',
        feedAvailable: false,
      })
      expect(context.matches[0]?.state).toBe('in_play_no_feed')
      expect(context.matches[0]?.overlays).toContain('feed_unavailable')
    })

    it('postponed match', () => {
      const context = resolveFixture(config, game, {
        matches: [match('match-1', '2028-06-10T18:00:00Z', { administrationState: 'postponed' })],
      })
      expect(context.matches[0]?.state).toBe('postponed')
    })

    it('corrected result', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T21:00:00Z',
        matches: [match('match-1', '2028-06-10T18:00:00Z', { officialState: 'scored', corrected: true })],
      })
      expect(context.matches[0]?.state).toBe('scored')
      expect(context.matches[0]?.overlays).toContain('corrected')
    })

    it('final complete', () => {
      const context = resolveFixture(config, game, {
        now: '2028-06-10T21:00:00Z',
        matches: [match('match-1', '2028-06-10T18:00:00Z', { officialState: 'scored' })],
        progress: {
          hasStarted: true,
          regularStageComplete: true,
          nextStageReady: true,
          knockoutStarted: true,
          finalConfirmed: true,
          allCompetitionsSettled: true,
          markedComplete: true,
        },
      })
      expect(context.competitionPhase.state).toBe('post_competition')
      expect(context.dayState).toBe('day_complete')
    })
  })
}

describe('one implementation across competition shapes', () => {
  it('resolves one tournament scope and thirty-eight season scopes through the same code path', () => {
    const tournament = resolveFixture(tournamentConfig, tournamentGame)
    const season = resolveFixture(seasonConfig, seasonGame)

    expect(tournament.lockConfigurationValid).toBe(true)
    expect(season.lockConfigurationValid).toBe(true)
    expect(Object.keys(tournament.lockScopes)).toHaveLength(1)
    expect(Object.keys(season.lockScopes)).toHaveLength(38)
    expect(tournament.matches[0]?.state).toBe('scheduled_editable')
    expect(season.matches[0]?.state).toBe('scheduled_editable')
  })
})
