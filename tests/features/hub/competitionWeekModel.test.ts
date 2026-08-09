import { describe, expect, it } from 'vitest'
import { presentCompetitionWeek } from '../../../src/features/hub/competitionWeekModel'
import type { MatchPredictorPage } from '../../../src/features/season/matchPredictorModel'
import type { LmsRoundPage } from '../../../src/features/season/lmsRoundModel'
import type { ChampionshipPlayerView } from '../../../src/services/supabase/seasonCupPlayer'

const NOW = new Date('2026-08-07T10:00:00Z')

function card(overrides: {
  entered?: number
  total?: number
  locked?: boolean
  lockAt?: string | null
}): MatchPredictorPage {
  const total = overrides.total ?? 3
  const entered = overrides.entered ?? 0
  return {
    competition: { name: 'Scottish Premiership', seasonLabel: '2026/27', timeZone: 'Europe/London' },
    matchweek: { number: 2, of: 38 },
    fixtures: Array.from({ length: total }, (_, index) => ({
      fixtureId: `f${index}`,
      kickoffAt: '2026-08-08T14:00:00Z',
      home: { name: 'Rangers', shortName: 'RAN', tokens: {} },
      away: { name: 'Hibernian', shortName: 'HIB', tokens: {} },
      prediction: index < entered ? { home: 1, away: 0 } : null,
      result: null,
      points: null,
    })),
    cardStatus: 'no_submission',
    lock: {
      status: overrides.locked ? 'locked' : 'open',
      locked: overrides.locked ?? false,
      lockAt: overrides.lockAt === undefined ? '2026-08-08T13:30:00Z' : overrides.lockAt,
      reason: 'window',
    },
    joker: { playedHere: false, remainingInHalf: 2, playable: true },
    settledPoints: null,
  } as unknown as MatchPredictorPage
}

function round(overrides: Partial<LmsRoundPage> = {}): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: 'active',
    round: {
      windowId: 'w1',
      sequence: 2,
      label: 'Round 2',
      opensAt: '2026-08-05T00:00:00Z',
      locksAt: '2026-08-08T13:00:00Z',
    },
    fixtures: [],
    pick: null,
    pickOutcome: null,
    ...overrides,
  } as unknown as LmsRoundPage
}

function championship(overrides: Partial<ChampionshipPlayerView> = {}): ChampionshipPlayerView {
  return {
    competitionId: 'cup-1',
    entered: true,
    phaseReady: true,
    visibility: 'private',
    availabilityStatus: 'active',
    phaseKind: 'initial',
    group: { id: 'g1', ordinal: 1, size: 8, phaseKind: 'initial', parentGroupId: null },
    members: [],
    table: [],
    fixtures: [
      {
        fixtureId: 'cf1',
        windowSequence: 2,
        windowLabel: 'Round 2',
        opensAt: null,
        locksAt: '2026-08-08T13:30:00Z',
        matchday: 2,
        home: { userId: 'you', displayName: 'You' },
        away: { userId: 'rival', displayName: 'Sam' },
        isMyFixture: true,
        isHome: true,
        status: 'pending',
        homePoints: null,
        awayPoints: null,
        result: null,
      },
    ],
    ...overrides,
  } as ChampionshipPlayerView
}

describe('the Championship in the week', () => {
  it('reports the tie and never marks it outstanding', () => {
    // A Championship fixture is won by the Match Predictor points the player is
    // already being told to earn. Marking it outstanding would count one task
    // twice and could push the actual task behind its own consequence.
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 0, total: 3 }), href: '/mp' },
      championship: { view: championship(), href: '/cup' },
      now: NOW,
    })

    expect(week.primary?.kind).toBe('match_predictor')
    const cup = week.secondary.find((action) => action.kind === 'championship')
    expect(cup?.outstanding).toBe(false)
    expect(cup?.title).toContain('against Sam')
  })

  it('says nothing when the player is not entered', () => {
    const week = presentCompetitionWeek({
      championship: { view: championship({ entered: false }), href: '/cup' },
      now: NOW,
    })
    expect(week.empty).toBe(true)
  })

  it('says nothing once their fixture has settled', () => {
    // A settled tie is a result, and results belong on the Championship's own
    // surface rather than in a summary of the week ahead.
    const settled = championship()
    const week = presentCompetitionWeek({
      championship: {
        view: {
          ...settled,
          fixtures: settled.fixtures.map((fixture) => ({ ...fixture, status: 'settled' as const })),
        },
        href: '/cup',
      },
      now: NOW,
    })
    expect(week.empty).toBe(true)
  })
})

