import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveCompetitionContext,
  type CompetitionLockScopeData,
  type CompetitionMatchData,
  type CompetitionUserData,
} from '../../../src/domain/competition/context'
import {
  expectedLockScopeCount,
  isGameConfig,
  lastManStandingLockPolicy,
  mainPredictorLockPolicy,
  originalPredictorLockPolicy,
  type GameConfig,
} from '../../../src/domain/competition/game'
import type {
  LeagueSeasonCompetitionConfig,
  TournamentCompetitionConfig,
} from '../../../src/domain/competition/kinds'

/**
 * Lock policy is game-owned (ADR 0020). The competition supplies identity,
 * calendar and structure; the selected game supplies how and when its locks
 * land. The binding rules exercised here:
 *
 *   - domestic Main Predictor: first matchweek kickoff, zero-minute buffer;
 *   - Last Man Standing: first relevant kickoff, 30-minute buffer;
 *   - Euro Original Predictor: tournament opening, zero-minute buffer;
 *   - no competition-wide fallback — a missing, unknown or incompatible
 *     policy fails closed.
 */

const SEASON: LeagueSeasonCompetitionConfig = {
  id: 'premier-league-2026-27',
  name: 'Premier League 2026/27',
  kind: 'league_season',
  competitionTimeZone: 'Europe/London',
  bounds: { startsAt: '2026-08-01T00:00:00Z', endsAt: '2027-05-31T23:59:59Z' },
  primaryStage: 'league',
  progression: 'rolling_matchweeks',
  matchweeks: { count: 2 },
}

const TOURNAMENT: TournamentCompetitionConfig = {
  id: 'euro-2028',
  name: 'Euro 2028',
  kind: 'tournament',
  competitionTimeZone: 'Europe/London',
  bounds: { startsAt: '2028-06-09T00:00:00Z', endsAt: '2028-07-09T23:59:59Z' },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
}

const MAIN_PREDICTOR: GameConfig = {
  id: 'main-predictor',
  name: 'Main Predictor',
  kind: 'main_predictor',
  lockPolicy: mainPredictorLockPolicy(2),
}

const LAST_MAN_STANDING: GameConfig = {
  id: 'last-man-standing',
  name: 'Last Man Standing',
  kind: 'last_man_standing',
  lockPolicy: lastManStandingLockPolicy(2),
}

// Saturday 15:00 in the competition's own zone, expressed as the UTC instants
// the wall clock actually pins: August is BST (UTC+1), November is GMT (UTC±0).
const AUGUST_FIRST_KICKOFF = '2026-08-15T14:00:00.000Z' // 15:00 BST
const AUGUST_SECOND_KICKOFF = '2026-08-15T16:30:00.000Z'
const NOVEMBER_FIRST_KICKOFF = '2026-11-21T15:00:00.000Z' // 15:00 GMT

const USER: CompetitionUserData = {
  entry: {
    exists: true,
    complete: true,
    valid: true,
    submitted: true,
    autoSubmitted: false,
    activeLockScopeId: 'matchweek-1',
  },
  competitions: [],
  actions: {
    accountOrEntryBlockingError: false,
    hasOutstandingPrediction: false,
    activeLiveMatchIds: [],
    cupTieBreakRequired: false,
    lmsSelectionRequired: false,
    sharedKnockoutPredictionRequired: false,
    matchAwaitingAttention: false,
    leagueInviteAvailable: false,
    urgentWindowMinutes: 0,
  },
}

type ScopeSpec = {
  id: string
  type?: CompetitionLockScopeData['type']
  kickoffs: readonly (string | null)[]
  previouslyLocked?: boolean
  observedAt?: string
  validUntil?: string
}

function scopes(now: Date, specs: readonly ScopeSpec[]): CompetitionLockScopeData[] {
  return specs.map((spec) => ({
    id: spec.id,
    type: spec.type ?? 'matchweek',
    fixtureData: {
      observedAt: spec.observedAt ?? new Date(now.getTime() - 60_000).toISOString(),
      validUntil: spec.validUntil ?? new Date(now.getTime() + 12 * 3_600_000).toISOString(),
      fixtures: spec.kickoffs.map((kickoffAt, index) => ({
        id: `${spec.id}-fixture-${index + 1}`,
        kickoffAt,
      })),
    },
    previouslyLocked: spec.previouslyLocked ?? false,
  }))
}

