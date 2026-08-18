import { describe, expect, it } from 'vitest'
import {
  accuracyRate,
  pointsGapLabel,
  rankBounds,
  rankPlot,
  rivalryComparable,
  type RankPoint,
  type RivalryDetail,
} from '../../src/vnext/models/playerProfile'
import { at, first } from '../support/indexed'

/**
 * THE STAGE 10 SELECTORS, TESTED WHERE A CHART LIES.
 *
 * `rankPlot` is the only place in the lane where a rank becomes a coordinate,
 * and every way it can be wrong is SILENT:
 *
 *   1. AN UN-INVERTED AXIS draws a season of promotions as a slide downhill.
 *      A rank improves as it falls, and nothing about the picture says so.
 *   2. A ZERO SPAN divides by zero. A player who held one position all season,
 *      or has one settled matchweek, must plot somewhere honest — the centre —
 *      rather than at an edge that reads as their best or worst season.
 *   3. AN AXIS SCALED BY ONE RULE AND LABELLED BY ANOTHER is the classic chart
 *      lie, so the bounds the line was drawn between are the bounds returned.
 *
 * And the two arithmetic refusals:
 *
 *   4. `accuracyRate` DIVIDES BY NOTHING RATHER THAN RETURNING ZERO. "0% exact"
 *      is an accusation against a player who has not predicted anything.
 *   5. `rivalryComparable` IS THE ONLY THING THAT TELLS 0-0-0 OUT OF NOTHING
 *      FROM A DRAWN RIVALRY.
 */

function point(ordinal: number, rank: number, fieldSize = 412, cumulativePoints = 10): RankPoint {
  return {
    matchweekId: `mw-${ordinal}`,
    ordinal,
    label: `Matchweek ${ordinal}`,
    rank,
    fieldSize,
    cumulativePoints,
  }
}

describe('rankBounds states what the chart is drawn between', () => {
  it('finds the best and worst positions actually held', () => {
    const bounds = rankBounds([point(1, 41), point(2, 9), point(3, 22)])
    expect(bounds).toEqual({ best: 9, worst: 41, fieldSize: 412, fieldChanged: false })
  })

  it('reports no bounds for an empty season rather than inventing a range', () => {
    expect(rankBounds([])).toBeNull()
  })

  it('names the field as it stands NOW, and says when it moved', () => {
    // "7th of 60" and "7th of 412" are different facts, so one number printed
    // beneath a line drawn across both would be wrong for most of it.
    const bounds = rankBounds([point(1, 7, 60), point(2, 9, 190), point(3, 12, 412)])
    expect(bounds?.fieldSize).toBe(412)
    expect(bounds?.fieldChanged).toBe(true)
  })

  it('does not claim the field moved when it held', () => {
    expect(rankBounds([point(1, 7, 60), point(2, 9, 60)])?.fieldChanged).toBe(false)
  })
})

