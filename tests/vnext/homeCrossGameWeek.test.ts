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
 * HOME CARRIES THE WHOLE WEEK, NOT ONE GAME OF IT.
 *
 * `DFA-010` asks Home for "one primary urgent/next action, at most two compact
 * secondary actions". `DFA-006` records that the surface Home replaced already
 * answered that across all three games from `competitionWeekModel`. The vNext
 * Home shipped asking that model about the Match Predictor alone, so a Last Man
 * Standing pick — which recurs every matchweek and ordinarily locks THIRTY
 * MINUTES BEFORE the Match Predictor (ADR 0013's ADR 0020 amendment) — could
 * not reach the front door at all.
 *
 * THE ORDERING AUTHORITY IS NOT HERE AND MUST NEVER BE. Every case below
 * arranges real game reads, hands them to `presentCompetitionWeek`, and asserts
 * on what Home did with ITS answer. Nothing in this file — and nothing in the
 * mapper it tests — decides which game is more urgent. If a case wants LMS
 * first, it gives LMS the earlier lock and lets the one sorter say so.
 */

const NOW = '2027-08-21T12:00:00.000Z'
const LMS_LOCK = '2027-08-21T13:30:00.000Z'
const MP_LOCK = '2027-08-21T14:00:00.000Z'

/* ------------------------------------------------------------------ *
 * Game reads, shaped as their own authorities shape them.
 * ------------------------------------------------------------------ */

function club(name: string, monogram: string) {
  return { name, tokens: { monogram, primary: '#123456' } }
}

function fixture(overrides: Partial<SeasonListFixture> = {}): SeasonListFixture {
  return {
    id: 'fx-1',
    kickoffAt: '2027-08-21T14:00:00.000Z',
    status: 'scheduled',
    round: { id: 'r-5', ordinal: 5, label: 'Matchweek 5' },
    schedule: { kickoffConfirmed: true, rescheduled: false, originalKickoffAt: null },
    home: club('Glenmore Athletic', 'GA'),
    away: club('Strathkelvin United', 'SU'),
    score: null,
    venue: null,
    ...overrides,
  } as SeasonListFixture
}

/** A Match Predictor card with `entered` of `total` predictions in. */
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

function lmsRound(
  overrides: Partial<{
    entered: boolean
    picked: boolean
    eliminated: boolean
    hasRound: boolean
  }> = {},
): LmsRoundPage {
  const {
    entered = true,
    picked = false,
    eliminated = false,
    hasRound = true,
  } = overrides
  return {
    available: true,
    entered,
    entryOutcome: eliminated ? 'eliminated' : 'alive',
    pick: picked ? { teamId: 'club-1' } : null,
    round: hasRound
      ? {
          windowId: 'w-5',
          sequence: 5,
          label: 'Round 5',
          opensAt: null,
          locksAt: LMS_LOCK,
        }
      : null,
    fixtures: [],
    pickOutcome: null,
  } as unknown as LmsRoundPage
}

function championship(entered = true, pending = true): ChampionshipPlayerView {
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

/* ------------------------------------------------------------------ *
 * The source, with the week supplied by the one authority.
 * ------------------------------------------------------------------ */

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

function source(overrides: Partial<HomeSource> = {}): HomeSource {
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
    ...overrides,
  } as HomeSource
}

/* ================================================================== *
 * CASE A — LMS outstanding and locking first outranks the Predictor
 * ================================================================== */

describe('A — an LMS pick that locks before the Match Predictor', () => {
  it('becomes Home’s primary action', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({ matchPredictor: card(0, 10), lms: lmsRound() }),
      }),
    )

    expect(model.primaryAction.type).toBe('pickClub')
    expect(model.primaryAction.deadline).toBe(LMS_LOCK)
  })

  it('leaves the Match Predictor as a secondary action rather than dropping it', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({ matchPredictor: card(0, 10), lms: lmsRound() }),
      }),
    )

    expect(model.secondaryActions.map((action) => action.game)).toContain('match-predictor')
  })
})

/* ================================================================== *
 * CASE B — the Predictor wins when LMS has nothing to ask
 * ================================================================== */

