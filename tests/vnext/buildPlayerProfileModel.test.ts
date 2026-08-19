import { describe, expect, it } from 'vitest'
import { buildPlayerProfileModel } from '../../src/vnext/integration/playerProfile/buildPlayerProfileModel'
import type {
  PinnedRead,
  PlayerProfileSource,
  ProfileRead,
  RankHistoryRead,
  RivalryRead,
} from '../../src/vnext/integration/playerProfile/playerProfileSource'
import type { SeasonPlayerProfile } from '../../src/services/supabase/seasonPlayerProfileModel'
import type { SeasonRankHistory } from '../../src/services/supabase/seasonRankHistoryModel'
import type { SeasonRivalry } from '../../src/services/supabase/seasonRivalryModel'
import { first } from '../support/indexed'

/**
 * `PlayerProfileSource` → `PlayerProfileModel`, TESTED WHERE A MAPPER LIES.
 *
 * The compiler covers field copying. What is held here is the set of
 * conversions that would be WRONG rather than merely different:
 *
 *   1. THE THREE PANELS ARE INDEPENDENT. One read refusing must never change
 *      another's outcome — that is the whole Stage 10 architecture, and it is
 *      only visible in a mapper test because a page cannot show what it never
 *      received.
 *   2. AN UNSETTLED MATCHWEEK IS NOT ZERO POINTS. `points: null` becomes
 *      `pending`, which nothing downstream can coalesce.
 *   3. THE HEADING IS THE SERVER'S, BY A FIXED PRIORITY, and is null when no
 *      read answered. Nothing in the source can supply one.
 *   4. THE DENOMINATOR IS CARRIED, NOT COUNTED, because `recent` is truncated.
 *   5. NOTHING IS INFERRED FROM A GAP in the revealed history.
 */

const NOW = '2027-11-14T19:20:00.000Z'

function profilePayload(overrides: Partial<SeasonPlayerProfile> = {}): SeasonPlayerProfile {
  return {
    player: { userId: 'user-callum', displayName: 'Callum Aitken', isSelf: false },
    entered: true,
    serverNow: NOW,
    season: { points: 161, matchweeksPlayed: 12, rank: 2, fieldSize: 412 },
    accuracy: { fixturesPredicted: 96, exactScores: 11, correctOutcomes: 54 },
    jokers: { played: 2, pointsFromJokerMatchweeks: 41 },
    history: [
      {
        matchweekId: 'mw-12',
        ordinal: 12,
        label: 'Matchweek 12',
        points: 18,
        jokerPlayed: true,
        predictions: { 'fx-b': { home: 1, away: 0 }, 'fx-a': { home: 2, away: 1 } },
      },
    ],
    ...overrides,
  }
}

function historyPayload(overrides: Partial<SeasonRankHistory> = {}): SeasonRankHistory {
  return {
    playerRef: 'entry-callum',
    reach: 'compare',
    displayName: 'Callum from the history read',
    playerId: null,
    serverNow: NOW,
    // A RUNNING TOTAL, so it increases. See `seasonRankHistoryModel`.
    matchweeks: [
      { matchweekId: 'mw-11', ordinal: 11, label: 'Matchweek 11', cumulativePoints: 133, rank: 9, fieldSize: 412 },
      { matchweekId: 'mw-12', ordinal: 12, label: 'Matchweek 12', cumulativePoints: 151, rank: 2, fieldSize: 412 },
    ],
    ...overrides,
  }
}

