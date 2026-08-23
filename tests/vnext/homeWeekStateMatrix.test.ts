import { describe, expect, it } from 'vitest'
import { buildHomeModel } from '../../src/vnext/integration/home/buildHomeModel'
import type { HomeSource } from '../../src/vnext/integration/home/homeSource'
import { presentCompetitionWeek } from '../../src/features/hub/competitionWeekModel'
import type { CompetitionWeek } from '../../src/features/hub/competitionWeekModel'
import type { CardPresentation, MatchPredictorPage } from '../../src/features/season/matchPredictorModel'
import type { LmsRoundPage } from '../../src/features/season/lmsRoundModel'
import type { ChampionshipPlayerView } from '../../src/services/supabase/seasonCupPlayer'
import type { SeasonListFixture } from '../../src/services/supabase/seasonFixtureListModel'

/**
 * THE PLAYER-STATE MATRIX FOR THE CROSS-GAME WEEK.
 *
 * `homeCrossGameWeek.test.ts` proves the seven cases the refinement was written
 * against. This file closes the states that file does not reach, so the matrix
 * is exhausted rather than sampled: a LOCKED card as distinct from a complete
 * one, a Championship with no pending fixture as distinct from one not entered,
 * a brand-new player who has joined nothing at all, and the partial read
 * failures where one game answered and another did not.
 *
 * WHY LOCKED AND COMPLETE ARE NOT THE SAME STATE. Both are `outstanding: false`
 * and neither is a task — but they are different sentences, and a surface that
 * collapsed them would tell a player who missed the deadline that their card is
 * finished. `matchPredictorAction` keeps them apart; this file holds it there.
 */

const NOW = '2027-08-21T12:00:00.000Z'
const LMS_LOCK = '2027-08-21T13:30:00.000Z'
const MP_LOCK = '2027-08-21T14:00:00.000Z'

function fixture(): SeasonListFixture {
  return {
    id: 'fx-1',
    kickoffAt: MP_LOCK,
    status: 'scheduled',
    round: { id: 'r-5', ordinal: 5, label: 'Matchweek 5' },
    schedule: { kickoffConfirmed: true, rescheduled: false, originalKickoffAt: null },
    home: { name: 'Glenmore Athletic', tokens: { monogram: 'GA', primary: '#123456' } },
    away: { name: 'Strathkelvin United', tokens: { monogram: 'SU', primary: '#654321' } },
    score: null,
    venue: null,
  } as unknown as SeasonListFixture
}

function card(entered: number, total: number, locked = false): MatchPredictorPage {
  return {
    matchweek: { number: 5, of: 38 },
    lock: { locked, lockAt: MP_LOCK },
    joker: { playedHere: false, available: false },
    fixtures: Array.from({ length: total }, (_, index) => ({
      id: `mp-${index}`,
      prediction: index < entered ? { home: 1, away: 0 } : null,
    })),
  } as unknown as MatchPredictorPage
}

function presentation(entered: number, total: number, editable = true): CardPresentation {
  return { entered, total, editable } as unknown as CardPresentation
}

function lms(over: Partial<{ entered: boolean; picked: boolean; eliminated: boolean; hasRound: boolean }> = {}): LmsRoundPage {
  const { entered = true, picked = false, eliminated = false, hasRound = true } = over
  return {
    available: true,
    entered,
    entryOutcome: eliminated ? 'eliminated' : 'alive',
    pick: picked ? { teamId: 'club-1' } : null,
    round: hasRound
      ? { windowId: 'w-5', sequence: 5, label: 'Round 5', opensAt: null, locksAt: LMS_LOCK }
      : null,
    fixtures: [],
    pickOutcome: null,
  } as unknown as LmsRoundPage
}

function cup(entered: boolean, pending: boolean): ChampionshipPlayerView {
  return {
    competitionId: 'cup-1',
    entered,
    phaseReady: true,
    visibility: null,
    availabilityStatus: null,
    phaseKind: null,
    group: null,
    members: [],
    table: [],
    fixtures: pending
      ? [
          {
            fixtureId: 'cup-fx-1',
            windowSequence: 3,
            windowLabel: 'Matchday 3',
            opensAt: null,
            locksAt: MP_LOCK,
            matchday: 3,
            isMyFixture: true,
            isHome: true,
            status: 'pending',
            home: { displayName: 'Aisha Kaur' },
            away: { displayName: 'Rowan Adeyemi' },
            homePoints: null,
            awayPoints: null,
            result: null,
          },
        ]
      : [],
  } as unknown as ChampionshipPlayerView
}

function week(input: {
  matchPredictor?: MatchPredictorPage | null
  lms?: LmsRoundPage | null
  championship?: ChampionshipPlayerView | null
}): CompetitionWeek {
  return presentCompetitionWeek({
    matchPredictor: input.matchPredictor ? { page: input.matchPredictor, href: null } : null,
    lms: input.lms ? { page: input.lms, href: null } : null,
    championship: input.championship ? { view: input.championship, href: null } : null,
    now: new Date(NOW),
  })
}

