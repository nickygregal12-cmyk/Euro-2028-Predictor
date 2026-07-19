import { describe, it, expect } from 'vitest'
import {
  groupScoreEvents,
  scoreEventsFromBreakdown,
  SCORE_CATEGORY_ORDER,
  type ScoreEvent,
  type ScoreEventResolvers,
} from '../../src/domain/tournament/scoreEvents'
import { calculateScore } from '../../src/domain/tournament/calculateScore'

const ev = (over: Partial<ScoreEvent>): ScoreEvent => ({
  id: Math.random().toString(),
  category: 'group_matches',
  explanation: 'x',
  points: 0,
  ...over,
})

describe('groupScoreEvents', () => {
  it('always returns all four categories in canonical order', () => {
    const { categories } = groupScoreEvents([])
    expect(categories.map((c) => c.category)).toEqual(SCORE_CATEGORY_ORDER)
  })

  it('marks empty categories pending with a zero subtotal — never hidden', () => {
    const { categories } = groupScoreEvents([ev({ category: 'knockout', points: 10 })])
    const groupMatches = categories.find((c) => c.category === 'group_matches')!
    const knockout = categories.find((c) => c.category === 'knockout')!
    expect(groupMatches.pending).toBe(true)
    expect(groupMatches.subtotal).toBe(0)
    expect(knockout.pending).toBe(false)
    expect(knockout.subtotal).toBe(10)
  })

  it('keeps the total equal to the sum of every rendered event (the pinned-total invariant)', () => {
    const events = [
      ev({ category: 'group_matches', points: 10, joker: true }),
      ev({ category: 'group_matches', points: 3 }),
      ev({ category: 'knockout', points: 15 }),
      ev({ category: 'awards', points: 25 }),
    ]
    const { categories, total } = groupScoreEvents(events)
    const sumOfRows = categories.flatMap((c) => c.events).reduce((s, e) => s + e.points, 0)
    const sumOfSubtotals = categories.reduce((s, c) => s + c.subtotal, 0)
    expect(total).toBe(53)
    expect(total).toBe(sumOfRows)
    expect(total).toBe(sumOfSubtotals)
  })
})

describe('scoreEventsFromBreakdown', () => {
  const resolvers: ScoreEventResolvers = {
    match: (id) => ({ text: id === 'm1' ? 'Sco 2–1 Eng' : 'Ger 0–0 Ita', flag: { name: 'Scotland', countryCode: 'gb-sct' } }),
    group: (id) => ({ text: `Group ${id.toUpperCase()}` }),
    team: (id) => ({ text: id === 'esp' ? 'Spain' : 'France', flag: { name: 'Spain', countryCode: 'es' } }),
    player: () => 'Harry Kane',
  }

  it('runs off the real calculateScore pipeline and preserves the joker double', () => {
    const breakdown = calculateScore(
      { groupMatches: [{ matchId: 'm1', homeScore: 2, awayScore: 1, joker: true }] },
      { groupMatches: [{ matchId: 'm1', homeScore: 2, awayScore: 1 }] },
    )
    const events = scoreEventsFromBreakdown(breakdown, resolvers)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      category: 'group_matches',
      explanation: 'Sco 2–1 Eng · exact score',
      points: 10,
      joker: true,
    })
    // Regrouping the derived events reproduces the breakdown total.
    expect(groupScoreEvents(events).total).toBe(breakdown.total)
  })

  it('emits a zero-point row for a wrong guess by default, and drops it with includeZero:false', () => {
    const breakdown = calculateScore(
      { groupMatches: [{ matchId: 'm1', homeScore: 0, awayScore: 3 }] },
      { groupMatches: [{ matchId: 'm1', homeScore: 2, awayScore: 1 }] },
    )
    expect(scoreEventsFromBreakdown(breakdown, resolvers)).toHaveLength(1)
    expect(scoreEventsFromBreakdown(breakdown, resolvers, { includeZero: false })).toHaveLength(0)
  })

  it('derives a knockout event labelled with the furthest correct stage', () => {
    const breakdown = calculateScore(
      { knockout: [{ teamId: 'esp', stage: 'FINAL' }] },
      { knockout: [{ teamId: 'esp', stage: 'SF' }] },
    )
    const events = scoreEventsFromBreakdown(breakdown, resolvers)
    expect(events).toHaveLength(1)
    expect(events[0].category).toBe('knockout')
    expect(events[0].explanation).toContain('semi-finals')
  })
})
