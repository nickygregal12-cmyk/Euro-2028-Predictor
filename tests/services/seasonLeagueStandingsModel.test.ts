import { describe, expect, it } from 'vitest'
import { mapSeasonLeagueStandingsPage } from '../../src/services/supabase/seasonLeagueStandingsModel'

function row(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-sam',
    displayName: 'Sam',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: false,
    hasEntry: true,
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    rows: [row()],
    totalCount: 1,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

describe('mapSeasonLeagueStandingsPage', () => {
  it('maps a page of rows', () => {
    const page = mapSeasonLeagueStandingsPage(
      payload({
        rows: [row(), row({ displayName: 'Alex', points: 84, tied: true, position: 2 })],
        totalCount: 2,
      }),
    )

    expect(page.rows.map((entry) => entry.displayName)).toEqual(['Sam', 'Alex'])
    expect(page.rows[1]?.tied).toBe(true)
    expect(page.totalCount).toBe(2)
  })

  it('carries the caller’s own row when the payload supplies one', () => {
    const page = mapSeasonLeagueStandingsPage(payload({ you: row({ position: 9, rank: 7 }) }))

    expect(page.you).toEqual({
      userId: 'user-sam',
    displayName: 'Sam',
      points: 84,
      rank: 7,
      matchweeksPlayed: 22,
      tied: false,
      position: 9,
      isOwner: false,
      hasEntry: true,
    })
  })

  it('treats an absent `you` as absent rather than as a zero row', () => {
    expect(mapSeasonLeagueStandingsPage(payload({ you: null })).you).toBeNull()
    expect(mapSeasonLeagueStandingsPage(payload({})).you).toBeNull()
  })

  it('keeps `hasEntry` false rather than defaulting it true', () => {
    // A member who joined the league and never entered the game is in the read
    // deliberately. Flattening them into an ordinary zero-point row is the
    // exact misrepresentation this field exists to prevent.
    const page = mapSeasonLeagueStandingsPage(
      payload({ rows: [row({ hasEntry: false, points: 0, matchweeksPlayed: 0 })] }),
    )

    expect(page.rows[0]?.hasEntry).toBe(false)
  })

  it('refuses a row with no matchweeks played rather than defaulting it to zero', () => {
    // ADR 0012 pairs points with matchweeks played. A default would render a
    // plausible table in which nobody had played anything.
    const { matchweeksPlayed: _omitted, ...withoutCount } = row()

    expect(() => mapSeasonLeagueStandingsPage(payload({ rows: [withoutCount] }))).toThrow(
      /malformed row/,
    )
  })

  it.each([
    ['a missing rank', { rank: undefined }],
    ['a non-integer points total', { points: 84.5 }],
    ['a missing owner flag', { isOwner: undefined }],
    ['a missing entry flag', { hasEntry: undefined }],
    ['a missing isYou flag', { isYou: undefined }],
  ])('refuses a row with %s', (_name, override) => {
    expect(() => mapSeasonLeagueStandingsPage(payload({ rows: [row(override)] }))).toThrow(
      /malformed row/,
    )
  })

  it('refuses a page claiming more rows and offering no cursor', () => {
    // It would strand the caller on page one while telling them otherwise.
    expect(() =>
      mapSeasonLeagueStandingsPage(payload({ hasMore: true, nextCursor: null })),
    ).toThrow(/malformed/)
  })

  it.each([
    ['no rows array', { rows: undefined }],
    ['a rows value that is not an array', { rows: {} }],
    ['a negative total', { totalCount: -1 }],
    ['a page size below one', { pageSize: 0 }],
    ['no hasMore flag', { hasMore: undefined }],
  ])('refuses a page with %s', (_name, override) => {
    expect(() => mapSeasonLeagueStandingsPage(payload(override))).toThrow(/malformed/)
  })

  it('refuses a payload that is not an object at all', () => {
    expect(() => mapSeasonLeagueStandingsPage(null)).toThrow(/malformed/)
    expect(() => mapSeasonLeagueStandingsPage([])).toThrow(/malformed/)
  })

  it('accepts an empty league table', () => {
    // A league whose members have all yet to settle a matchweek is not an
    // error; `totalCount` of zero with no rows is a legitimate page.
    const page = mapSeasonLeagueStandingsPage(payload({ rows: [], totalCount: 0 }))

    expect(page.rows).toEqual([])
    expect(page.totalCount).toBe(0)
  })
})
