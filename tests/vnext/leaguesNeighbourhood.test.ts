import { describe, expect, it } from 'vitest'
import { buildLeaguesModel } from '../../src/vnext/integration/leagues/buildLeaguesModel'
import type { LeaguesSource } from '../../src/vnext/integration/leagues/leaguesSource'
import { leaguePlayerIsOpen } from '../../src/vnext/models/leagues'
import type { LeaguesNeighbourhood } from '../../src/vnext/models/leagues'
import type {
  SeasonLeaderboardPage,
  SeasonLeaderboardRow,
} from '../../src/services/supabase/seasonLeaderboardModel'
import type {
  SeasonLeaderboardNeighbourhood,
  SeasonNeighbourRow,
} from '../../src/services/supabase/seasonLeaderboardNeighbourhoodModel'
import { at } from '../support/indexed'

/**
 * CONTRACT 183 / `MIG-UI-18` THROUGH THE STAGE 9 MAPPER.
 *
 * The mapper's whole job here is a JOIN, and a join is exactly the kind of code
 * that looks right and is wrong. So these cases are about the join rather than
 * about field copying:
 *
 *   1. IDENTITY IS RECOVERED BY `position` AND NEVER BY NAME. The worlds below
 *      give two entrants the SAME DISPLAY NAME at different positions, which is
 *      legal, and which a name join cannot survive.
 *   2. A NEIGHBOUR THE PAGE CANNOT IDENTIFY IS CLOSED, not invented open and
 *      not dropped.
 *   3. NO GAP, RANK, EDGE OR TOTAL IS DERIVED. The sources state values that
 *      DISAGREE with the arithmetic, so a mapper that recomputed would produce
 *      a plausible answer here rather than an identical one.
 *
 * Pure throughout: no network, no clock, no React.
 */

const NOW = '2027-11-14T19:20:00.000Z'

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