function rivalryPayload(overrides: Partial<SeasonRivalry> = {}): SeasonRivalry {
  const side = {
    playerRef: 'entry-rhona',
    displayName: 'Rhona Buchanan',
    reach: 'self' as const,
    playerId: 'user-rhona',
    points: 148,
    matchweeksPlayed: 12,
    standing: { rank: 4, fieldSize: 412 },
    accuracy: { fixturesCompared: 96, exactScores: 9, correctOutcomes: 51 },
  }
  return {
    serverNow: NOW,
    matchweeksCompared: 30,
    you: side,
    opponent: {
      ...side,
      playerRef: 'entry-callum',
      displayName: 'Callum from the rivalry read',
      reach: 'compare',
      playerId: null,
      points: 161,
      standing: { rank: 2, fieldSize: 412 },
      accuracy: { fixturesCompared: 96, exactScores: 11, correctOutcomes: 54 },
    },
    pointsGap: 13,
    record: { yourWins: 14, theirWins: 13, draws: 3 },
    recent: [
      {
        matchweekId: 'mw-12',
        ordinal: 12,
        label: 'Matchweek 12',
        yourPoints: 14,
        theirPoints: 18,
        outcome: 'them',
      },
    ],
    ...overrides,
  }
}

function source(overrides: {
  profile?: ProfileRead
  rankHistory?: RankHistoryRead
  rivalry?: RivalryRead
  isYou?: boolean
  ref?: string | null
  pinned?: PinnedRead | null
}): PlayerProfileSource {
  return {
    generatedAt: NOW,
    context: {
      tournamentId: 'tour-1',
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      gameName: 'Match Predictor',
    },
    target: {
      playerId: 'user-callum',
      ref: overrides.ref === undefined ? 'entry-callum' : overrides.ref,
      isYou: overrides.isYou ?? false,
    },
    profile: overrides.profile ?? { kind: 'ok', profile: profilePayload() },
    rankHistory: overrides.rankHistory ?? { kind: 'ok', history: historyPayload() },
    rivalry: overrides.rivalry ?? { kind: 'ok', rivalry: rivalryPayload() },
    pinned:
      overrides.pinned === undefined ? { kind: 'ok', pinned: false } : overrides.pinned,
  }
}

describe('the three panels are independent', () => {
  it('leaves the chart and the comparison intact when the profile is refused', () => {
    // THE BINDING CASE. Contract 151 needs a shared private league; contract
    // 192 needs only `compare`. A mapper that coupled them would hide two
    // panels the server was willing to answer.
    const model = buildPlayerProfileModel(source({ profile: { kind: 'refused' } }))

    expect(model.profile.kind).toBe('refused')
    expect(model.rankHistory.kind).toBe('history')
    expect(model.rivalry.kind).toBe('rivalry')
  })

  it('leaves the profile intact when both contract-192 reads refuse', () => {
    const model = buildPlayerProfileModel(
      source({ rankHistory: { kind: 'refused' }, rivalry: { kind: 'refused' } }),
    )

    expect(model.profile.kind).toBe('profile')
    expect(model.rankHistory.kind).toBe('refused')
    expect(model.rivalry.kind).toBe('refused')
  })

  it('turns one read`s fault into one unavailable panel and no others', () => {
    const model = buildPlayerProfileModel(source({ rivalry: { kind: 'failed' } }))

    expect(model.rivalry.kind).toBe('unavailable')
    expect(model.profile.kind).toBe('profile')
    expect(model.rankHistory.kind).toBe('history')
  })
})

describe('refusal, absence and failure stay three sentences', () => {
  it('maps a failed read to unavailable and never to refused', () => {
    const model = buildPlayerProfileModel(
      source({
        profile: { kind: 'failed' },
        rankHistory: { kind: 'failed' },
        rivalry: { kind: 'failed' },
      }),
    )
    expect([model.profile.kind, model.rankHistory.kind, model.rivalry.kind]).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
    ])
  })

  it('keeps `not entered` as a fact about the player rather than a refusal', () => {
    // All three reads can say it, and each panel says it in its own words.
    const model = buildPlayerProfileModel(
      source({
        profile: { kind: 'ok', profile: profilePayload({ entered: false }) },
        rankHistory: { kind: 'not-entered' },
        rivalry: { kind: 'not-entered' },
      }),
    )
    expect(model.profile.kind).toBe('not-entered')
    expect(model.rankHistory.kind).toBe('not-entered')
    expect(model.rivalry.kind).toBe('not-entered')
  })

  it('keeps `unaddressable` distinct from both', () => {
    const model = buildPlayerProfileModel(
      source({ ref: null, rankHistory: { kind: 'unaddressable' }, rivalry: { kind: 'unaddressable' } }),
    )
    expect(model.rankHistory.kind).toBe('unaddressable')
    expect(model.rivalry.kind).toBe('unaddressable')
    expect(model.heading.address.ref).toBeNull()
  })

  it('keeps `self` distinct from a refusal', () => {
    const model = buildPlayerProfileModel(source({ isYou: true, rivalry: { kind: 'self' } }))
    expect(model.rivalry.kind).toBe('self')
    expect(model.heading.isYou).toBe(true)
  })
})

