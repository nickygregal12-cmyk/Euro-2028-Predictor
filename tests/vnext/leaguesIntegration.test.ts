import { describe, expect, it } from 'vitest'
import { buildLeaguesModel } from '../../src/vnext/integration/leagues/buildLeaguesModel'
import type { LeaguesSource } from '../../src/vnext/integration/leagues/leaguesSource'
import {
  leaguePlayerIsOpen,
  leagueRowKey,
  leaguesKnownEmpty,
  leaguesSwitchable,
  movementLabel,
  selectedLeague,
} from '../../src/vnext/models/leagues'
import type { LeaguesModel } from '../../src/vnext/models/leagues'
import type {
  SeasonLeaderboardPage,
  SeasonLeaderboardRow,
  SeasonPlayerReach,
} from '../../src/services/supabase/seasonLeaderboardModel'
import type {
  SeasonLeagueStandingsPage,
  SeasonLeagueStandingsRow,
} from '../../src/services/supabase/seasonLeagueStandingsModel'
import type { SeasonLeagueMovement } from '../../src/services/supabase/seasonLeagueMovementModel'
import type { GameLeague } from '../../src/services/supabase/gameLeagues'
import { at, first } from '../support/indexed'

/**
 * THE STAGE 9 MAPPING, TESTED AS TRUTH RATHER THAN AS SHAPE.
 *
 * Every case is a call to a pure mapper with a hand-built source. There is no
 * Supabase, no network, no auth, no React and no clock.
 *
 * WHAT THE ASSERTIONS ARE ABOUT. Almost none of them check that a field was
 * copied; a rename would be caught by the compiler. They check the things that
 * would be WRONG rather than merely different:
 *
 *   1. NO RANK IS EVER COMPUTED — not from points, not from array position,
 *      not by sorting. The sources below deliberately arrive out of rank order
 *      and with ties, so a mapper that renumbered would produce a plausible and
 *      wrong answer here rather than an identical one.
 *   2. A PERMISSION IS NEVER INFERRED FROM AN ID. `reach` decides; the id is
 *      only the address. A `profile` reach with no id is closed, and a
 *      `compare` reach with an id is still closed.
 *   3. TWO PLAYERS SHARING A DISPLAY NAME STAY TWO PLAYERS.
 *   4. Movement never exists over an unsettled matchweek.
 *   5. The season's rank and a league's rank are never reconciled with one
 *      another — the same player carries both, and both survive.
 */

const NOW = '2027-11-14T19:20:00.000Z'

/* ==========================================================================
   BUILDERS
   ========================================================================== */

function globalRow(overrides: Partial<SeasonLeaderboardRow> = {}): SeasonLeaderboardRow {
  return {
    displayName: 'Rhona Buchanan',
    points: 214,
    rank: 1,
    matchweeksPlayed: 12,
    tied: false,
    position: 1,
    isYou: false,
    playerRef: 'ref-rhona',
    reach: 'compare',
    playerId: null,
    ...overrides,
  }
}

