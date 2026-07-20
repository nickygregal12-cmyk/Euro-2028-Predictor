import { describe, it, expect } from 'vitest'
import {
  homePhase,
  pointsToday,
  selectBestLeague,
  catchUpSummary,
  type LeagueStanding,
} from '../../src/domain/tournament/homeDashboard'

describe('homePhase', () => {
  it('is during whenever results exist (regardless of submission)', () => {
    expect(homePhase({ hasResults: true, submitted: false })).toBe('during')
    expect(homePhase({ hasResults: true, submitted: true })).toBe('during')
  })
  it('is preSubmitted when the entry is in but no results yet', () => {
    expect(homePhase({ hasResults: false, submitted: true })).toBe('preSubmitted')
  })
  it('is preIncomplete otherwise', () => {
    expect(homePhase({ hasResults: false, submitted: false })).toBe('preIncomplete')
  })
})

describe('pointsToday', () => {
  const dates = new Map([
    ['m1', '2028-06-14'],
    ['m2', '2028-06-14'],
    ['m3', '2028-06-15'],
  ])
  it("sums only score events whose match is today", () => {
    const events = [
      { matchId: 'm1', points: 5 },
      { matchId: 'm2', points: 6 },
      { matchId: 'm3', points: 10 },
    ]
    expect(pointsToday(events, dates, '2028-06-14')).toBe(11)
  })
  it('ignores non-match events (null matchId)', () => {
    const events = [
      { matchId: null, points: 40 },
      { matchId: 'm1', points: 5 },
    ]
    expect(pointsToday(events, dates, '2028-06-14')).toBe(5)
  })
  it('is 0 when nothing was played today', () => {
    expect(pointsToday([{ matchId: 'm1', points: 5 }], dates, '2028-06-20')).toBe(0)
  })
})

describe('selectBestLeague', () => {
  const lg = (over: Partial<LeagueStanding>): LeagueStanding => ({
    id: 'x',
    name: 'League',
    memberCount: 5,
    rank: null,
    gapToTop: null,
    lastActivityMs: 0,
    ...over,
  })

  it('returns null when in no leagues', () => {
    expect(selectBestLeague([])).toBeNull()
  })
  it('picks the highest rank (1 beats 4)', () => {
    const best = selectBestLeague([
      lg({ id: 'a', rank: 4 }),
      lg({ id: 'b', rank: 1 }),
    ])
    expect(best?.id).toBe('b')
  })
  it('breaks rank ties by most recent activity', () => {
    const best = selectBestLeague([
      lg({ id: 'old', rank: 2, lastActivityMs: 100 }),
      lg({ id: 'new', rank: 2, lastActivityMs: 500 }),
    ])
    expect(best?.id).toBe('new')
  })
  it('sorts null ranks (pre-results) last', () => {
    const best = selectBestLeague([lg({ id: 'unranked', rank: null }), lg({ id: 'ranked', rank: 9 })])
    expect(best?.id).toBe('ranked')
  })
})

describe('catchUpSummary', () => {
  it('hides on first visit (no snapshot)', () => {
    expect(
      catchUpSummary({ lastSeenAt: null, lastSeenPoints: null, currentPoints: 30 }),
    ).toBeNull()
  })
  it('shows the points gained since last visit', () => {
    expect(
      catchUpSummary({ lastSeenAt: '2028-06-13T00:00:00Z', lastSeenPoints: 18, currentPoints: 30 }),
    ).toEqual({ pointsDelta: 12, rankDelta: null })
  })
  it('hides when nothing was gained (recent visitor)', () => {
    expect(
      catchUpSummary({ lastSeenAt: '2028-06-14T00:00:00Z', lastSeenPoints: 30, currentPoints: 30 }),
    ).toBeNull()
  })
})
