import { describe, expect, it } from 'vitest'
import { buildHomeModel } from '../../src/vnext/integration/home/buildHomeModel'
import type {
  HomeSource,
  HomeSourceLeague,
} from '../../src/vnext/integration/home/homeSource'
import { selectHomeEmphasis } from '../../src/vnext/home/selectHomeEmphasis'
import { first } from '../support/indexed'
import type { CardPresentation, MatchPredictorPage } from '../../src/features/season/matchPredictorModel'
import type { SeasonListFixture } from '../../src/services/supabase/seasonFixtureListModel'
import type { SeasonLeagueStandingsPage } from '../../src/services/supabase/seasonLeagueStandingsModel'
import type { SeasonMatchweekProjection } from '../../src/services/supabase/seasonMatchweekProjectionModel'
import type { SeasonPlayerProfile } from '../../src/services/supabase/seasonPlayerProfileModel'

/**
 * THE STAGE 6 MAPPING, TESTED AS TRUTH RATHER THAN AS SHAPE.
 *
 * Every case here is a call to `buildHomeModel` with a hand-built source. There
 * is no Supabase, no network, no auth, no React and no clock — which is the
 * point: the mapping is the only place real application state becomes something
 * Home draws, and it was written as a pure function so that this file could
 * exist. If these tests needed a database, the boundary would be in the wrong
 * place.
 *
 * WHAT THE ASSERTIONS ARE ABOUT. Almost none of them check that a field was
 * copied. They check the things that would be WRONG rather than merely different:
 * that a provider's opinion never becomes an awarded point, that a locked card
 * cannot produce a Predict action, that nothing here ranks a player, that a
 * pre-lock prediction cannot leak through consensus, and that "not known" never
 * arrives as zero. A mapping bug that renamed a field would be caught by the
 * compiler; these are the bugs that compile.
 */

const NOW = '2027-08-21T15:20:00.000Z'

/* ------------------------------------------------------------------ *
 * Builders. Small, explicit, and always overridable per case.
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
    home: club('Porthaven City', 'POR'),
    away: club('Balmorral Athletic', 'BAL'),
    result: null,
    live: null,
    ...overrides,
  }
}

function card(overrides: Partial<MatchPredictorPage> = {}): MatchPredictorPage {
  return {
    competition: { name: 'Test League', seasonLabel: '2027/28', timeZone: 'Europe/London' },
    matchweek: { number: 5, of: 38 },
    fixtures: [
      {
        fixtureId: 'fx-1',
        kickoffAt: '2027-08-21T14:00:00.000Z',
        home: { name: 'Porthaven City', shortName: 'Porthaven', tokens: { monogram: 'POR', primary: '#123456' } },
        away: { name: 'Balmorral Athletic', shortName: 'Balmorral', tokens: { monogram: 'BAL', primary: '#654321' } },
        prediction: { home: 2, away: 1 },
        result: null,
        points: null,
      },
    ],
    cardStatus: 'confirmed',
    lock: { status: 'open', locked: false, lockAt: '2027-08-21T13:45:00.000Z', reason: 'before_scope_lock' },
    joker: { playedHere: false, remainingThisHalf: 1, playable: true },
    settledPoints: null,
    ...overrides,
  }
}

function presentation(overrides: Partial<CardPresentation> = {}): CardPresentation {
  return {
    state: 'active_complete',
    // The real explanation shape. It is built out rather than cast, because a
    // cast here would let the mapper start reading a field this file never
    // supplies and the tests would still compile.
    lock: {
      kind: 'open',
      label: 'Open',
      detail: 'Your predictions for this matchweek are saved as you enter them.',
      retryable: false,
    },
    entered: 1,
    total: 1,
    atLock: 'banks_entered',
    editable: true,
    ...overrides,
  }
}

function profile(overrides: Partial<SeasonPlayerProfile> = {}): SeasonPlayerProfile {
  return {
    player: { userId: 'u-1', displayName: 'Aisha Kaur', isSelf: true },
    entered: true,
    serverNow: NOW,
    season: { points: 84, matchweeksPlayed: 4, rank: 312, fieldSize: 12490 },
    accuracy: { fixturesPredicted: 40, exactScores: 6, correctOutcomes: 22 },
    jokers: { played: 1, pointsFromJokerMatchweeks: 18 },
    history: [
      { matchweekId: 'mw-4', ordinal: 4, label: 'Matchweek 4', points: 21, jokerPlayed: false, predictions: {} },
      { matchweekId: 'mw-3', ordinal: 3, label: 'Matchweek 3', points: 18, jokerPlayed: false, predictions: {} },
      // Unsettled: carries null points and must not be plotted as a zero.
      { matchweekId: 'mw-5', ordinal: 5, label: 'Matchweek 5', points: null, jokerPlayed: false, predictions: {} },
    ],
    ...overrides,
  }
}

function standings(
  rows: readonly { userId: string; name: string; points: number; rank: number; isYou?: boolean }[],
): SeasonLeagueStandingsPage {
  const mapped = rows.map((row, index) => ({
    userId: row.userId,
    displayName: row.name,
    points: row.points,
    rank: row.rank,
    matchweeksPlayed: 4,
    tied: false,
    position: index + 1,
    isYou: row.isYou ?? false,
    isOwner: index === 0,
    hasEntry: true,
  }))
  const mine = mapped.find((row) => row.isYou)
  // `you` is the same row without `isYou` — the read sends it that way, and
  // destructuring rather than overwriting the key keeps this honest about it.
  const you = mine ? (({ isYou: _isYou, ...rest }) => rest)(mine) : null

  return {
    rows: mapped,
    totalCount: mapped.length,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you,
  }
}

function league(overrides: Partial<HomeSourceLeague> = {}): HomeSourceLeague {
  return {
    id: 'lg-1',
    name: 'Work League',
    memberCount: 3,
    standings: standings([
      { userId: 'u-9', name: 'Jamie Fox', points: 92, rank: 1 },
      { userId: 'u-1', name: 'Aisha Kaur', points: 84, rank: 2, isYou: true },
      { userId: 'u-4', name: 'Sam Okafor', points: 80, rank: 3 },
    ]),
    movement: null,
    ...overrides,
  }
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
    card: card(),
    cardPresentation: presentation(),
    weekAction: {
      kind: 'match_predictor',
      title: 'Matchweek 5 card is complete',
      locksAt: '2027-08-21T13:45:00.000Z',
      outstanding: false,
      href: null,
    },
    profile: profile(),
    leagues: [league()],
    clubForm: null,
    consensus: null,
    projection: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ *
 * 1. A normal populated state
 * ------------------------------------------------------------------ */