describe('the competition week', () => {
  it('is nothing at all when the player has joined no game here', () => {
    const week = presentCompetitionWeek({ now: NOW })
    expect(week.empty).toBe(true)
    expect(week.primary).toBeNull()
  })

  it('leads with what is outstanding and locks soonest', () => {
    // The Last Man Standing round locks at 13:00 and the card at 13:30. Urgency
    // is the deadline, not the game.
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 1, total: 3 }), href: '/mp' },
      lms: { page: round(), href: '/lms' },
      now: NOW,
    })

    expect(week.primary?.kind).toBe('last_man_standing')
    expect(week.primary?.title).toContain('pick a club')
    expect(week.secondary[0]?.title).toContain('2 of 3 still to predict')
  })

  it('puts a settled game behind an outstanding one whatever the clock says', () => {
    // The card is complete and locks later; the pick is missing and locks
    // sooner. Completed work never outranks work still to do.
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 3, total: 3 }), href: '/mp' },
      lms: { page: round(), href: '/lms' },
      now: NOW,
    })

    expect(week.primary?.kind).toBe('last_man_standing')
    expect(week.secondary.map((action) => action.outstanding)).toEqual([false])
  })

  it('reports an all-clear week rather than an empty one', () => {
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 3, total: 3 }), href: '/mp' },
      lms: { page: round({ pick: { teamId: 'celtic' } }), href: '/lms' },
      now: NOW,
    })

    expect(week.primary).toBeNull()
    expect(week.allClear).toBe(true)
    expect(week.empty).toBe(false)
    expect(week.secondary).toHaveLength(2)
  })

  it('trusts the server’s lock rather than comparing the clock', () => {
    // A locked card is not outstanding even with fixtures unpredicted, and a
    // rescheduled fixture can extend an editing window past its kickoff — only
    // the resolver knows, which is why this reads `lock.locked`.
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 0, total: 3, locked: true }), href: '/mp' },
      now: NOW,
    })

    expect(week.primary).toBeNull()
    expect(week.secondary[0]?.title).toContain('locked')
  })

  it('states elimination rather than dropping the game', () => {
    // A player who stops seeing their game entirely assumes something broke.
    const week = presentCompetitionWeek({
      lms: { page: round({ entryOutcome: 'eliminated' }), href: '/lms' },
      now: NOW,
    })

    expect(week.allClear).toBe(true)
    expect(week.secondary[0]?.title).toContain('you are out')
  })

  it('says nothing about a game the player has not entered', () => {
    const week = presentCompetitionWeek({
      lms: { page: round({ entered: false, round: null }), href: '/lms' },
      now: NOW,
    })
    expect(week.empty).toBe(true)
  })

  it('sorts an action with no deadline last among the outstanding', () => {
    // "At some point" cannot outrank "at three o'clock".
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 0, total: 3, lockAt: null }), href: '/mp' },
      lms: { page: round(), href: '/lms' },
      now: NOW,
    })

    expect(week.primary?.kind).toBe('last_man_standing')
  })

  it('keeps a joined game with no surface, without a link', () => {
    // Hiding it would misreport membership; linking it would be a dead link.
    const week = presentCompetitionWeek({
      matchPredictor: { page: card({ entered: 0, total: 3 }), href: null },
      now: NOW,
    })

    expect(week.primary?.href).toBeNull()
    expect(week.primary?.outstanding).toBe(true)
  })
})