function leaderboard(
  overrides: Partial<SeasonLeaderboardPage> = {},
): SeasonLeaderboardPage {
  return {
    rows: [globalRow()],
    totalCount: 1,
    pageSize: 25,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

function leagueRow(
  overrides: Partial<SeasonLeagueStandingsRow> = {},
): SeasonLeagueStandingsRow {
  return {
    userId: 'user-jamie',
    displayName: 'Jamie Ferguson-Whyte',
    points: 209,
    rank: 1,
    matchweeksPlayed: 12,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: false,
    hasEntry: true,
    ...overrides,
  }
}

function standings(
  overrides: Partial<SeasonLeagueStandingsPage> = {},
): SeasonLeagueStandingsPage {
  return {
    rows: [leagueRow()],
    totalCount: 1,
    pageSize: 25,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

function league(overrides: Partial<GameLeague> = {}): GameLeague {
  return {
    id: 'league-sunday-club',
    name: 'Sunday Club',
    inviteCode: 'ABCD12',
    memberCount: 8,
    isOwner: false,
    ownerName: 'Jamie Ferguson-Whyte',
    lastActivityAt: null,
    ...overrides,
  }
}

function source(overrides: Partial<LeaguesSource> = {}): LeaguesSource {
  return {
    generatedAt: NOW,
    context: {
      tournamentId: 'tournament-1',
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      gameName: 'Match Predictor',
      gameCompetitionId: 'game-competition-1',
    },
    selectedLeagueId: null,
    global: leaderboard(),
    leagues: [],
    league: null,
    movement: null,
    ...overrides,
  }
}

/** The season table, with the rows given. */
function seasonModel(rows: readonly SeasonLeaderboardRow[], page: Partial<SeasonLeaderboardPage> = {}) {
  return buildLeaguesModel(
    source({ global: leaderboard({ rows: [...rows], totalCount: rows.length, ...page }) }),
  )
}

/** One private league's table, with the rows given. */
function leagueModel(
  rows: readonly SeasonLeagueStandingsRow[],
  extra: Partial<LeaguesSource> = {},
) {
  return buildLeaguesModel(
    source({
      selectedLeagueId: 'league-sunday-club',
      global: null,
      leagues: [league()],
      league: standings({ rows: [...rows], totalCount: rows.length }),
      ...extra,
    }),
  )
}

function globalRows(model: LeaguesModel) {
  const table = model.global
  if (table === null) throw new Error('expected a season table')
  return table.rows
}

function privateRows(model: LeaguesModel) {
  const table = model.private
  if (table === null) throw new Error('expected a league table')
  return table.rows
}

/* ==========================================================================
   1. RANK IS NEVER COMPUTED
   ========================================================================== */

describe('the mapper never computes a rank', () => {
  it('carries tied ranks exactly as the server sent them', () => {
    // Four players share rank 2 and the next row is rank 6. `index + 1` gives
    // 1,2,3,4,5,6 — plausible, and wrong in five places.
    const model = seasonModel([
      globalRow({ rank: 1, position: 1, playerRef: 'ref-a', displayName: 'A' }),
      globalRow({ rank: 2, tied: true, position: 2, playerRef: 'ref-b', displayName: 'B' }),
      globalRow({ rank: 2, tied: true, position: 3, playerRef: 'ref-c', displayName: 'C' }),
      globalRow({ rank: 2, tied: true, position: 4, playerRef: 'ref-d', displayName: 'D' }),
      globalRow({ rank: 2, tied: true, position: 5, playerRef: 'ref-e', displayName: 'E' }),
      globalRow({ rank: 6, position: 6, playerRef: 'ref-f', displayName: 'F' }),
    ])

    expect(globalRows(model).map((row) => row.rank)).toEqual([1, 2, 2, 2, 2, 6])
    expect(globalRows(model).map((row) => row.tied)).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ])
  })

  it('does not reorder rows, even when points disagree with the order', () => {
    // A server may legitimately order by a stored tie-break rather than by
    // points. A mapper that sorted would silently overrule it.
    const model = seasonModel([
      globalRow({ rank: 1, position: 1, points: 200, playerRef: 'ref-a', displayName: 'A' }),
      globalRow({ rank: 2, position: 2, points: 200, playerRef: 'ref-b', displayName: 'B' }),
      globalRow({ rank: 3, position: 3, points: 214, playerRef: 'ref-c', displayName: 'C' }),
    ])

    expect(globalRows(model).map((row) => row.player.displayName)).toEqual(['A', 'B', 'C'])
    expect(globalRows(model).map((row) => row.points)).toEqual([200, 200, 214])
  })

  it('keeps position and rank as two separate numbers', () => {
    const model = seasonModel([
      globalRow({ rank: 318, position: 26, playerRef: 'ref-a' }),
    ])

    const row = first(globalRows(model))
    expect(row.rank).toBe(318)
    expect(row.position).toBe(26)
  })

  it('carries the caller`s own row even when it is not among the rows', () => {
    // The commonest real shape: 412 entrants, one page shown, the reader 318th.
    const model = buildLeaguesModel(
      source({
        global: leaderboard({
          rows: [globalRow({ rank: 1, position: 1, playerRef: 'ref-a' })],
          totalCount: 412,
          hasMore: true,
          you: {
            displayName: 'Nicky Gregal',
            points: 96,
            rank: 318,
            matchweeksPlayed: 9,
            tied: false,
            position: 318,
            playerRef: 'ref-you',
            reach: 'self',
            playerId: null,
          },
        }),
      }),
    )

    const table = model.global
    expect(table?.you?.rank).toBe(318)
    expect(table?.you?.isYou).toBe(true)
    expect(table?.hasMore).toBe(true)
    expect(table?.totalCount).toBe(412)
    // And it is not smuggled into the rows.
    expect(globalRows(model)).toHaveLength(1)
  })

  it('does not derive hasMore from the counts', () => {
    // A server holding a page back while `shown === total` is exactly the case
    // where a derived `hasMore` would tell a player there is nothing further.
    const model = seasonModel([globalRow()], { totalCount: 1, hasMore: true })
    expect(model.global?.hasMore).toBe(true)
  })
})

/* ==========================================================================
   2. PERMISSION IS THE SERVER'S ANSWER
   ========================================================================== */

describe('a destination is the server`s permission, never an inference', () => {
  const cases: readonly {
    reach: SeasonPlayerReach
    playerId: string | null
    expected: string
  }[] = [
    { reach: 'profile', playerId: 'player-1', expected: 'open' },
    // "You may look" with nowhere to look. The server said one and not the
    // other, and a browser that concluded a permission from the presence of an
    // id would open a door it has no handle for.
    { reach: 'profile', playerId: null, expected: 'closed' },
    // AN ID WITHOUT THE REACH IS STILL CLOSED — the mirror case, and the one a
    // `playerId !== null` test would get wrong.
    { reach: 'compare', playerId: 'player-1', expected: 'closed' },
    { reach: 'compare', playerId: null, expected: 'closed' },
    { reach: 'name-only', playerId: null, expected: 'closed' },
    { reach: 'self', playerId: null, expected: 'you' },
  ]

  for (const { reach, playerId, expected } of cases) {
    it(`maps reach ${reach} with ${playerId === null ? 'no id' : 'an id'} to ${expected}`, () => {
      const model = seasonModel([globalRow({ reach, playerId })])
      expect(first(globalRows(model)).player.destination.kind).toBe(expected)
    })
  }

  it('gives an unaddressed profile a different reason from a stranger', () => {
    const unaddressed = first(
      globalRows(seasonModel([globalRow({ reach: 'profile', playerId: null })])),
    ).player.destination
    const stranger = first(
      globalRows(seasonModel([globalRow({ reach: 'compare', playerId: null })])),
    ).player.destination

    expect(unaddressed).toEqual({ kind: 'closed', reason: 'not-stated' })
    expect(stranger).toEqual({ kind: 'closed', reason: 'not-shared' })
  })

  it('never puts an id on a row the caller may not open', () => {
    // The structural half of the rule: there is nothing to build a link from.
    const model = seasonModel([
      globalRow({ reach: 'compare', playerId: 'player-leaked', playerRef: 'ref-a' }),
      globalRow({ reach: 'profile', playerId: null, playerRef: 'ref-b', position: 2, rank: 2 }),
      globalRow({ reach: 'name-only', playerId: null, playerRef: null, position: 3, rank: 3 }),
    ])

    for (const row of globalRows(model)) {
      expect(leaguePlayerIsOpen(row.player)).toBe(false)
      expect(JSON.stringify(row.player.destination)).not.toContain('player-leaked')
    }
  })

  it('treats the caller as `you` whichever way the server said so', () => {
    const byFlag = first(globalRows(seasonModel([globalRow({ isYou: true, reach: 'compare' })])))
    const byReach = first(globalRows(seasonModel([globalRow({ isYou: false, reach: 'self' })])))

    expect(byFlag.player.destination.kind).toBe('you')
    expect(byReach.player.destination.kind).toBe('you')
  })
})

/* ==========================================================================
   3. TWO PLAYERS WITH ONE NAME
   ========================================================================== */

describe('a display name is a label and never an identity', () => {
  it('keeps two players with the same name distinguishable and separately addressable', () => {
    const model = seasonModel([
      globalRow({
        displayName: 'Sam Docherty',
        playerRef: 'ref-sam-a',
        reach: 'profile',
        playerId: 'player-sam-a',
        rank: 1,
        position: 1,
      }),
      globalRow({
        displayName: 'Sam Docherty',
        playerRef: 'ref-sam-b',
        reach: 'compare',
        playerId: null,
        rank: 2,
        position: 2,
      }),
    ])

    const [a, b] = [at(globalRows(model), 0), at(globalRows(model), 1)]
    expect(a.player.displayName).toBe(b.player.displayName)
    expect(a.player.ref).not.toBe(b.player.ref)
    expect(leaguePlayerIsOpen(a.player)).toBe(true)
    expect(leaguePlayerIsOpen(b.player)).toBe(false)
    // The row keys differ, so React cannot reuse one person's row for another.
    expect(leagueRowKey(a.player, a.position)).not.toBe(leagueRowKey(b.player, b.position))
  })

  it('falls back to the position, not the name, when there is no reference', () => {
    const model = seasonModel([
      globalRow({ displayName: 'Sam', playerRef: null, rank: 1, position: 1 }),
      globalRow({ displayName: 'Sam', playerRef: null, rank: 2, position: 2 }),
    ])

    const keys = globalRows(model).map((row) => leagueRowKey(row.player, row.position))
    expect(new Set(keys).size).toBe(2)
    for (const key of keys) expect(key).not.toContain('Sam')
  })
})

/* ==========================================================================
   4. MOVEMENT ONLY EXISTS OVER A SETTLED MATCHWEEK
   ========================================================================== */

function movement(overrides: Partial<SeasonLeagueMovement> = {}): SeasonLeagueMovement {
  return {
    leagueId: 'league-sunday-club',
    matchweek: { id: 'mw-12', ordinal: 12, label: 'Matchweek 12' },
    settled: true,
    serverNow: NOW,
    members: [
      {
        userId: 'user-jamie',
        displayName: 'Jamie Ferguson-Whyte',
        isSelf: false,
        pointsBefore: 190,
        pointsAfter: 209,
        pointsThisMatchweek: 19,
        rankBefore: 3,
        rankAfter: 1,
        movement: 2,
        gapToLeaderBefore: 12,
        gapToLeaderAfter: 0,
      },
    ],
    ...overrides,
  }
}

describe('movement', () => {
  it('reaches a row when the matchweek settled', () => {
    const model = leagueModel([leagueRow()], { movement: movement() })
    expect(first(privateRows(model)).movement).toEqual({
      matchweekLabel: 'Matchweek 12',
      places: 2,
    })
    expect(model.private?.movementSettled).toBe(true)
  })

  it('reaches nobody when the matchweek has not settled, even with rows present', () => {
    // The payload carries members AND says it is unsettled. Contract 150
    // forbids rendering them, so they must not survive the mapper at all —
    // a component cannot draw what it was never given.
    const model = leagueModel([leagueRow()], {
      movement: movement({ settled: false }),
    })

    expect(first(privateRows(model)).movement).toBeNull()
    expect(model.private?.movementSettled).toBe(false)
  })

  it('reaches nobody when the settled matchweek has no label', () => {
    const model = leagueModel([leagueRow()], {
      movement: movement({ matchweek: null }),
    })
    expect(first(privateRows(model)).movement).toBeNull()
    // AND THE FLAG AGREES WITH THE MAP. A surface reads the flag to decide
    // whether to DRAW the column and the map to fill it, so a disagreement here
    // produces a "Moved" column in which every row is a dash — literally the
    // column of em-dashes standing in for "nothing has settled yet".
    expect(model.private?.movementSettled).toBe(false)
  })

  it('copies the server`s sign rather than recomputing it from the two ranks', () => {
    // The server says a climb of 2; the ranks beside it say 5. Two ways of
    // producing one number is one chance for them to disagree, and the
    // server's is the authority.
    const model = leagueModel([leagueRow()], {
      movement: movement({
        members: [
          {
            userId: 'user-jamie',
            displayName: 'Jamie Ferguson-Whyte',
            isSelf: false,
            pointsBefore: 190,
            pointsAfter: 209,
            pointsThisMatchweek: 19,
            rankBefore: 6,
            rankAfter: 1,
            movement: 2,
            gapToLeaderBefore: 12,
            gapToLeaderAfter: 0,
          },
        ],
      }),
    })

    expect(first(privateRows(model)).movement?.places).toBe(2)
  })

  it('leaves a member the movement payload did not mention with none', () => {
    const model = leagueModel(
      [leagueRow(), leagueRow({ userId: 'user-bea', displayName: 'Bea', rank: 2, position: 2 })],
      { movement: movement() },
    )

    expect(at(privateRows(model), 0).movement).not.toBeNull()
    expect(at(privateRows(model), 1).movement).toBeNull()
    // …and the table still knows the matchweek settled, so the surface can tell
    // "did not move" from "nothing has settled".
    expect(model.private?.movementSettled).toBe(true)
  })

  it('is never listed as unavailable, because absent is its ordinary state', () => {
    const model = leagueModel([leagueRow()], { movement: null })
    expect(model.unavailable).toEqual([])
  })

  it('says the right words for a climb, a fall and a hold', () => {
    expect(movementLabel({ matchweekLabel: 'Matchweek 12', places: 3 })).toBe('up 3 places')
    expect(movementLabel({ matchweekLabel: 'Matchweek 12', places: 1 })).toBe('up 1 place')
    expect(movementLabel({ matchweekLabel: 'Matchweek 12', places: -2 })).toBe('down 2 places')
    expect(movementLabel({ matchweekLabel: 'Matchweek 12', places: -1 })).toBe('down 1 place')
    expect(movementLabel({ matchweekLabel: 'Matchweek 12', places: 0 })).toBe('no change')
  })
})

/* ==========================================================================
   5. TWO TABLES, TWO RANK AUTHORITIES
   ========================================================================== */

describe('the two tables are kept apart', () => {
  it('builds exactly one of them per visit', () => {
    const global = buildLeaguesModel(source())
    expect(global.global).not.toBeNull()
    expect(global.private).toBeNull()
    expect(global.scope).toEqual({ kind: 'global' })

    const inLeague = leagueModel([leagueRow()])
    expect(inLeague.global).toBeNull()
    expect(inLeague.private).not.toBeNull()
    expect(inLeague.scope).toEqual({ kind: 'private', leagueId: 'league-sunday-club' })
  })

  it('never reconciles a league rank with a season rank for the same person', () => {
    // The same player is 318th in the season and 2nd in their league. Both are
    // true; a mapper that "corrected" either has asserted a ranking nobody
    // computed.
    const season = seasonModel([
      globalRow({ displayName: 'Nicky Gregal', playerRef: 'ref-you', rank: 318, position: 26, isYou: true }),
    ])
    const inLeague = leagueModel([
      leagueRow({ userId: 'user-you', displayName: 'Nicky Gregal', rank: 2, position: 2, isYou: true }),
    ])

    expect(first(globalRows(season)).rank).toBe(318)
    expect(first(privateRows(inLeague)).rank).toBe(2)
  })

  it('carries a league member`s owner and entry facts', () => {
    const model = leagueModel([
      leagueRow({ isOwner: true, hasEntry: false, points: 0, matchweeksPlayed: 0 }),
    ])
    const row = first(privateRows(model))
    expect(row.isOwner).toBe(true)
    expect(row.hasEntry).toBe(false)
  })

  it('treats every league member as openable, because contract 151 says a co-member is', () => {
    const model = leagueModel([
      leagueRow({ userId: 'user-jamie' }),
      leagueRow({ userId: 'user-you', isYou: true, rank: 2, position: 2 }),
    ])

    expect(at(privateRows(model), 0).player.destination).toEqual({
      kind: 'open',
      playerId: 'user-jamie',
    })
    expect(at(privateRows(model), 1).player.destination).toEqual({ kind: 'you' })
  })

  it('keys a league row by the account id and never by the display name', () => {
    const model = leagueModel([
      leagueRow({ userId: 'user-a', displayName: 'Sam', rank: 1, position: 1 }),
      leagueRow({ userId: 'user-b', displayName: 'Sam', rank: 2, position: 2 }),
    ])

    const keys = privateRows(model).map((row) => leagueRowKey(row.player, row.position))
    expect(keys).toEqual(['user-a', 'user-b'])
  })
})

/* ==========================================================================
   6. THE LEAGUE LIST AND THE CHOOSER
   ========================================================================== */

describe('the league list', () => {
  it('is read in both scopes, so the switcher exists on the season table too', () => {
    const model = buildLeaguesModel(source({ leagues: [league(), league({ id: 'league-office', name: 'The Office' })] }))
    expect(model.scope.kind).toBe('global')
    expect(model.leagues.map((entry) => entry.name)).toEqual(['Sunday Club', 'The Office'])
    expect(leaguesSwitchable(model)).toBe(true)
  })

  it('leaves the page unswitchable when the player is in no league', () => {
    expect(leaguesSwitchable(buildLeaguesModel(source({ leagues: [] })))).toBe(false)
  })

  it('stays switchable inside a league even when the list did not answer', () => {
    // Otherwise the reader is standing in a league the page cannot name, with
    // no control to leave it by. Standing in a private league IS the second
    // choice, so "Season" is a real one.
    const stranded = buildLeaguesModel(
      source({
        selectedLeagueId: 'league-sunday-club',
        global: null,
        leagues: null,
        league: standings(),
      }),
    )
    expect(stranded.leagues).toEqual([])
    expect(leaguesSwitchable(stranded)).toBe(true)
  })

  it('tells an empty list apart from an unread one', () => {
    // THE TWO LOOK IDENTICAL IN `leagues` AND ARE NOT THE SAME SENTENCE. Only
    // the first entitles a surface to say "you are not in a private league".
    const answeredNone = buildLeaguesModel(source({ leagues: [] }))
    const unread = buildLeaguesModel(source({ leagues: null }))

    expect(answeredNone.leagues).toEqual(unread.leagues)
    expect(answeredNone.leaguesKnown).toBe(true)
    expect(unread.leaguesKnown).toBe(false)
    expect(leaguesKnownEmpty(answeredNone)).toBe(true)
    expect(leaguesKnownEmpty(unread)).toBe(false)
  })

  it('does not call a player league-less merely because they have leagues', () => {
    expect(leaguesKnownEmpty(buildLeaguesModel(source({ leagues: [league()] })))).toBe(false)
  })

  it('names a league from the list rather than inventing one from the id', () => {
    const named = leagueModel([leagueRow()])
    expect(named.private?.name).toBe('Sunday Club')
    expect(selectedLeague(named)?.name).toBe('Sunday Club')

    const unnamed = buildLeaguesModel(
      source({
        selectedLeagueId: 'league-sunday-club',
        global: null,
        leagues: null,
        league: standings(),
      }),
    )
    expect(unnamed.private?.name).toBe('This league')
    expect(unnamed.private?.leagueId).toBe('league-sunday-club')
    // And it does not pretend the name is known.
    expect(selectedLeague(unnamed)).toBeNull()
  })

  it('carries no invite code, owner name or activity time into the model', () => {
    // The list read supplies them; a standings surface has no business with an
    // invite code, and a model that carried one is a model somebody renders.
    const model = buildLeaguesModel(source({ leagues: [league()] }))
    expect(JSON.stringify(model)).not.toContain('ABCD12')
    expect(Object.keys(first(model.leagues))).toEqual(['id', 'name', 'memberCount'])
  })
})

/* ==========================================================================
   7. WHAT COULD NOT BE ANSWERED
   ========================================================================== */

describe('the unavailable list', () => {
  it('names an unread league list', () => {
    expect(buildLeaguesModel(source({ leagues: null })).unavailable).toEqual([
      'your private leagues',
    ])
  })

  it('names an unread season table', () => {
    expect(buildLeaguesModel(source({ global: null })).unavailable).toEqual([
      'the season table',
    ])
  })

  it('names an unread league table', () => {
    const model = buildLeaguesModel(
      source({ selectedLeagueId: 'league-sunday-club', global: null, leagues: [league()], league: null }),
    )
    expect(model.unavailable).toEqual(['this league’s table'])
    expect(model.private).toBeNull()
  })

  it('does not report the table the visit did not ask for', () => {
    // A league visit reads no season table. Reporting "the season table" as
    // unavailable would apologise for something nobody asked for.
    const model = leagueModel([leagueRow()])
    expect(model.unavailable).toEqual([])
  })

  it('stays empty on an ordinary complete visit', () => {
    expect(buildLeaguesModel(source({ leagues: [league()] })).unavailable).toEqual([])
  })
})

/* ==========================================================================
   8. THE MAPPER IS PURE
   ========================================================================== */

describe('the mapper is pure', () => {
  it('produces the same model twice from the same source', () => {
    const input = source({ leagues: [league()] })
    expect(buildLeaguesModel(input)).toEqual(buildLeaguesModel(input))
  })

  it('carries the instant it was given and reads no clock', () => {
    expect(buildLeaguesModel(source()).generatedAt).toBe(NOW)
  })

  it('carries the competition and the game without merging them', () => {
    const model = buildLeaguesModel(source())
    expect(model.context).toEqual({
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      gameName: 'Match Predictor',
    })
  })

  it('does not carry the tournament id or the game competition id into presentation', () => {
    // They address reads; they are not facts a table draws, and a model that
    // carried them is a model a surface can leak them from.
    const model = buildLeaguesModel(source())
    expect(JSON.stringify(model)).not.toContain('tournament-1')
    expect(JSON.stringify(model)).not.toContain('game-competition-1')
  })

  it('has no field a per-player read would fill', () => {
    // The N+1 prevention, held as a shape rather than as discipline: a row
    // carries a name, a reference and a destination, and nothing a profile
    // request would answer.
    const model = seasonModel([globalRow({ reach: 'profile', playerId: 'player-1' })])
    expect(Object.keys(first(globalRows(model)).player).sort()).toEqual([
      'destination',
      'displayName',
      'ref',
    ])
  })
})