describe('a normal populated matchweek', () => {
  it('maps the competition, the user and the football without inventing any of it', () => {
    const model = buildHomeModel(source())

    expect(model.generatedAt).toBe(NOW)
    expect(model.user.name).toBe('Aisha Kaur')
    expect(model.user.initials).toBe('AK')
    expect(model.competition.name).toBe('Test League')
    // The competition's own round wording, not a template over a number.
    expect(model.competition.matchweekLabel).toBe('Matchweek 5')
    expect(model.competition.matchweekNumber).toBe(5)
    expect(model.upcomingMatches).toHaveLength(1)
  })

  it('carries no competition palette, because no application source holds one', () => {
    expect(buildHomeModel(source()).competition.colours).toBeNull()
  })

  it('omits every football enrichment the application does not expose', () => {
    const match = first(buildHomeModel(source()).upcomingMatches)

    // Each of these is a real capability gap and is asserted so that supplying
    // one later is a deliberate change rather than an accident.
    expect(match.venue).toBeNull()
    expect(match.headToHead).toBeNull()
    expect(match.broadcast).toBeNull()
    expect(match.home.team.officialBadge).toBeNull()
    expect(match.home.leaguePosition).toBeNull()
    // Nothing nominates a match of the day, so nothing claims to be one.
    expect(match.isFeatured).toBe(false)
  })

  it('takes club colour from the domain identity registry, never from a guess', () => {
    const match = first(buildHomeModel(source()).upcomingMatches)

    expect(match.home.team.abbreviation).toBe('POR')
    expect(match.home.team.colours.primary).toBe('#123456')
    // A club with one colour gets it in both roles rather than a computed
    // highlight, and the domain's documented default decides the text colour.
    expect(match.home.team.colours.accent).toBe('#123456')
    expect(match.home.team.colours.onPrimary).toBe('light')
  })
})

/* ------------------------------------------------------------------ *
 * 2. Live state — supplied, never inferred
 * ------------------------------------------------------------------ */