function resolveSeason(
  game: GameConfig,
  now: string,
  specs: readonly ScopeSpec[] = [
    { id: 'matchweek-1', kickoffs: [AUGUST_FIRST_KICKOFF, AUGUST_SECOND_KICKOFF] },
    { id: 'matchweek-2', kickoffs: [NOVEMBER_FIRST_KICKOFF] },
  ],
  matches: readonly CompetitionMatchData[] = [],
) {
  return resolveCompetitionContext(
    SEASON,
    game,
    { progress: {
        hasStarted: false,
        regularStageComplete: false,
        nextStageReady: false,
        knockoutStarted: false,
        finalConfirmed: false,
        allCompetitionsSettled: false,
        markedComplete: false,
      },
      lockScopes: scopes(new Date(now), specs),
      matches,
    },
    { feedAvailable: false, matches: [] },
    USER,
    new Date(now),
  )
}

describe('Main Predictor lock: first matchweek kickoff, zero buffer', () => {
  it('is open one millisecond before the first kickoff', () => {
    const context = resolveSeason(MAIN_PREDICTOR, '2026-08-15T13:59:59.999Z')
    expect(context.lockConfigurationValid).toBe(true)
    expect(context.lockScopes['matchweek-1'].locked).toBe(false)
    expect(context.lockScopes['matchweek-1'].lockAt).toBe(AUGUST_FIRST_KICKOFF)
  })

  it('locks exactly at the first kickoff instant', () => {
    const context = resolveSeason(MAIN_PREDICTOR, AUGUST_FIRST_KICKOFF)
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
    expect(context.lockScopes['matchweek-1'].reason).toBe('scope_lock_reached')
  })

  it('stays locked after the boundary', () => {
    const context = resolveSeason(MAIN_PREDICTOR, '2026-08-15T14:00:00.001Z')
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
  })

  it('locks on the earliest kickoff in the matchweek, not any later one', () => {
    const context = resolveSeason(MAIN_PREDICTOR, '2026-08-15T15:00:00.000Z')
    // Between the 15:00 BST and 17:30 BST kickoffs: the matchweek is already
    // shut. A later fixture never reopens entry.
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
  })
})

describe('Last Man Standing lock: 30 minutes before the first relevant kickoff', () => {
  it('is open one millisecond before the buffered boundary', () => {
    const context = resolveSeason(LAST_MAN_STANDING, '2026-08-15T13:29:59.999Z')
    expect(context.lockScopes['matchweek-1'].locked).toBe(false)
    expect(context.lockScopes['matchweek-1'].lockAt).toBe('2026-08-15T13:30:00.000Z')
  })

  it('locks exactly 30 minutes before kickoff', () => {
    const context = resolveSeason(LAST_MAN_STANDING, '2026-08-15T13:30:00.000Z')
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
    expect(context.lockScopes['matchweek-1'].reason).toBe('scope_lock_reached')
  })

  it('stays locked after the buffered boundary', () => {
    const context = resolveSeason(LAST_MAN_STANDING, '2026-08-15T13:30:00.001Z')
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
  })
})

describe('one season, two concurrently different game policies', () => {
  it('keeps Main Predictor open while LMS is already shut', () => {
    // 13:45 BST on the opening Saturday: inside LMS's 30-minute buffer,
    // before Main Predictor's kickoff lock. Identical season, identical
    // fixtures — only the selected game differs.
    const at = '2026-08-15T13:45:00.000Z'
    const main = resolveSeason(MAIN_PREDICTOR, at)
    const lms = resolveSeason(LAST_MAN_STANDING, at)
    expect(main.lockScopes['matchweek-1'].locked).toBe(false)
    expect(lms.lockScopes['matchweek-1'].locked).toBe(true)
  })
})

describe('matchweek isolation', () => {
  it('locking matchweek 1 leaves matchweek 2 open', () => {
    const context = resolveSeason(MAIN_PREDICTOR, AUGUST_FIRST_KICKOFF)
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
    expect(context.lockScopes['matchweek-2'].locked).toBe(false)
    expect(context.lockScopes['matchweek-2'].lockAt).toBe(NOVEMBER_FIRST_KICKOFF)
  })

  it('a previously locked matchweek never reopens, whatever the data says', () => {
    const context = resolveSeason(MAIN_PREDICTOR, '2026-08-01T10:00:00.000Z', [
      { id: 'matchweek-1', kickoffs: [AUGUST_FIRST_KICKOFF], previouslyLocked: true },
      { id: 'matchweek-2', kickoffs: [NOVEMBER_FIRST_KICKOFF] },
    ])
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
    expect(context.lockScopes['matchweek-1'].reason).toBe('already_locked')
  })
})