describe('the heading is the server`s, by a fixed priority', () => {
  it('prefers contract 151, the narrowest boundary', () => {
    expect(buildPlayerProfileModel(source({})).heading.displayName).toBe('Callum Aitken')
  })

  it('falls to the rivalry`s opponent side when the profile did not answer', () => {
    const model = buildPlayerProfileModel(source({ profile: { kind: 'refused' } }))
    expect(model.heading.displayName).toBe('Callum from the rivalry read')
  })

  it('falls to the rank history last', () => {
    const model = buildPlayerProfileModel(
      source({ profile: { kind: 'refused' }, rivalry: { kind: 'refused' } }),
    )
    expect(model.heading.displayName).toBe('Callum from the history read')
  })

  it('has no name at all when no read answered', () => {
    // The page genuinely does not know who this is, and must say so rather than
    // remember a label from somewhere.
    const model = buildPlayerProfileModel(
      source({
        profile: { kind: 'failed' },
        rankHistory: { kind: 'failed' },
        rivalry: { kind: 'failed' },
      }),
    )
    expect(model.heading.displayName).toBeNull()
  })

  it('does not change its answer with the order the reads landed', () => {
    // THE THREE READS DISAGREE ON PURPOSE HERE. Each payload carries a
    // different name, so an implementation that took "whichever answered" — or
    // that read them in a different order — produces a different heading. An
    // earlier version of this test compared two sources that both had the
    // profile answering, so both went down the same branch and it could not
    // fail; these three go down three.
    expect(buildPlayerProfileModel(source({})).heading.displayName).toBe('Callum Aitken')
    expect(
      buildPlayerProfileModel(source({ profile: { kind: 'refused' } })).heading.displayName,
    ).toBe('Callum from the rivalry read')
    expect(
      buildPlayerProfileModel(
        source({ profile: { kind: 'refused' }, rivalry: { kind: 'refused' } }),
      ).heading.displayName,
    ).toBe('Callum from the history read')
  })

  it('carries both addresses and nothing else that could identify a person', () => {
    const model = buildPlayerProfileModel(source({}))
    expect(Object.keys(model.heading.address).sort()).toEqual(['playerId', 'ref'])
  })
})

describe('an unsettled matchweek is not a zero', () => {
  it('maps a null points figure to pending', () => {
    const model = buildPlayerProfileModel(
      source({
        profile: {
          kind: 'ok',
          profile: profilePayload({
            history: [
              {
                matchweekId: 'mw-13',
                ordinal: 13,
                label: 'Matchweek 13',
                points: null,
                jokerPlayed: false,
                predictions: { 'fx-a': { home: 1, away: 1 } },
              },
            ],
          }),
        },
      }),
    )

    const panel = model.profile
    if (panel.kind !== 'profile') throw new Error('expected a profile panel')
    expect(first(panel.detail.history).result).toEqual({ kind: 'pending' })
  })

  it('keeps a genuine nought as a settled nought', () => {
    // Zero points in a marked matchweek is an ordinary result and is not the
    // same fact as an unmarked one.
    const model = buildPlayerProfileModel(
      source({
        profile: {
          kind: 'ok',
          profile: profilePayload({
            history: [
              {
                matchweekId: 'mw-12',
                ordinal: 12,
                label: 'Matchweek 12',
                points: 0,
                jokerPlayed: false,
                predictions: { 'fx-a': { home: 1, away: 1 } },
              },
            ],
          }),
        },
      }),
    )

    const panel = model.profile
    if (panel.kind !== 'profile') throw new Error('expected a profile panel')
    expect(first(panel.detail.history).result).toEqual({ kind: 'settled', points: 0 })
  })
})

