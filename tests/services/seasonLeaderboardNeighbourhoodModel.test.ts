import { describe, expect, it } from 'vitest'
import {
  mapSeasonLeaderboardNeighbourhood,
  type SeasonLeaderboardNeighbourhood,
} from '../../src/services/supabase/seasonLeaderboardNeighbourhoodModel'

/**
 * Contract 183 / `MIG-UI-18` decoding.
 *
 * WHAT THESE CASES ARE FOR. The likely defect in a window read is not "no
 * rows". It is a payload whose EDGES are wrong — a caller at the top of the
 * table rendered as though rows were missing, or a points gap this module
 * computed instead of decoding. Both produce a table that looks entirely
 * plausible and says something the server never did, so both are asserted here
 * rather than left to a surface test.
 */

/** A mid-table caller: three either side, nobody at an edge. */
function midTable(): unknown {
  return {
    rows: [
      row({ displayName: 'Ama', points: 91, rank: 409, position: 409, pointsFromYou: 3 }),
      row({ displayName: 'Bo', points: 90, rank: 410, position: 410, pointsFromYou: 2 }),
      row({ displayName: 'Cai', points: 89, rank: 411, position: 411, pointsFromYou: 1 }),
      row({
        displayName: 'You',
        points: 88,
        rank: 412,
        position: 412,
        pointsFromYou: 0,
        isYou: true,
      }),
      row({ displayName: 'Dee', points: 87, rank: 413, position: 413, pointsFromYou: -1 }),
      row({ displayName: 'Eze', points: 86, rank: 414, position: 414, pointsFromYou: -2 }),
      row({ displayName: 'Fay', points: 85, rank: 415, position: 415, pointsFromYou: -3 }),
    ],
    you: {
      displayName: 'You',
      points: 88,
      rank: 412,
      matchweeksPlayed: 22,
      tied: false,
      position: 412,
    },
    window: 3,
    totalCount: 5000,
    atTop: false,
    atBottom: false,
  }
}

function row(over: Record<string, unknown>): Record<string, unknown> {
  return {
    displayName: 'Someone',
    points: 0,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    pointsFromYou: 0,
    ...over,
  }
}

function decode(payload: unknown): SeasonLeaderboardNeighbourhood {
  return mapSeasonLeaderboardNeighbourhood(payload)
}

describe('the season leaderboard neighbourhood', () => {
  it('decodes the caller and the entrants either side of them', () => {
    const result = decode(midTable())

    expect(result.rows).toHaveLength(7)
    expect(result.you?.rank).toBe(412)
    expect(result.totalCount).toBe(5000)
    expect(result.window).toBe(3)

    const you = result.rows.find((entry) => entry.isYou)
    expect(you?.displayName).toBe('You')
    // The caller has no gap to themselves, and it is the server that says so.
    expect(you?.pointsFromYou).toBe(0)
  })

  it('keeps the sign of the gap, so ahead and behind are distinguishable', () => {
    const result = decode(midTable())

    const ahead = result.rows.filter((entry) => entry.pointsFromYou > 0)
    const behind = result.rows.filter((entry) => entry.pointsFromYou < 0)

    expect(ahead.map((entry) => entry.displayName)).toEqual(['Ama', 'Bo', 'Cai'])
    expect(behind.map((entry) => entry.displayName)).toEqual(['Dee', 'Eze', 'Fay'])
  })

  it('decodes the gap rather than recomputing it from points', () => {
    // A payload whose stated gap DISAGREES with the arithmetic. The server owns
    // the subtraction; a module that recomputed it here would silently correct
    // the server and the two would then diverge without anything failing.
    const payload = midTable() as { rows: Record<string, unknown>[] }
    payload.rows[0] = row({
      displayName: 'Ama',
      points: 91,
      rank: 409,
      position: 409,
      pointsFromYou: 999,
    })

    expect(decode(payload).rows[0]?.pointsFromYou).toBe(999)
  })

  it('carries the server position, which is the only key another read may join on', () => {
    const result = decode(midTable())
    expect(result.rows.map((entry) => entry.position)).toEqual([
      409, 410, 411, 412, 413, 414, 415,
    ])
  })

  it('exposes no identity, so a surface cannot open a neighbour from this payload', () => {
    const result = decode(midTable())
    for (const entry of result.rows) {
      expect(entry).not.toHaveProperty('playerRef')
      expect(entry).not.toHaveProperty('playerId')
      expect(entry).not.toHaveProperty('reach')
    }
  })

  it('reports the top of the table as the server stated it, not as missing rows', () => {
    const payload = {
      ...(midTable() as Record<string, unknown>),
      atTop: true,
      // Genuinely fewer rows above than the window asked for, which is what a
      // caller at rank 2 receives. Inferring the flag from this count is the
      // defect; the flag is the server's answer.
      rows: [
        row({ displayName: 'Top', points: 99, rank: 1, position: 1, pointsFromYou: 1 }),
        row({
          displayName: 'You',
          points: 98,
          rank: 2,
          position: 2,
          pointsFromYou: 0,
          isYou: true,
        }),
      ],
    }

    const result = decode(payload)
    expect(result.atTop).toBe(true)
    expect(result.atBottom).toBe(false)
    expect(result.rows).toHaveLength(2)
  })

  it('refuses a payload with no bounds flags rather than defaulting them', () => {
    const payload = midTable() as Record<string, unknown>
    delete payload.atTop

    expect(() => decode(payload)).toThrow(/bounds flags/)
  })

  it('refuses a row with no matchweeks played rather than rendering a zero', () => {
    const payload = midTable() as { rows: Record<string, unknown>[] }
    delete payload.rows[0]!.matchweeksPlayed

    expect(() => decode(payload)).toThrow(/invalid row/)
  })

  it('refuses a row whose gap is absent rather than deriving one', () => {
    const payload = midTable() as { rows: Record<string, unknown>[] }
    delete payload.rows[0]!.pointsFromYou

    expect(() => decode(payload)).toThrow(/invalid row/)
  })

  it('accepts an absent caller row, which is a season they hold no standing in', () => {
    const payload = { ...(midTable() as Record<string, unknown>), you: null, rows: [] }
    const result = decode(payload)

    expect(result.you).toBeNull()
    expect(result.rows).toEqual([])
  })

  it('refuses a payload with no rows list', () => {
    const payload = midTable() as Record<string, unknown>
    delete payload.rows

    expect(() => decode(payload)).toThrow(/missing its rows/)
  })

  it('refuses an out-of-range window rather than clamping it a second time', () => {
    // The SERVER clamps. A browser that clamped again would disagree with the
    // window the rows were actually built for.
    const payload = { ...(midTable() as Record<string, unknown>), window: 0 }
    expect(() => decode(payload)).toThrow(/invalid bounds/)
  })

  it('marks a tied entrant as tied', () => {
    const payload = midTable() as { rows: Record<string, unknown>[] }
    payload.rows[1] = row({
      displayName: 'Bo',
      points: 90,
      rank: 409,
      position: 410,
      pointsFromYou: 2,
      tied: true,
    })

    const result = decode(payload)
    expect(result.rows[1]?.tied).toBe(true)
    // Tied entrants share a RANK and never a position, which is what makes
    // position the safe join key and rank an unsafe one.
    expect(result.rows[0]?.rank).toBe(result.rows[1]?.rank)
    expect(result.rows[0]?.position).not.toBe(result.rows[1]?.position)
  })
})