describe('GMT handling', () => {
  it('locks a November matchweek at the GMT wall-clock instant', () => {
    // Same 15:00 Saturday wall clock as August, but after the October
    // clock change it pins to 15:00Z, not 14:00Z.
    const before = resolveSeason(MAIN_PREDICTOR, '2026-11-21T14:59:59.999Z')
    expect(before.lockScopes['matchweek-2'].locked).toBe(false)
    const at = resolveSeason(MAIN_PREDICTOR, NOVEMBER_FIRST_KICKOFF)
    expect(at.lockScopes['matchweek-2'].locked).toBe(true)
  })
})

describe('explicit per-fixture policy where the season supports it', () => {
  const perFixtureGame: GameConfig = {
    id: 'per-fixture-game',
    name: 'Per-fixture game',
    kind: 'last_man_standing',
    lockPolicy: { scope: 'match', scopeCount: 2, bufferMinutes: 0 },
  }

  it('locks each fixture scope on its own kickoff', () => {
    const specs: ScopeSpec[] = [
      { id: 'fixture-a', type: 'match', kickoffs: [AUGUST_FIRST_KICKOFF] },
      { id: 'fixture-b', type: 'match', kickoffs: [AUGUST_SECOND_KICKOFF] },
    ]
    const matches: CompetitionMatchData[] = [
      {
        id: 'fixture-a-fixture-1',
        lockScopeId: 'fixture-a',
        kickoffAt: AUGUST_FIRST_KICKOFF,
        administrationState: 'scheduled',
        officialState: 'unconfirmed',
        corrected: false,
      },
      {
        id: 'fixture-b-fixture-1',
        lockScopeId: 'fixture-b',
        kickoffAt: AUGUST_SECOND_KICKOFF,
        administrationState: 'scheduled',
        officialState: 'unconfirmed',
        corrected: false,
      },
    ]
    const context = resolveSeason(perFixtureGame, '2026-08-15T15:00:00.000Z', specs, matches)
    expect(context.lockConfigurationValid).toBe(true)
    // A bare match scope carries no kickoff guard, so the scope map itself
    // fails closed; the per-fixture verdict lives on the resolved match.
    const byId = new Map(context.matches.map((item) => [item.id, item]))
    expect(byId.get('fixture-a-fixture-1')?.lockState.locked).toBe(true)
    expect(byId.get('fixture-b-fixture-1')?.lockState.locked).toBe(false)
  })
})