describe('the revealed history is carried, and nothing is inferred from its gaps', () => {
  it('keeps the server`s order rather than re-sorting', () => {
    const model = buildPlayerProfileModel(
      source({
        profile: {
          kind: 'ok',
          profile: profilePayload({
            history: [
              { matchweekId: 'mw-12', ordinal: 12, label: 'Matchweek 12', points: 18, jokerPlayed: false, predictions: {} },
              { matchweekId: 'mw-8', ordinal: 8, label: 'Matchweek 8', points: 21, jokerPlayed: false, predictions: {} },
              { matchweekId: 'mw-10', ordinal: 10, label: 'Matchweek 10', points: 14, jokerPlayed: false, predictions: {} },
            ],
          }),
        },
      }),
    )

    const panel = model.profile
    if (panel.kind !== 'profile') throw new Error('expected a profile panel')
    expect(panel.detail.history.map((entry) => entry.ordinal)).toEqual([12, 8, 10])
  })

  it('orders the picks by fixture id rather than by object-key order', () => {
    // `Object.entries` follows insertion order over a payload that never
    // promised one, and an unstable order re-keys a list on every render.
    const model = buildPlayerProfileModel(source({}))
    const panel = model.profile
    if (panel.kind !== 'profile') throw new Error('expected a profile panel')
    expect(first(panel.detail.history).picks.map((pick) => pick.fixtureId)).toEqual([
      'fx-a',
      'fx-b',
    ])
  })

  it('carries no count of what is missing', () => {
    // The gaps mean "not yet revealed" OR "they did not play it" and the
    // payload does not say which, so there is no field here to draw an "n of m"
    // from. This asserts the shape rather than a value.
    const model = buildPlayerProfileModel(source({}))
    const panel = model.profile
    if (panel.kind !== 'profile') throw new Error('expected a profile panel')
    expect(Object.keys(panel.detail).sort()).toEqual([
      'accuracy',
      'history',
      'jokers',
      'summary',
    ])
  })
})

describe('the comparison carries its stated denominator', () => {
  it('keeps a denominator far larger than the window it truncated', () => {
    const model = buildPlayerProfileModel(source({}))
    const panel = model.rivalry
    if (panel.kind !== 'rivalry') throw new Error('expected a rivalry panel')

    expect(panel.detail.matchweeksCompared).toBe(30)
    expect(panel.detail.recent).toHaveLength(1)
    expect(panel.detail.yourWins + panel.detail.theirWins + panel.detail.draws).toBe(30)
  })

  it('keeps the gap`s sign rather than re-signing it from the two totals', () => {
    const model = buildPlayerProfileModel(source({}))
    const panel = model.rivalry
    if (panel.kind !== 'rivalry') throw new Error('expected a rivalry panel')
    expect(panel.detail.pointsGap).toBe(13)
  })

  it('carries an absent standing as absent rather than as a zeroth place', () => {
    const model = buildPlayerProfileModel(
      source({
        rivalry: {
          kind: 'ok',
          rivalry: rivalryPayload({
            opponent: { ...rivalryPayload().opponent, standing: null, points: 0 },
          }),
        },
      }),
    )
    const panel = model.rivalry
    if (panel.kind !== 'rivalry') throw new Error('expected a rivalry panel')
    expect(panel.detail.them.standing).toBeNull()
  })
})