function leaderboard(overrides: Partial<SeasonLeaderboardPage> = {}): SeasonLeaderboardPage {
  return {
    rows: [globalRow()],
    totalCount: 412,
    pageSize: 25,
    hasMore: true,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

function neighbourRow(overrides: Partial<SeasonNeighbourRow> = {}): SeasonNeighbourRow {
  return {
    displayName: 'Isla McNair',
    points: 101,
    rank: 315,
    matchweeksPlayed: 9,
    tied: false,
    position: 315,
    isYou: false,
    pointsFromYou: 5,
    ...overrides,
  }
}

function window(
  overrides: Partial<SeasonLeaderboardNeighbourhood> = {},
): SeasonLeaderboardNeighbourhood {
  return {
    rows: [neighbourRow()],
    you: null,
    window: 3,
    totalCount: 412,
    atTop: false,
    atBottom: false,
    ...overrides,
  }
}

function source(overrides: Partial<LeaguesSource> = {}): LeaguesSource {
  return {
    watchedRivalIds: [],
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
    neighbourhood: null,
    leagues: [],
    league: null,
    movement: null,
    ...overrides,
  }
}

function chaseOf(overrides: Partial<LeaguesSource>): LeaguesNeighbourhood | null {
  const model = buildLeaguesModel(source(overrides))
  return model.global?.neighbourhood ?? null
}

describe('the chase, built from contract 183 beside contract 191', () => {
  it('is null when the window did not land, which is not an empty chase', () => {
    expect(chaseOf({ neighbourhood: null })).toBeNull()
  })

  it('carries the server rows, gaps, total and edges without recomputing any', () => {
    const chase = chaseOf({
      neighbourhood: window({
        rows: [
          neighbourRow({ displayName: 'Isla', position: 315, points: 101, pointsFromYou: 5 }),
          neighbourRow({
            displayName: 'You',
            position: 318,
            rank: 318,
            points: 96,
            pointsFromYou: 0,
            isYou: true,
          }),
          neighbourRow({
            displayName: 'Ewan',
            position: 321,
            rank: 321,
            points: 91,
            pointsFromYou: -5,
          }),
        ],
        totalCount: 412,
        atTop: false,
        atBottom: false,
      }),
    })

    expect(chase?.rows).toHaveLength(3)
    expect(chase?.totalCount).toBe(412)
    expect(chase?.rows.map((row) => row.pointsFromYou)).toEqual([5, 0, -5])
    expect(chase?.rows.map((row) => row.position)).toEqual([315, 318, 321])
  })

  it('carries a gap that disagrees with the arithmetic, because the server owns it', () => {
    // If the mapper recomputed from `points`, this would come back as 5 rather
    // than 999 and the assertion would fail. That is the point of the case.
    const chase = chaseOf({
      neighbourhood: window({
        rows: [neighbourRow({ points: 101, pointsFromYou: 999 })],
      }),
    })

    expect(at(chase?.rows ?? [], 0).pointsFromYou).toBe(999)
  })

  it('carries the edges the server stated rather than counting rows', () => {
    // ONE row above the caller and the server says this is the top. A mapper
    // that inferred `atTop` from the row count against the window size would
    // draw an identical strip and be wrong about the one thing that matters.
    const chase = chaseOf({
      neighbourhood: window({
        rows: [
          neighbourRow({ displayName: 'You', position: 1, rank: 1, isYou: true, pointsFromYou: 0 }),
          neighbourRow({ displayName: 'Callum', position: 2, rank: 2, pointsFromYou: -5 }),
        ],
        atTop: true,
        atBottom: false,
      }),
    })

    expect(chase?.atTop).toBe(true)
    expect(chase?.atBottom).toBe(false)
  })

  it('recovers identity for a neighbour the page holds, keyed on position', () => {
    const chase = chaseOf({
      global: leaderboard({
        rows: [
          globalRow({
            displayName: 'Rhona Buchanan',
            position: 1,
            rank: 1,
            playerRef: 'ref-rhona',
            reach: 'compare',
          }),
        ],
      }),
      neighbourhood: window({
        rows: [neighbourRow({ displayName: 'Rhona Buchanan', position: 1, rank: 1 })],
      }),
    })

    const row = at(chase?.rows ?? [], 0)
    expect(row.player.ref).toBe('ref-rhona')
    expect(leaguePlayerIsOpen(row.player)).toBe(true)
  })

  it('closes a neighbour the page cannot identify rather than inventing a door', () => {
    const chase = chaseOf({
      // Page one is ranks 1 to 1. The window is around position 318, so the two
      // sets do not intersect — the ordinary case for a mid-table player.
      global: leaderboard({ rows: [globalRow({ position: 1, rank: 1 })] }),
      neighbourhood: window({ rows: [neighbourRow({ position: 315, rank: 315 })] }),
    })

    const row = at(chase?.rows ?? [], 0)
    expect(row.player.ref).toBeNull()
    expect(leaguePlayerIsOpen(row.player)).toBe(false)
    expect(row.player.destination).toEqual({ kind: 'closed', reason: 'not-stated' })
    // It is still SHOWN. A neighbour with no door is a name and a gap, which is
    // the whole content of the chase; dropping it would empty the strip.
    expect(row.player.displayName).toBe('Isla McNair')
  })

  it('joins on position and never on display name', () => {
    // THE BINDING CASE. Two entrants legitimately share a display name. The one
    // on page one is openable; the one in the window at another position is
    // not. A name join hands the second the first one's reference and opens a
    // profile belonging to somebody else.
    const chase = chaseOf({
      global: leaderboard({
        rows: [
          globalRow({
            displayName: 'Sam Docherty',
            position: 2,
            rank: 2,
            playerRef: 'ref-sam-the-second',
            reach: 'compare',
          }),
        ],
      }),
      neighbourhood: window({
        rows: [
          neighbourRow({ displayName: 'Sam Docherty', position: 316, rank: 316 }),
          neighbourRow({ displayName: 'Sam Docherty', position: 2, rank: 2, pointsFromYou: 108 }),
        ],
      }),
    })

    const stranger = at(chase?.rows ?? [], 0)
    const known = at(chase?.rows ?? [], 1)

    expect(stranger.player.ref).toBeNull()
    expect(leaguePlayerIsOpen(stranger.player)).toBe(false)

    expect(known.player.ref).toBe('ref-sam-the-second')
    expect(leaguePlayerIsOpen(known.player)).toBe(true)
  })

  it('identifies the caller from the pinned row, which is usually off the page', () => {
    const chase = chaseOf({
      global: leaderboard({
        rows: [globalRow({ position: 1, rank: 1 })],
        you: {
          displayName: 'Nicky Gregal',
          points: 96,
          rank: 318,
          matchweeksPlayed: 9,
          tied: false,
          position: 318,
          playerRef: 'ref-you',
          reach: 'self',
          playerId: 'player-you',
        },
      }),
      neighbourhood: window({
        rows: [
          neighbourRow({
            displayName: 'Nicky Gregal',
            position: 318,
            rank: 318,
            isYou: true,
            pointsFromYou: 0,
          }),
        ],
      }),
    })

    const row = at(chase?.rows ?? [], 0)
    expect(row.isYou).toBe(true)
    expect(row.player.destination).toEqual({ kind: 'you' })
  })

  it('marks the caller as themselves even where the page never held their row', () => {
    // A season where the pinned row failed to arrive but the window did. The
    // caller must still be drawn as themselves rather than as a stranger who
    // happens to be adjacent.
    const chase = chaseOf({
      global: leaderboard({ rows: [globalRow({ position: 1, rank: 1 })], you: null }),
      neighbourhood: window({
        rows: [
          neighbourRow({ position: 318, rank: 318, isYou: true, pointsFromYou: 0 }),
        ],
      }),
    })

    expect(at(chase?.rows ?? [], 0).player.destination).toEqual({ kind: 'you' })
  })

  it('keeps a tie as the server stated it, sharing a rank and never a position', () => {
    const chase = chaseOf({
      neighbourhood: window({
        rows: [
          neighbourRow({ displayName: 'Ada', position: 315, rank: 315, tied: true }),
          neighbourRow({ displayName: 'Bea', position: 316, rank: 315, tied: true }),
        ],
      }),
    })

    expect(chase?.rows.map((row) => row.rank)).toEqual([315, 315])
    expect(chase?.rows.map((row) => row.position)).toEqual([315, 316])
    expect(chase?.rows.every((row) => row.tied)).toBe(true)
  })

  it('is absent entirely when the season table itself did not answer', () => {
    // No table, no chase. The chase hangs off the global table, so a season
    // that could not be read has nowhere to put one — and a strip floating
    // above a missing table would be the second thing to explain.
    const model = buildLeaguesModel(source({ global: null, neighbourhood: window() }))
    expect(model.global).toBeNull()
  })
})