function source(over: Partial<HomeSource> = {}): HomeSource {
  return {
    generatedAt: NOW,
    user: { id: 'u-1', displayName: 'Aisha Kaur' },
    competition: {
      tournamentId: 't-1',
      name: 'Test League',
      seasonLabel: '2027/28',
      matchweek: 5,
      matchweekCount: 38,
    },
    fixtures: [fixture()],
    card: card(2, 2),
    cardPresentation: presentation(2, 2),
    week: week({ matchPredictor: card(2, 2) }),
    profile: null,
    leagues: [],
    clubForm: null,
    consensus: null,
    projection: null,
    ...over,
  } as HomeSource
}

/* ================================================================== *
 * MATCH PREDICTOR — the four states, kept apart
 * ================================================================== */

describe('the Match Predictor card', () => {
  it('is a task while it is incomplete and open', () => {
    const model = buildHomeModel(
      source({
        card: card(3, 10),
        cardPresentation: presentation(3, 10),
        week: week({ matchPredictor: card(3, 10) }),
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
  })

  it('is not a task once it is locked, even with predictions missing', () => {
    // The deadline passed with seven fixtures unpredicted. That is a state to
    // read, and offering "Predict" would be presentation overruling the lock.
    const locked = card(3, 10, true)
    const model = buildHomeModel(
      source({
        card: locked,
        cardPresentation: presentation(3, 10, false),
        week: week({ matchPredictor: locked }),
      }),
    )

    expect(model.primaryAction.type).not.toBe('predict')
    const row = model.secondaryActions.find((action) => action.game === 'match-predictor')
    expect(row?.outstanding ?? false).toBe(false)
  })

  it('says locked and complete differently', () => {
    const lockedWeek = week({ matchPredictor: card(3, 10, true) })
    const completeWeek = week({ matchPredictor: card(10, 10) })

    const lockedTitle = lockedWeek.actions[0]?.title ?? ''
    const completeTitle = completeWeek.actions[0]?.title ?? ''

    expect(lockedTitle).not.toBe(completeTitle)
    expect(lockedTitle).toMatch(/locked/i)
    expect(completeTitle).toMatch(/complete/i)
  })
})

/* ================================================================== *
 * CHAMPIONSHIP — entered without a pending fixture is not "not entered"
 * ================================================================== */

describe('the Championship', () => {
  it('says nothing when the player is not in one', () => {
    const model = buildHomeModel(
      source({ week: week({ matchPredictor: card(2, 2), championship: cup(false, false) }) }),
    )

    expect(model.secondaryActions.map((a) => a.game)).not.toContain('championship')
  })

  it('says nothing when there is no fixture pending, rather than inventing one', () => {
    // Entered, but between matchdays. A row here would be a fixture the read
    // did not report.
    const model = buildHomeModel(
      source({ week: week({ matchPredictor: card(2, 2), championship: cup(true, false) }) }),
    )

    expect(model.secondaryActions.map((a) => a.game)).not.toContain('championship')
  })

  it('reports its matchup and never asks for anything', () => {
    const model = buildHomeModel(
      source({ week: week({ matchPredictor: card(2, 2), championship: cup(true, true) }) }),
    )

    const row = model.secondaryActions.find((a) => a.game === 'championship')
    expect(row?.title).toContain('Matchday 3')
    expect(row?.outstanding).toBe(false)
  })
})

/* ================================================================== *
 * LAST MAN STANDING — entered with no round is not the same as no entry
 * ================================================================== */

describe('Last Man Standing', () => {
  it('says nothing between rounds', () => {
    const model = buildHomeModel(
      source({ week: week({ matchPredictor: card(2, 2), lms: lms({ hasRound: false }) }) }),
    )

    expect(model.secondaryActions.map((a) => a.game)).not.toContain('last-man-standing')
  })

  it('asks for a pick only while the player is alive and unpicked', () => {
    const alive = buildHomeModel(
      source({
        card: card(10, 10),
        cardPresentation: presentation(10, 10),
        week: week({ matchPredictor: card(10, 10), lms: lms() }),
      }),
    )
    expect(alive.primaryAction.type).toBe('pickClub')

    for (const state of [{ picked: true }, { eliminated: true }, { entered: false }]) {
      const model = buildHomeModel(
        source({
          card: card(10, 10),
          cardPresentation: presentation(10, 10),
          week: week({ matchPredictor: card(10, 10), lms: lms(state) }),
        }),
      )
      expect(model.primaryAction.type, JSON.stringify(state)).not.toBe('pickClub')
    }
  })
})

/* ================================================================== *
 * A BRAND-NEW PLAYER, and the partial failures
 * ================================================================== */

describe('a player who has joined nothing', () => {
  it('is offered a league rather than a task', () => {
    const model = buildHomeModel(
      source({
        card: null,
        cardPresentation: null,
        leagues: [],
        week: week({}),
      }),
    )

    expect(model.primaryAction.type).toBe('joinLeague')
    expect(model.secondaryActions).toHaveLength(0)
  })
})

describe('when one game answered and another did not', () => {
  it('keeps the game that answered', () => {
    // The Championship read rejected; its source arrives null. The Match
    // Predictor action must survive it untouched.
    const model = buildHomeModel(
      source({
        card: card(3, 10),
        cardPresentation: presentation(3, 10),
        week: week({ matchPredictor: card(3, 10), championship: null }),
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
  })

  it('keeps the side game when the card is the one that failed', () => {
    const model = buildHomeModel(
      source({
        card: null,
        cardPresentation: null,
        week: week({ matchPredictor: null, lms: lms() }),
      }),
    )

    expect(model.primaryAction.type).toBe('pickClub')
  })
})