describe('live football', () => {
  const inPlay = fixture({
    live: { kind: 'in_play', home: 1, away: 0, observedAt: '2027-08-21T15:15:00.000Z' },
  })

  it('is live because the provider kind says in_play', () => {
    const model = buildHomeModel(source({ fixtures: [inPlay] }))

    expect(model.liveMatches).toHaveLength(1)
    expect(model.liveMatches[0]?.status).toBe('live')
    expect(model.liveMatches[0]?.score).toEqual({ home: 1, away: 0 })
    expect(selectHomeEmphasis(model)).toBe('live')
  })

  it('is NOT live merely because kick-off has passed', () => {
    // The forbidden approximation, stated as a test. This fixture kicked off an
    // hour and twenty minutes before `generatedAt` and has no live state at all,
    // which is exactly the window a `kickoff < now < kickoff + 2h` rule would
    // call live.
    const model = buildHomeModel(source({ fixtures: [fixture({ live: null })] }))

    expect(model.liveMatches).toEqual([])
    expect(model.upcomingMatches).toHaveLength(1)
    expect(selectHomeEmphasis(model)).not.toBe('live')
  })

  it('carries no minute, because no read supplies one', () => {
    const model = buildHomeModel(source({ fixtures: [inPlay] }))
    expect(model.liveMatches[0]?.clock).toBeNull()
  })

  it('lets the platform outrank the provider on a settled fixture', () => {
    // The provider still says in play; the platform has settled a result. The
    // platform wins and the official score is the one shown.
    const model = buildHomeModel(
      source({
        fixtures: [
          fixture({
            status: 'played',
            result: { home: 3, away: 1 },
            live: { kind: 'in_play', home: 2, away: 1, observedAt: NOW },
          }),
        ],
      }),
    )

    expect(model.liveMatches).toEqual([])
    expect(model.recentResults).toHaveLength(1)
    expect(model.recentResults[0]?.score).toEqual({ home: 3, away: 1 })
  })

  it('ignores a one-sided provisional score, which is not a scoreline', () => {
    const model = buildHomeModel(
      source({
        fixtures: [fixture({ live: { kind: 'in_play', home: 1, away: null, observedAt: NOW } })],
      }),
    )

    expect(model.liveMatches[0]?.score).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * 3. Decision state, and editability as permission
 * ------------------------------------------------------------------ */

describe('the primary action', () => {
  const outstanding = {
    kind: 'match_predictor' as const,
    title: 'Matchweek 5: 2 of 2 still to predict',
    locksAt: '2027-08-21T16:00:00.000Z',
    outstanding: true,
    href: null,
  }

  it('offers Predict when the application says something is outstanding and open', () => {
    const model = buildHomeModel(
      source({
        weekAction: outstanding,
        cardPresentation: presentation({ entered: 0, total: 2, state: 'active_empty' }),
        fixtures: [fixture({ kickoffAt: '2027-08-21T16:15:00.000Z' })],
      }),
    )

    expect(model.primaryAction.type).toBe('predict')
    expect(model.primaryAction.progress).toEqual({ completed: 0, total: 2 })
    expect(model.primaryAction.deadline).toBe('2027-08-21T16:00:00.000Z')
    expect(selectHomeEmphasis(model)).toBe('decision')
  })

  it('never offers Predict on a card the application says is closed', () => {
    // THE PERMISSION TEST. The week action still reports something outstanding —
    // a stale summary, or a lock that passed between two reads — and the card is
    // no longer editable. Presentation must not be the permission.
    const model = buildHomeModel(
      source({
        weekAction: outstanding,
        cardPresentation: presentation({ editable: false, state: 'locked' }),
      }),
    )

    expect(model.primaryAction.type).not.toBe('predict')
  })

  it('does not re-derive editability from the lock instant', () => {
    // The lock is hours in the future and the card is closed anyway — a
    // rescheduled fixture can do this, and only the server's resolver knows. A
    // mapper comparing `lockAt` to `generatedAt` would reopen the card here.
    const model = buildHomeModel(
      source({
        weekAction: { ...outstanding, locksAt: '2099-01-01T00:00:00.000Z' },
        cardPresentation: presentation({ editable: false, state: 'locked' }),
        card: card({
          lock: {
            status: 'locked',
            locked: true,
            lockAt: '2099-01-01T00:00:00.000Z',
            reason: 'already_locked',
          },
        }),
      }),
    )

    expect(model.primaryAction.type).not.toBe('predict')
    // And no fixture advertises a deadline the player cannot act on.
    for (const match of model.upcomingMatches) expect(match.lockAt).toBeNull()
  })

  it('bands urgency from the supplied deadline and the supplied instant', () => {
    const soon = buildHomeModel(
      source({
        weekAction: { ...outstanding, locksAt: '2027-08-21T16:00:00.000Z' },
        cardPresentation: presentation({ entered: 0, total: 2 }),
      }),
    )
    const calm = buildHomeModel(
      source({
        weekAction: { ...outstanding, locksAt: '2027-08-30T16:00:00.000Z' },
        cardPresentation: presentation({ entered: 0, total: 2 }),
      }),
    )

    // 40 minutes away, then nine days away, measured against `generatedAt` and
    // no clock at all.
    expect(soon.primaryAction.urgency).toBe('urgent')
    expect(calm.primaryAction.urgency).toBe('calm')
  })

  it('offers a league to a player who has none and nothing to enter', () => {
    const model = buildHomeModel(source({ leagues: [] }))
    expect(model.primaryAction.type).toBe('joinLeague')
  })
})

/* ------------------------------------------------------------------ *
 * 4. Competition / quiet state
 * ------------------------------------------------------------------ */

describe('a quiet matchweek', () => {
  it('falls to the competition emphasis with nothing live and nothing due', () => {
    const model = buildHomeModel(
      source({
        fixtures: [fixture({ status: 'played', result: { home: 1, away: 1 } })],
      }),
    )

    expect(model.liveMatches).toEqual([])
    expect(model.recentResults).toHaveLength(1)
    expect(selectHomeEmphasis(model)).toBe('competition')
  })
})

/* ------------------------------------------------------------------ *
 * 5. A new user
 * ------------------------------------------------------------------ */

describe('a new user', () => {
  const fresh = source({
    profile: profile({ season: null, accuracy: null, history: [], jokers: null }),
    card: null,
    cardPresentation: null,
    weekAction: null,
    leagues: [],
  })

  it('has no rank rather than a rank of zero', () => {
    const { recentPerformance } = buildHomeModel(fresh)

    expect(recentPerformance.rank).toBeNull()
    expect(recentPerformance.rankOutOf).toBeNull()
    expect(recentPerformance.totalPoints).toBe(0)
  })

  it('still renders a model, with the football it does have', () => {
    const model = buildHomeModel(fresh)

    expect(model.upcomingMatches).toHaveLength(1)
    expect(model.privateLeagues).toEqual([])
    expect(model.rivals).toEqual([])
    // A model with no card has no prediction to show and does not pretend to.
    expect(model.upcomingMatches[0]?.prediction).toBeNull()
    expect(model.primaryAction.progress).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * 6. Points — awarded, provisional, and never confused
 * ------------------------------------------------------------------ */

describe('awarded and provisional points', () => {
  function projection(basis: 'official' | 'provisional' | 'none', points: number): SeasonMatchweekProjection {
    return {
      serverNow: NOW,
      tournamentId: 't-1',
      matchweek: { id: 'mw-5', ordinal: 5, label: 'Matchweek 5' },
      locksAt: '2027-08-21T13:45:00.000Z',
      locked: true,
      jokerPlayed: false,
      projectedPoints: points,
      settled: false,
      fixtures: [
        {
          fixtureId: 'fx-1',
          homeTeamId: null,
          awayTeamId: null,
          kickoffAt: '2027-08-21T14:00:00.000Z',
          status: 'scheduled',
          basis,
          official: basis === 'official' ? { home: 2, away: 1 } : null,
          provisional:
            basis === 'provisional'
              ? { home: 2, away: 1, providerStatus: 'LIVE', kind: 'in_play', observedAt: NOW }
              : null,
          prediction: { home: 2, away: 1 },
          points,
          branches: null,
        },
      ],
      league: null,
    }
  }

  it('flags a point value resting on a provider opinion as provisional', () => {
    const model = buildHomeModel(
      source({
        projection: projection('provisional', 5),
        fixtures: [fixture({ live: { kind: 'in_play', home: 2, away: 1, observedAt: NOW } })],
      }),
    )

    const prediction = first(model.liveMatches).prediction
    expect(prediction?.points).toBe(5)
    expect(prediction?.pointsAreProvisional).toBe(true)
  })

  it('does not flag a point value resting on an official result', () => {
    const model = buildHomeModel(
      source({
        projection: projection('official', 5),
        fixtures: [fixture({ status: 'played', result: { home: 2, away: 1 } })],
      }),
    )

    const prediction = first(model.recentResults).prediction
    expect(prediction?.points).toBe(5)
    expect(prediction?.pointsAreProvisional).toBe(false)
  })

  it('shows no points at all when nothing states a basis', () => {
    // The read that carries `basis` was unavailable. An exact-looking prediction
    // against a finished match is NOT worth guessing a score for.
    const model = buildHomeModel(
      source({
        projection: null,
        fixtures: [fixture({ status: 'played', result: { home: 2, away: 1 } })],
      }),
    )

    const prediction = first(model.recentResults).prediction
    expect(prediction?.score).toEqual({ home: 2, away: 1 })
    expect(prediction?.points).toBeNull()
    expect(prediction?.pointsAreProvisional).toBe(false)
    // And no verdict is invented from comparing the two scorelines, even though
    // they happen to be identical here.
    expect(prediction?.outcome).toBeNull()
  })

  it('keeps the matchweek total to what was actually awarded', () => {
    const unsettled = buildHomeModel(source({ card: card({ settledPoints: null }) }))
    const settled = buildHomeModel(source({ card: card({ settledPoints: 21 }) }))

    expect(unsettled.recentPerformance.matchweekPoints).toBe(0)
    expect(settled.recentPerformance.matchweekPoints).toBe(21)
  })

  it('reports unavailable provisional and today figures as unknown, not as zero', () => {
    const { recentPerformance } = buildHomeModel(source({ projection: projection('provisional', 9) }))

    // Contract 175 states a projected matchweek TOTAL, which is not the same
    // question as "what is on the pitch". Home prints this field as "N more on
    // the pitch", so a total here would be a false sentence from a true number.
    expect(recentPerformance.provisionalPoints).toBeNull()
    expect(recentPerformance.pointsToday).toBeNull()
    expect(recentPerformance.rankMovement).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * 7. Rank and standings — never recomputed
 * ------------------------------------------------------------------ */

describe('rank and standings', () => {
  it('takes season rank and field size from the profile read', () => {
    const { recentPerformance } = buildHomeModel(source())

    expect(recentPerformance.rank).toBe(312)
    expect(recentPerformance.rankOutOf).toBe(12490)
  })

  it('keeps the server-supplied league rank even when it disagrees with the points order', () => {
    // A TIE-BREAK, EXPRESSED AS A TEST. Two members are level on points and the
    // server ranked them 1 and 2 by something this mapper cannot see. A frontend
    // that re-sorted by points could legitimately swap them, and would be
    // asserting a ranking the server did not make.
    const model = buildHomeModel(
      source({
        leagues: [
          league({
            standings: standings([
              { userId: 'u-9', name: 'Jamie Fox', points: 84, rank: 1 },
              { userId: 'u-1', name: 'Aisha Kaur', points: 84, rank: 2, isYou: true },
            ]),
          }),
        ],
      }),
    )

    const leagueModel = first(model.privateLeagues)
    expect(leagueModel.userRank).toBe(2)
    expect(leagueModel.standings.map((row) => row.rank)).toEqual([1, 2])
    expect(leagueModel.gapToLeader).toBe(0)
  })

  it('uses the league read total for the size, not the rows it happened to return', () => {
    const page = standings([
      { userId: 'u-9', name: 'Jamie Fox', points: 92, rank: 1 },
      { userId: 'u-1', name: 'Aisha Kaur', points: 84, rank: 2, isYou: true },
    ])
    const model = buildHomeModel(
      source({ leagues: [league({ standings: { ...page, totalCount: 48, hasMore: true, nextCursor: 'c' } })] }),
    )

    expect(model.privateLeagues[0]?.participantCount).toBe(48)
  })

  it('picks the adjacent rivals from the server order', () => {
    const model = buildHomeModel(source())
    const relations = model.rivals.map((rival) => rival.relation)

    expect(relations).toContain('closestAbove')
    expect(relations).toContain('closestBelow')
    const above = model.rivals.find((rival) => rival.relation === 'closestAbove')
    expect(above?.player.name).toBe('Jamie Fox')
    expect(above?.pointsDifference).toBe(8)
    expect(above?.headline).toBe('8 points to catch Jamie Fox')
  })

  it('claims no movement where no settled matchweek stated one', () => {
    const model = buildHomeModel(source())

    expect(model.privateLeagues[0]?.userMovement).toBeNull()
    for (const row of first(model.privateLeagues).standings) expect(row.movement).toBeNull()
    for (const rival of model.rivals) expect(rival.movement).toBeNull()
  })

  it('reads movement from a settled matchweek when there is one', () => {
    const model = buildHomeModel(
      source({
        leagues: [
          league({
            movement: {
              leagueId: 'lg-1',
              matchweek: { id: 'mw-4', ordinal: 4, label: 'Matchweek 4' },
              settled: true,
              serverNow: NOW,
              members: [
                {
                  userId: 'u-1',
                  displayName: 'Aisha Kaur',
                  isSelf: true,
                  pointsBefore: 63,
                  pointsAfter: 84,
                  pointsThisMatchweek: 21,
                  rankBefore: 5,
                  rankAfter: 2,
                  movement: 3,
                  gapToLeaderBefore: 14,
                  gapToLeaderAfter: 8,
                },
              ],
            },
          }),
        ],
      }),
    )

    expect(model.privateLeagues[0]?.userMovement).toEqual({ direction: 'up', places: 3 })
  })

  it('ignores an unsettled movement answer entirely', () => {
    const model = buildHomeModel(
      source({
        leagues: [
          league({
            movement: {
              leagueId: 'lg-1',
              matchweek: null,
              settled: false,
              serverNow: NOW,
              members: [],
            },
          }),
        ],
      }),
    )

    expect(model.privateLeagues[0]?.userMovement).toBeNull()
  })

  it('drops a league table the caller has no row in', () => {
    const model = buildHomeModel(
      source({
        leagues: [
          league({
            standings: standings([{ userId: 'u-9', name: 'Jamie Fox', points: 92, rank: 1 }]),
          }),
        ],
      }),
    )

    expect(model.privateLeagues).toEqual([])
    expect(model.rivals).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * 8. Consensus and prediction secrecy
 * ------------------------------------------------------------------ */

describe('consensus', () => {
  const answered = {
    suppressed: false,
    matchweek: 5,
    minimumEntries: 10,
    submittedEntries: 400,
    lockedAt: '2027-08-21T13:45:00.000Z',
    fixtures: [
      {
        id: 'fx-1',
        homeName: 'Porthaven City',
        awayName: 'Balmorral Athletic',
        kickoffAt: '2027-08-21T14:00:00.000Z',
        resultHome: null,
        resultAway: null,
        predicted: 400,
        homeWin: 304,
        draw: 64,
        awayWin: 32,
        shares: { homeWin: 76, draw: 16, awayWin: 8 },
        topScores: [{ home: 2, away: 0, picks: 120 }],
      },
    ],
  }

  it('shows a consensus only when the server answered with one', () => {
    const model = buildHomeModel(source({ consensus: answered }))
    const consensus = first(model.upcomingMatches).consensus

    expect(consensus?.community.sampleSize).toBe(400)
    expect(consensus?.community.homeWinShare).toBeCloseTo(0.76)
    expect(consensus?.community.popular[0]).toEqual({ score: { home: 2, away: 0 }, share: 0.3 })
  })

  it('shows no consensus at all when the read was refused or unavailable', () => {
    // The server hides consensus before the matchweek locks. A null read must
    // become no consensus — never an empty group, which would read as "nobody
    // has an opinion" and is a different claim.
    expect(buildHomeModel(source({ consensus: null })).upcomingMatches[0]?.consensus).toBeNull()
  })

  it('shows no consensus when the server suppressed it', () => {
    const model = buildHomeModel(source({ consensus: { ...answered, suppressed: true } }))
    expect(model.upcomingMatches[0]?.consensus).toBeNull()
  })

  it('never exposes a private-league cohort as friends consensus', () => {
    // Contract 130's cohort is the competition's entrants. There is no
    // private-league consensus read on this path, so `friends` is null rather
    // than a group assembled from a league table — which would be inferring
    // named players' picks from an aggregate they never agreed to.
    const model = buildHomeModel(source({ consensus: answered }))
    expect(model.upcomingMatches[0]?.consensus?.friends).toBeNull()
  })

  it('leaks no rival prediction anywhere in the model', () => {
    // THE SECRECY SWEEP. Every rival and every standings row Home carries is
    // walked for anything resembling a scoreline. The league reads carry points
    // and ranks and no picks, and this asserts the mapper did not go looking for
    // any — a `prediction`, `score` or `picks` key on a rival would mean a
    // pre-lock leak had become possible.
    const model = buildHomeModel(source({ consensus: answered }))
    const people = [
      ...model.rivals.map((rival) => rival.player),
      ...model.privateLeagues.flatMap((entry) => entry.standings.map((row) => row.player)),
    ]

    expect(people.length).toBeGreaterThan(0)
    for (const person of people) {
      expect(Object.keys(person).sort()).toEqual([
        'avatarUrl',
        'favouriteTeamId',
        'id',
        'initials',
        'name',
      ])
    }
  })
})

/* ------------------------------------------------------------------ *
 * 9. Form, postponement, long names, partial failure
 * ------------------------------------------------------------------ */

describe('optional enrichment and awkward states', () => {
  it('maps the server form letters and nothing else', () => {
    const model = buildHomeModel(
      source({
        clubForm: {
          serverNow: NOW,
          matches: 6,
          clubs: [
            {
              teamId: 'team-1',
              name: 'Porthaven City',
              tokens: { monogram: 'POR', primary: '#123456' },
              played: 4,
              won: 3,
              drawn: 0,
              lost: 1,
              goalsFor: 8,
              goalsAgainst: 3,
              form: ['W', 'W', 'L', 'W'],
            },
          ],
        },
      }),
    )

    const match = first(buildHomeModel(source()).upcomingMatches)
    expect(match.home.form).toEqual([])
    expect(model.upcomingMatches[0]?.home.form).toEqual(['win', 'win', 'loss', 'win'])
    // The away club had no row in the form table. An empty run, not five blanks.
    expect(model.upcomingMatches[0]?.away.form).toEqual([])
  })

  it('keeps a postponed fixture out of the live and settled buckets', () => {
    const model = buildHomeModel(source({ fixtures: [fixture({ status: 'postponed' })] }))

    expect(model.liveMatches).toEqual([])
    expect(model.recentResults).toEqual([])
    expect(model.upcomingMatches[0]?.status).toBe('postponed')
  })

  it('respects the platform status over a cheerful provider on a postponed fixture', () => {
    const model = buildHomeModel(
      source({
        fixtures: [
          fixture({
            status: 'postponed',
            live: { kind: 'in_play', home: 1, away: 0, observedAt: NOW },
          }),
        ],
      }),
    )

    expect(model.liveMatches).toEqual([])
    expect(model.upcomingMatches[0]?.status).toBe('postponed')
  })

  it('carries long club and league names through without truncating them', () => {
    const long = 'Inverbervie Caledonian Thistle Athletic Football Club'
    const model = buildHomeModel(
      source({
        fixtures: [fixture({ home: club(long, 'INV') })],
        leagues: [league({ name: 'The Thursday Night Five-a-Side Prediction Society' })],
      }),
    )

    // Shortening a name is the layout's job — Home's dense rows wrap and then
    // ellipsise — and a mapper that cut it would make that impossible to undo.
    expect(model.upcomingMatches[0]?.home.team.name).toBe(long)
    expect(model.upcomingMatches[0]?.home.team.shortName).toBe(long)
    expect(model.privateLeagues[0]?.name).toBe('The Thursday Night Five-a-Side Prediction Society')
  })

  it('renders with every optional source missing at once', () => {
    const model = buildHomeModel(
      source({
        card: null,
        cardPresentation: null,
        weekAction: null,
        profile: null,
        leagues: [],
        clubForm: null,
        consensus: null,
        projection: null,
      }),
    )

    // THE PARTIAL-FAILURE CASE. Everything except the competition and its
    // fixtures failed, and Home still has a model: less information, no false
    // information, and an emphasis it can act on.
    expect(model.upcomingMatches).toHaveLength(1)
    expect(model.recentPerformance.totalPoints).toBe(0)
    expect(model.recentPerformance.accuracy).toEqual({
      predicted: 0,
      exact: 0,
      resultOnly: 0,
      missed: 0,
    })
    expect(selectHomeEmphasis(model)).toBe('competition')
  })

  it('renders with no football at all', () => {
    const model = buildHomeModel(source({ fixtures: [] }))

    expect(model.liveMatches).toEqual([])
    expect(model.upcomingMatches).toEqual([])
    expect(model.recentResults).toEqual([])
    // With no round to name, the competition falls back to its matchweek number.
    expect(model.competition.matchweekLabel).toBe('Matchweek 5')
  })

  it('keeps the activity feed empty rather than assembling one', () => {
    expect(buildHomeModel(source()).activity).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * 10. Accuracy and history
 * ------------------------------------------------------------------ */

describe('accuracy and history', () => {
  it('splits the server counts into three parts of one denominator', () => {
    const { accuracy } = buildHomeModel(source()).recentPerformance

    // 40 predicted, 22 with the right outcome, 6 of those exact. `correct_outcomes`
    // counts a matching result sign and therefore includes every exact score, so
    // right-result-only is 22 − 6 and missed is 40 − 22.
    expect(accuracy).toEqual({ predicted: 40, exact: 6, resultOnly: 16, missed: 18 })
    expect(accuracy.exact + accuracy.resultOnly + accuracy.missed).toBe(accuracy.predicted)
  })

  it('plots only settled matchweeks, oldest first', () => {
    const { matchweekHistory } = buildHomeModel(source()).recentPerformance

    // Matchweek 5 is unsettled and carries null points. Plotting it as a zero
    // would draw a collapse that never happened.
    expect(matchweekHistory).toEqual([
      { matchweek: 3, points: 18 },
      { matchweek: 4, points: 21 },
    ])
  })
})

/* ------------------------------------------------------------------ *
 * 11. The emphasis contract
 * ------------------------------------------------------------------ */

describe('the emphasis selector over real state', () => {
  it('is fed partitions rather than being taught to compute them', () => {
    // `selectHomeEmphasis` reads `liveMatches` and `primaryAction.urgency`. Both
    // are decided above by supplied application state, which is what keeps the
    // Stage 4 authority intact: the selector never learned about a clock, a
    // kickoff, a lock or a provider status code.
    const live = buildHomeModel(
      source({ fixtures: [fixture({ live: { kind: 'in_play', home: 0, away: 0, observedAt: NOW } })] }),
    )
    expect(selectHomeEmphasis(live)).toBe('live')

    const quiet = buildHomeModel(
      source({ fixtures: [fixture({ status: 'played', result: { home: 1, away: 0 } })] }),
    )
    expect(selectHomeEmphasis(quiet)).toBe('competition')
  })
})

/* ------------------------------------------------------------------ *
 * Contract 209 — Home and Matches answer the same question the same way
 * ------------------------------------------------------------------ */

describe('abnormal fixture state on Home', () => {
  it('says a postponed fixture has no new date', () => {
    const model = buildHomeModel(source({ fixtures: [fixture({ status: 'postponed' })] }))
    const match = first(model.upcomingMatches)

    expect(match.status).toBe('postponed')
    expect(match.scheduleNote).toBe('New date to be confirmed')
  })

  it('says when it is now due, once it has one', () => {
    const model = buildHomeModel(
      source({
        fixtures: [
          fixture({
            status: 'postponed',
            kickoffAt: '2027-09-14T18:45:00.000Z',
            schedule: {
              kickoffConfirmed: false,
              rescheduled: true,
              originalKickoffAt: '2027-08-21T14:00:00.000Z',
            },
          }),
        ],
      }),
    )

    expect(first(model.upcomingMatches).scheduleNote?.startsWith('Now due ')).toBe(true)
  })

  it('explains a fixture that was moved into this week and is going ahead', () => {
    const model = buildHomeModel(
      source({
        fixtures: [
          fixture({
            schedule: {
              kickoffConfirmed: true,
              rescheduled: true,
              originalKickoffAt: '2027-07-30T14:00:00.000Z',
            },
          }),
        ],
      }),
    )

    expect(first(model.upcomingMatches).status).toBe('upcoming')
    expect(first(model.upcomingMatches).scheduleNote).toBe('Rescheduled')
  })

  it('says nothing at all about an ordinary fixture', () => {
    expect(first(buildHomeModel(source()).upcomingMatches).scheduleNote).toBeNull()
  })

  it('no longer postpones a fixture on a provider kind Matches would refuse', () => {
    // The divergence contract 209 removed: Home used to promote `live.kind`
    // 'postponed' on its own, so one payload could read "P–P" here and "15:00"
    // in Matches. Both surfaces now read `status`, and there is one answer.
    const model = buildHomeModel(
      source({
        fixtures: [
          fixture({
            status: 'scheduled',
            live: { kind: 'postponed', home: null, away: null, observedAt: NOW },
          }),
        ],
      }),
    )

    expect(first(model.upcomingMatches).status).toBe('upcoming')
  })
})

/**
 * "SINCE YOU WERE LAST HERE" — the mapper's half.
 *
 * The zone's rendering rules live in `sinceLastVisit.test.tsx`; these are the
 * SELECTION rules, stated where the selection is made. The marker is the one
 * input to this mapper that is not a read, so every way it can be absent or
 * wrong has to produce a page rather than a defect.
 */
describe('what finished while the player was away', () => {
  const settled = () =>
    source({
      fixtures: [
        fixture({ id: 'early', kickoffAt: '2027-08-20T14:00:00.000Z', status: 'played', result: { home: 1, away: 0 } }),
        fixture({ id: 'late', kickoffAt: '2027-08-21T14:00:00.000Z', status: 'played', result: { home: 2, away: 1 } }),
      ],
    })

  it('answers null when this device has never been here', () => {
    // A first visit has no marker, and a summary of the whole season dressed as
    // "what changed" is the worst possible first impression of the feature.
    expect(buildHomeModel({ ...settled(), lastVisitAt: null }).sinceLastVisit).toBeNull()
    expect(buildHomeModel(settled()).sinceLastVisit).toBeNull()
  })

  it('answers null rather than everything when the marker is unreadable', () => {
    expect(buildHomeModel({ ...settled(), lastVisitAt: 'yesterday' }).sinceLastVisit).toBeNull()
  })

  it('shows what finished after the marker, newest first', () => {
    const model = buildHomeModel({ ...settled(), lastVisitAt: '2000-01-01T00:00:00.000Z' })

    expect(model.sinceLastVisit?.results.map((match) => match.id)).toEqual(['late', 'early'])
    expect(model.sinceLastVisit?.more).toBe(0)
  })

  it('shows only what finished after the marker', () => {
    const model = buildHomeModel({ ...settled(), lastVisitAt: '2027-08-21T00:00:00.000Z' })

    expect(model.sinceLastVisit?.results.map((match) => match.id)).toEqual(['late'])
  })

  it('answers null when nothing has finished since', () => {
    // The ordinary Tuesday. A present-but-empty zone teaches a player to scroll
    // past the one place worth reading on the day it matters.
    expect(
      buildHomeModel({ ...settled(), lastVisitAt: '2099-01-01T00:00:00.000Z' }).sinceLastVisit,
    ).toBeNull()
  })

  it('never shows a match the server has not settled', () => {
    const model = buildHomeModel({
      ...source({
        fixtures: [
          fixture({ id: 'off', kickoffAt: '2027-08-20T14:00:00.000Z', status: 'postponed' }),
          fixture({ id: 'open', kickoffAt: '2027-08-20T15:00:00.000Z', status: 'scheduled' }),
        ],
      }),
      lastVisitAt: '2000-01-01T00:00:00.000Z',
    })

    // Recency decides ORDER. Settlement decides membership, and it is the
    // server's word rather than a kickoff that has gone past.
    expect(model.sinceLastVisit).toBeNull()
  })
})

/**
 * THE MATCHWEEK RECAP — what the last settled matchweek was worth.
 *
 * A capability the Hub had and the Competition Deck dropped. It reaches Home
 * from reads Home already holds, and the questions worth holding are the ones
 * about WHICH matchweek it describes: a matchweek that has locked but not
 * settled is not one, and a league whose most recent settled matchweek is a
 * different one is describing another week entirely.
 */
describe('the matchweek recap', () => {
  const movementFor = (ordinal: number) => ({
    leagueId: 'lg-1',
    matchweek: { id: `mw-${ordinal}`, ordinal, label: `Matchweek ${ordinal}` },
    settled: true,
    serverNow: NOW,
    members: [
      {
        userId: 'u-1',
        displayName: 'Aisha Kaur',
        isSelf: true,
        pointsBefore: 63,
        pointsAfter: 84,
        pointsThisMatchweek: 21,
        rankBefore: 5,
        rankAfter: 2,
        movement: 3,
        gapToLeaderBefore: 14,
        gapToLeaderAfter: 8,
      },
    ],
  })

  it('describes the most recent matchweek whose points are banked', () => {
    // The profile's history leads with Matchweek 4 (21 points) and also holds
    // Matchweek 5 with null points, which has locked but not settled.
    const recap = buildHomeModel(source()).matchweekRecap

    expect(recap?.matchweekOrdinal).toBe(4)
    expect(recap?.points).toBe(21)
  })

  it('states the season figures the profile read actually answered', () => {
    const recap = buildHomeModel(source()).matchweekRecap

    expect(recap?.seasonPoints).toBe(84)
    expect(recap?.seasonRank).toBe(312)
    expect(recap?.fieldSize).toBe(12490)
    expect(recap?.exactScores).toBe(6)
    expect(recap?.correctOutcomes).toBe(22)
  })

  it('answers null for a player who has not entered', () => {
    expect(buildHomeModel(source({ profile: profile({ entered: false }) })).matchweekRecap).toBeNull()
  })

  it('answers null when nothing has settled yet', () => {
    const nothingSettled = profile({
      history: [
        { matchweekId: 'mw-1', ordinal: 1, label: 'Matchweek 1', points: null, jokerPlayed: false, predictions: {} },
      ],
    })

    // Locked is not settled. A blank score reported as a recap would be worse
    // than no recap at all.
    expect(buildHomeModel(source({ profile: nothingSettled })).matchweekRecap).toBeNull()
  })

  it('answers null when the profile read did not answer', () => {
    expect(buildHomeModel(source({ profile: null })).matchweekRecap).toBeNull()
  })

  it('carries a league that moved over THIS matchweek', () => {
    const recap = buildHomeModel(
      source({ leagues: [league({ movement: movementFor(4) })] }),
    ).matchweekRecap

    expect(recap?.leagues).toHaveLength(1)
    expect(recap?.leagues[0]?.leagueName).toBe('Work League')
    // The server's sign, not a subtraction of two ranks here.
    expect(recap?.leagues[0]?.movement).toBe(3)
    expect(recap?.leagues[0]?.rankAfter).toBe(2)
    expect(recap?.leagues[0]?.gapToLeader).toBe(8)
  })

  it('drops a league whose settled matchweek is a different one', () => {
    const recap = buildHomeModel(
      source({ leagues: [league({ movement: movementFor(3) })] }),
    ).matchweekRecap

    // Matchweek 3's movement beside a Matchweek 4 heading would be a claim
    // about the wrong week, stated confidently.
    expect(recap?.leagues).toEqual([])
  })

  it('drops a league whose movement answer is unsettled', () => {
    const recap = buildHomeModel(
      source({
        leagues: [
          league({
            movement: {
              leagueId: 'lg-1',
              matchweek: null,
              settled: false,
              serverNow: NOW,
              members: [],
            },
          }),
        ],
      }),
    ).matchweekRecap

    expect(recap?.leagues).toEqual([])
  })
})

/**
 * A WATCHED RIVAL LEADS, and is the only one the player chose.
 *
 * Every other relation in the strip is something the software worked out from
 * where two people stand. A pin is a preference — it says which of those
 * answers the reader actually cares about — so it comes first and it renames
 * the person rather than listing them twice.
 */
describe('who the player is watching', () => {
  const table = () =>
    league({
      standings: standings([
        { userId: 'u-9', name: 'Jamie Fox', points: 92, rank: 1 },
        { userId: 'u-1', name: 'Aisha Kaur', points: 84, rank: 2, isYou: true },
        { userId: 'u-4', name: 'Sam Okafor', points: 80, rank: 3 },
        { userId: 'u-7', name: 'Bea Nowak', points: 61, rank: 4 },
      ]),
    })

  it('leads with a watched rival who is nowhere near the reader', () => {
    const model = buildHomeModel(
      source({ leagues: [table()], watchedRivalIds: ['u-7'] }),
    )

    expect(model.rivals[0]?.player.name).toBe('Bea Nowak')
    expect(model.rivals[0]?.relation).toBe('watched')
  })

  it('still derives the neighbours behind the pin', () => {
    const model = buildHomeModel(
      source({ leagues: [table()], watchedRivalIds: ['u-7'] }),
    )

    expect(model.rivals.map((rival) => rival.relation)).toEqual([
      'watched',
      'closestAbove',
      'closestBelow',
    ])
  })

  it('names a watched neighbour once, as watched', () => {
    // Jamie is both the leader and directly above. Pinning them must not put
    // the same person in the strip two or three times with three reasons.
    const model = buildHomeModel(
      source({ leagues: [table()], watchedRivalIds: ['u-9'] }),
    )
    const jamie = model.rivals.filter((rival) => rival.player.name === 'Jamie Fox')

    expect(jamie).toHaveLength(1)
    expect(jamie[0]?.relation).toBe('watched')
  })

  it('never watches the reader', () => {
    const model = buildHomeModel(
      source({ leagues: [table()], watchedRivalIds: ['u-1'] }),
    )

    expect(model.rivals.some((rival) => rival.relation === 'watched')).toBe(false)
  })

  it('is the derived strip when nothing is pinned', () => {
    const model = buildHomeModel(source({ leagues: [table()] }))

    expect(model.rivals.map((rival) => rival.relation)).toEqual([
      'closestAbove',
      'closestBelow',
    ])
  })
})