describe('the chart is drawn with first place at the top', () => {
  it('puts the best rank at y=0 and the worst at y=1', () => {
    // THE INVERSION. Without it, 2nd — the smaller number — plots at the
    // bottom, and a season of promotions is drawn as a collapse.
    const plotted = rankPlot([point(1, 40), point(2, 2)])
    expect(first(plotted).y).toBe(1)
    expect(at(plotted, 1).y).toBe(0)
  })

  it('draws a climb as a rising line', () => {
    const plotted = rankPlot([point(1, 301), point(2, 188), point(3, 12)])
    const ys = plotted.map((entry) => entry.y)
    expect(ys[0]).toBeGreaterThan(Number(ys[1]))
    expect(ys[1]).toBeGreaterThan(Number(ys[2]))
  })

  it('draws a fall as a descending line', () => {
    const plotted = rankPlot([point(1, 2), point(2, 31), point(3, 88)])
    const ys = plotted.map((entry) => entry.y)
    expect(ys[0]).toBeLessThan(Number(ys[1]))
    expect(ys[1]).toBeLessThan(Number(ys[2]))
  })

  it('spaces the matchweeks evenly from left to right', () => {
    const plotted = rankPlot([point(1, 4), point(2, 8), point(3, 12), point(4, 16), point(5, 20)])
    expect(plotted.map((entry) => entry.x)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
})

describe('a season with no range still plots somewhere honest', () => {
  it('puts a single settled matchweek in the middle rather than at an edge', () => {
    // Pinned to the top this reads as the best week of the player's life;
    // pinned to the bottom, the worst. Neither is a fact.
    const plotted = rankPlot([point(1, 18)])
    expect(plotted).toHaveLength(1)
    expect(first(plotted)).toMatchObject({ x: 0.5, y: 0.5 })
  })

  it('puts an unchanged position on the centre line rather than dividing by zero', () => {
    const plotted = rankPlot([point(1, 7), point(2, 7), point(3, 7)])
    expect(plotted.map((entry) => entry.y)).toEqual([0.5, 0.5, 0.5])
    expect(plotted.every((entry) => Number.isFinite(entry.y))).toBe(true)
  })

  it('draws nothing at all for a season before its first settlement', () => {
    expect(rankPlot([])).toEqual([])
  })
})

describe('the line and its axis come from one calculation', () => {
  it('scales between exactly the bounds the caller will label', () => {
    const series = [point(9, 4), point(10, 6), point(11, 7), point(12, 5)]
    const bounds = rankBounds(series)
    const plotted = rankPlot(series)

    // The point at y=0 must be the rank the axis prints at the top, and the
    // point at y=1 the one it prints at the bottom. If these ever came from two
    // calculations the chart would be captioned with numbers it was not drawn
    // between — and it would look completely normal.
    const top = plotted.find((entry) => entry.y === 0)
    const bottom = plotted.find((entry) => entry.y === 1)
    expect(top?.point.rank).toBe(bounds?.best)
    expect(bottom?.point.rank).toBe(bounds?.worst)
  })

  it('carries each point through so the plot and the table cannot disagree', () => {
    const series = [point(1, 4, 412, 116), point(2, 6, 412, 127)]
    expect(rankPlot(series).map((entry) => entry.point)).toEqual(series)
  })
})

describe('accuracy divides by nothing rather than returning zero', () => {
  it('reports two shares where there were fixtures to predict', () => {
    const rate = accuracyRate({ fixturesPredicted: 100, exactScores: 11, correctOutcomes: 54 })
    expect(rate).toEqual({ exact: 0.11, outcome: 0.54 })
  })

  it('refuses a rate for a player who has predicted nothing', () => {
    // "0% exact" is an accusation; "no fixtures yet" is the fact.
    expect(accuracyRate({ fixturesPredicted: 0, exactScores: 0, correctOutcomes: 0 })).toBeNull()
  })

  it('refuses rather than returning a negative or infinite share', () => {
    expect(accuracyRate({ fixturesPredicted: -1, exactScores: 3, correctOutcomes: 3 })).toBeNull()
  })

  it('reports a perfect season as one rather than rounding it away', () => {
    const rate = accuracyRate({ fixturesPredicted: 8, exactScores: 8, correctOutcomes: 8 })
    expect(rate?.exact).toBe(1)
  })
})

function rivalry(overrides: Partial<RivalryDetail> = {}): RivalryDetail {
  const side = {
    playerRef: 'entry-a',
    displayName: 'A',
    points: 0,
    matchweeksPlayed: 0,
    standing: null,
    accuracy: { fixturesPredicted: 0, exactScores: 0, correctOutcomes: 0 },
  }
  return {
    matchweeksCompared: 0,
    you: side,
    them: { ...side, playerRef: 'entry-b', displayName: 'B' },
    pointsGap: 0,
    yourWins: 0,
    theirWins: 0,
    draws: 0,
    recent: [],
    ...overrides,
  }
}

describe('0-0-0 out of nothing is not a draw', () => {
  it('reports an unstarted rivalry as not comparable', () => {
    expect(rivalryComparable(rivalry())).toBe(false)
  })

  it('reports a genuinely drawn rivalry as comparable', () => {
    // Identical record, opposite meaning. Only the denominator separates them,
    // which is why nothing may read the record without it.
    expect(rivalryComparable(rivalry({ matchweeksCompared: 4, draws: 4 }))).toBe(true)
  })

  it('answers from the STATED denominator and not from the record beside it', () => {
    // On well-formed data the two agree, which is exactly why this needs
    // pinning: a version reading `recent.length` or summing the record would
    // pass every realistic world and then disagree the first time a payload
    // arrives with its window truncated to nothing — which is what a server
    // sending `p_recent` at its lower clamp with an unfilled record looks like.
    expect(
      rivalryComparable(
        rivalry({ matchweeksCompared: 30, yourWins: 0, theirWins: 0, draws: 0, recent: [] }),
      ),
    ).toBe(true)

    // And the mirror: a record with no denominator behind it is not a rivalry.
    expect(rivalryComparable(rivalry({ matchweeksCompared: 0, draws: 4 }))).toBe(false)
  })
})

describe('the points gap keeps the server`s sign and says which way it reads', () => {
  it('reads a positive gap as the reader being behind', () => {
    expect(pointsGapLabel(13)).toBe('13 points behind')
  })

  it('reads a negative gap as the reader being ahead', () => {
    expect(pointsGapLabel(-13)).toBe('13 points ahead')
  })

  it('says level rather than "0 points behind"', () => {
    expect(pointsGapLabel(0)).toBe('level on points')
  })

  it('says point rather than points for one', () => {
    expect(pointsGapLabel(1)).toBe('1 point behind')
    expect(pointsGapLabel(-1)).toBe('1 point ahead')
  })
})