describe('B — the Match Predictor is incomplete and the LMS pick is already in', () => {
  it('keeps Predict as the primary action', () => {
    const model = buildHomeModel(
      source({
        card: card(3, 10),
        cardPresentation: presentation(3, 10),
        week: week({ matchPredictor: card(3, 10), lms: lmsRound({ picked: true }) }),
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
  })
})

/* ================================================================== *
 * CASE C — Home does not invent a priority
 * ================================================================== */

describe('C — both outstanding', () => {
  it('takes the existing week ordering rather than preferring a game', () => {
    const built = week({ matchPredictor: card(0, 10), lms: lmsRound() })
    const model = buildHomeModel(
      source({ card: card(0, 10), cardPresentation: presentation(0, 10), week: built }),
    )

    // Whatever the one sorter put first is what Home leads with. No second
    // opinion about urgency exists in the mapper.
    expect(built.primary).not.toBeNull()
    expect(model.primaryAction.deadline).toBe(built.primary?.locksAt ?? null)
  })

  it('reverses when the Predictor is the one locking first', () => {
    const early = {
      ...lmsRound(),
      round: {
        windowId: 'w-5',
        sequence: 5,
        label: 'Round 5',
        opensAt: null,
        locksAt: '2027-08-21T18:00:00.000Z',
      },
    } as unknown as LmsRoundPage
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({ matchPredictor: card(0, 10), lms: early }),
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
  })
})

/* ================================================================== *
 * CASE D — the Championship reports, and never asks
 * ================================================================== */

describe('D — an active Championship matchup', () => {
  it('never becomes the primary action', () => {
    const model = buildHomeModel(
      source({
        card: card(2, 2),
        cardPresentation: presentation(2, 2),
        week: week({ matchPredictor: card(2, 2), championship: championship() }),
      }),
    )

    expect(model.primaryAction.type).not.toBe('pickClub')
    expect(model.secondaryActions.every((action) => action.game !== 'championship' || !action.outstanding)).toBe(true)
  })

  it('does not displace a real task', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({ matchPredictor: card(0, 10), championship: championship() }),
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
  })

  it('is still worth saying, as context', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({ matchPredictor: card(0, 10), championship: championship() }),
      }),
    )

    expect(model.secondaryActions.map((action) => action.game)).toContain('championship')
  })
})

/* ================================================================== *
 * CASE E — eliminated is a state, not a task
 * ================================================================== */

describe('E — the player is out of Last Man Standing', () => {
  it('never offers a pick', () => {
    const model = buildHomeModel(
      source({
        card: card(2, 2),
        cardPresentation: presentation(2, 2),
        week: week({ matchPredictor: card(2, 2), lms: lmsRound({ eliminated: true }) }),
      }),
    )

    expect(model.primaryAction.type).not.toBe('pickClub')
    const lms = model.secondaryActions.find((action) => action.game === 'last-man-standing')
    expect(lms?.outstanding ?? false).toBe(false)
  })

  it('still says so rather than hiding the game', () => {
    const model = buildHomeModel(
      source({
        card: card(2, 2),
        cardPresentation: presentation(2, 2),
        week: week({ matchPredictor: card(2, 2), lms: lmsRound({ eliminated: true }) }),
      }),
    )

    expect(model.secondaryActions.map((action) => action.game)).toContain('last-man-standing')
  })
})

/* ================================================================== *
 * CASE F — a quiet day stays quiet
 * ================================================================== */

describe('F — everything is clear', () => {
  it('adds no artificial task', () => {
    const model = buildHomeModel(
      source({
        card: card(2, 2),
        cardPresentation: presentation(2, 2),
        leagues: [],
        week: week({
          matchPredictor: card(2, 2),
          lms: lmsRound({ picked: true }),
          championship: championship(true, false),
        }),
      }),
    )

    expect(['joinLeague', 'review', 'watchLive']).toContain(model.primaryAction.type)
    expect(model.secondaryActions.every((action) => !action.outstanding)).toBe(true)
  })
})

/* ================================================================== *
 * CASE G — never imply a membership the player does not have
 * ================================================================== */

describe('G — the player has joined neither side game', () => {
  it('says nothing at all about them', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({
          matchPredictor: card(0, 10),
          lms: lmsRound({ entered: false }),
          championship: championship(false),
        }),
      }),
    )

    const games = model.secondaryActions.map((action) => action.game)
    expect(games).not.toContain('last-man-standing')
    expect(games).not.toContain('championship')
  })

  it('is unchanged when those reads are simply absent', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({ matchPredictor: card(0, 10) }),
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
    expect(model.secondaryActions).toHaveLength(0)
  })
})

/* ================================================================== *
 * The bound ADR 0023 fixes, and the failure the mapper must survive
 * ================================================================== */

describe('the accepted shape', () => {
  it('never offers more than two secondary actions', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: week({
          matchPredictor: card(0, 10),
          lms: lmsRound(),
          championship: championship(),
        }),
      }),
    )

    expect(model.secondaryActions.length).toBeLessThanOrEqual(2)
  })

  it('still draws the Match Predictor when the whole week could not be read', () => {
    const model = buildHomeModel(
      source({
        card: card(0, 10),
        cardPresentation: presentation(0, 10),
        week: null,
      }),
    )

    expect(model.secondaryActions).toHaveLength(0)
    expect(model.primaryAction).not.toBeNull()
  })
})