describe('the chart series is the server`s positions', () => {
  it('carries every point`s rank with the field it was out of', () => {
    const model = buildPlayerProfileModel(source({}))
    const panel = model.rankHistory
    if (panel.kind !== 'history') throw new Error('expected a history panel')
    expect(panel.series.map((point) => [point.rank, point.fieldSize])).toEqual([
      [9, 412],
      [2, 412],
    ])
  })

  it('carries the running total as a running total', () => {
    // NOT this matchweek's score. Contract 151's history carries that one, and
    // the profile draws both on one page.
    const model = buildPlayerProfileModel(source({}))
    const panel = model.rankHistory
    if (panel.kind !== 'history') throw new Error('expected a history panel')
    expect(panel.series.map((point) => point.cumulativePoints)).toEqual([133, 151])
  })

  it('keeps the server`s order rather than sorting by rank', () => {
    const model = buildPlayerProfileModel(
      source({
        rankHistory: {
          kind: 'ok',
          history: historyPayload({
            matchweeks: [
              { matchweekId: 'mw-12', ordinal: 12, label: 'Matchweek 12', cumulativePoints: 151, rank: 2, fieldSize: 412 },
              { matchweekId: 'mw-11', ordinal: 11, label: 'Matchweek 11', cumulativePoints: 133, rank: 9, fieldSize: 412 },
            ],
          }),
        },
      }),
    )
    const panel = model.rankHistory
    if (panel.kind !== 'history') throw new Error('expected a history panel')
    expect(panel.series.map((point) => point.ordinal)).toEqual([12, 11])
  })

  it('accepts an empty series as a season before its first settlement', () => {
    const model = buildPlayerProfileModel(
      source({ rankHistory: { kind: 'ok', history: historyPayload({ matchweeks: [] }) } }),
    )
    const panel = model.rankHistory
    if (panel.kind !== 'history') throw new Error('expected a history panel')
    expect(panel.series).toEqual([])
  })
})

describe('the mapper is pure', () => {
  it('carries the instant it was given rather than reading a clock', () => {
    expect(buildPlayerProfileModel(source({})).generatedAt).toBe(NOW)
  })

  it('produces the same model twice from the same source', () => {
    const input = source({})
    expect(buildPlayerProfileModel(input)).toEqual(buildPlayerProfileModel(input))
  })
})

/* ==========================================================================
   PINNING A RIVAL
   ========================================================================== */

describe('a pin is offered exactly where the write would accept it', () => {
  it('offers it where contract 151 answered, because that is the same boundary', () => {
    // `set_pinned_rival` requires `season_player_reach = 'profile'`, and so
    // does the profile read. A control drawn here is a control the write will
    // accept — the page evaluates no boundary of its own.
    expect(buildPlayerProfileModel(source({})).pin).toEqual({ kind: 'not-pinned' })
    expect(
      buildPlayerProfileModel(source({ pinned: { kind: 'ok', pinned: true } })).pin,
    ).toEqual({ kind: 'pinned' })
  })

  it('offers nothing where the profile was refused', () => {
    // The reader may plot this player and compare with them — contract 192 needs
    // only `compare` — and may NOT pin them. Two boundaries, and the narrower
    // one governs the control.
    const model = buildPlayerProfileModel(source({ profile: { kind: 'refused' } }))
    expect(model.pin).toEqual({ kind: 'not-offered' })
    // And the two panels that ARE permitted are untouched.
    expect(model.rankHistory.kind).toBe('history')
    expect(model.rivalry.kind).toBe('rivalry')
  })

  it('offers nothing on the reader’s own profile', () => {
    // `set_pinned_rival` raises 23514 in terms — "You cannot pin yourself as a
    // rival" — so there is no control rather than one that errors.
    expect(buildPlayerProfileModel(source({ isYou: true })).pin).toEqual({
      kind: 'not-offered',
    })
  })

  it('offers nothing where the host supplied no pin state at all', () => {
    expect(buildPlayerProfileModel(source({ pinned: null })).pin).toEqual({
      kind: 'not-offered',
    })
  })

  it('says `unavailable` rather than `not-pinned` when the read failed', () => {
    // THE ASSERTION THIS BLOCK EXISTS FOR. `false` from a failed read is a
    // choice the player never made, and a control drawn from it toggles the
    // WRONG WAY the first time they press it.
    expect(buildPlayerProfileModel(source({ pinned: { kind: 'failed' } })).pin).toEqual({
      kind: 'unavailable',
    })
  })
})