describe('fail closed', () => {
  function expectEverythingLocked(context: ReturnType<typeof resolveSeason>) {
    expect(context.lockConfigurationValid).toBe(false)
    for (const lock of Object.values(context.lockScopes)) {
      expect(lock.locked).toBe(true)
      expect(lock.reason).toBe('missing_fixture_data')
    }
  }

  it('locks everything when no game is supplied at all', () => {
    const context = resolveSeason(undefined as unknown as GameConfig, '2026-08-01T10:00:00.000Z')
    expectEverythingLocked(context)
  })

  it('locks everything under a malformed policy', () => {
    const malformed = {
      ...MAIN_PREDICTOR,
      lockPolicy: { scope: 'matchweek', scopeCount: 2, bufferMinutes: -30 },
    } as GameConfig
    expectEverythingLocked(resolveSeason(malformed, '2026-08-01T10:00:00.000Z'))
  })

  it('locks everything under an unknown scope kind', () => {
    const unknown = {
      ...MAIN_PREDICTOR,
      lockPolicy: { scope: 'fortnight', scopeCount: 2, bufferMinutes: 0 },
    } as unknown as GameConfig
    expectEverythingLocked(resolveSeason(unknown, '2026-08-01T10:00:00.000Z'))
  })

  it('locks everything when the game declares a stale matchweek count', () => {
    const stale = { ...MAIN_PREDICTOR, lockPolicy: mainPredictorLockPolicy(3) }
    expectEverythingLocked(resolveSeason(stale, '2026-08-01T10:00:00.000Z'))
  })

  it('locks everything when an entry-scoped game is pointed at a league season', () => {
    const entryScoped: GameConfig = {
      id: 'original-predictor',
      name: 'Original Predictor',
      kind: 'original_predictor',
      lockPolicy: originalPredictorLockPolicy(),
    }
    const context = resolveSeason(entryScoped, '2026-08-01T10:00:00.000Z', [
      { id: 'matchweek-1', type: 'entry', kickoffs: [AUGUST_FIRST_KICKOFF] },
    ])
    expectEverythingLocked(context)
  })

  it('locks everything when a matchweek-scoped game is pointed at a tournament', () => {
    const now = new Date('2028-06-01T10:00:00.000Z')
    const context = resolveCompetitionContext(
      TOURNAMENT,
      MAIN_PREDICTOR,
      {
        progress: {
          hasStarted: false,
          regularStageComplete: false,
          nextStageReady: false,
          knockoutStarted: false,
          finalConfirmed: false,
          allCompetitionsSettled: false,
          markedComplete: false,
        },
        lockScopes: scopes(now, [
          { id: 'matchweek-1', kickoffs: ['2028-06-09T19:00:00.000Z'] },
          { id: 'matchweek-2', kickoffs: ['2028-06-10T19:00:00.000Z'] },
        ]),
        matches: [],
      },
      { feedAvailable: false, matches: [] },
      USER,
      now,
    )
    expect(context.lockConfigurationValid).toBe(false)
    for (const lock of Object.values(context.lockScopes)) expect(lock.locked).toBe(true)
  })

  it('locks a matchweek whose kickoff data is invalid', () => {
    const context = resolveSeason(MAIN_PREDICTOR, '2026-08-01T10:00:00.000Z', [
      { id: 'matchweek-1', kickoffs: ['not-a-kickoff'] },
      { id: 'matchweek-2', kickoffs: [NOVEMBER_FIRST_KICKOFF] },
    ])
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
    expect(context.lockScopes['matchweek-1'].reason).toBe('invalid_fixture_data')
  })

  it('locks a matchweek whose fixture snapshot has gone stale', () => {
    const now = '2026-08-01T10:00:00.000Z'
    const context = resolveSeason(MAIN_PREDICTOR, now, [
      {
        id: 'matchweek-1',
        kickoffs: [AUGUST_FIRST_KICKOFF],
        observedAt: '2026-07-31T10:00:00.000Z',
        validUntil: '2026-07-31T22:00:00.000Z',
      },
      { id: 'matchweek-2', kickoffs: [NOVEMBER_FIRST_KICKOFF] },
    ])
    expect(context.lockScopes['matchweek-1'].locked).toBe(true)
    expect(context.lockScopes['matchweek-1'].reason).toBe('stale_fixture_data')
  })
})

describe('policy compatibility table', () => {
  it('supports exactly the declared pairings and fails the rest closed', () => {
    expect(expectedLockScopeCount(TOURNAMENT, originalPredictorLockPolicy())).toBe(1)
    expect(expectedLockScopeCount(SEASON, mainPredictorLockPolicy(2))).toBe(2)
    expect(expectedLockScopeCount(SEASON, lastManStandingLockPolicy(2))).toBe(2)
    expect(expectedLockScopeCount(SEASON, { scope: 'match', scopeCount: 7, bufferMinutes: 0 })).toBe(7)
    expect(expectedLockScopeCount(SEASON, originalPredictorLockPolicy())).toBeNull()
    expect(expectedLockScopeCount(TOURNAMENT, mainPredictorLockPolicy(2))).toBeNull()
    expect(expectedLockScopeCount(TOURNAMENT, { scope: 'match', scopeCount: 7, bufferMinutes: 0 })).toBeNull()
    expect(expectedLockScopeCount(SEASON, { scope: 'round', scopeCount: 4, bufferMinutes: 0 })).toBeNull()
    expect(expectedLockScopeCount(TOURNAMENT, { scope: 'round', scopeCount: 4, bufferMinutes: 0 })).toBeNull()
  })

  it('validates game configs strictly', () => {
    expect(isGameConfig(MAIN_PREDICTOR)).toBe(true)
    expect(isGameConfig(LAST_MAN_STANDING)).toBe(true)
    expect(isGameConfig(undefined)).toBe(false)
    expect(isGameConfig({ ...MAIN_PREDICTOR, kind: 'roulette' })).toBe(false)
    expect(isGameConfig({ ...MAIN_PREDICTOR, lockPolicy: undefined })).toBe(false)
    expect(
      isGameConfig({ ...MAIN_PREDICTOR, lockPolicy: { scope: 'matchweek', scopeCount: 0, bufferMinutes: 0 } }),
    ).toBe(false)
    expect(
      isGameConfig({ ...MAIN_PREDICTOR, lockPolicy: { scope: 'matchweek', scopeCount: 2, bufferMinutes: 0.5 } }),
    ).toBe(false)
  })
})

describe('no ambient clock', () => {
  it('the game module never reads the environment clock or zone', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/domain/competition/game.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
