import { describe, expect, it } from 'vitest'
import {
  MINIMUM_SAMPLE,
  compareDna,
  presentPredictionDna,
} from '../../../src/features/season/predictionDnaModel'
import type { SeasonPlayerProfile } from '../../../src/services/supabase/seasonPlayerProfileModel'

/**
 * `INNOV-002`. Two properties are pinned here above all: a small sample says so
 * rather than quoting a share, and every label is a statement about scorelines
 * rather than about a person.
 */

function profileOf(
  predictions: readonly { home: number; away: number }[],
  overrides: Partial<SeasonPlayerProfile> = {},
): SeasonPlayerProfile {
  return {
    player: { userId: 'u-1', displayName: 'Craig', isSelf: false },
    entered: true,
    serverNow: null,
    season: { points: 120, matchweeksPlayed: 4, rank: 3, fieldSize: 40 },
    accuracy: { fixturesPredicted: 20, exactScores: 5, correctOutcomes: 12 },
    jokers: { played: 1, pointsFromJokerMatchweeks: 30 },
    history: [
      {
        matchweekId: 'mw-1',
        ordinal: 1,
        label: 'Matchweek 1',
        points: 12,
        jokerPlayed: false,
        predictions: Object.fromEntries(
          predictions.map((prediction, index) => [`fx-${index}`, prediction]),
        ),
      },
    ],
    ...overrides,
  }
}

const twoOne = { home: 2, away: 1 }

describe('presentPredictionDna availability', () => {
  it('says a player has not entered rather than describing nothing', () => {
    const dna = presentPredictionDna(profileOf([], { entered: false }))
    expect(dna).toEqual({ available: false, reason: 'not_entered', predictions: 0 })
  })

  it('reports a short sample rather than quoting a share over four matches', () => {
    const dna = presentPredictionDna(profileOf(Array.from({ length: 4 }, () => twoOne)))
    expect(dna.available).toBe(false)
    if (dna.available) throw new Error('unreachable')
    expect(dna.reason).toBe('insufficient_sample')
    expect(dna.predictions).toBe(4)
  })

  it('describes a sample at the stated minimum', () => {
    const dna = presentPredictionDna(
      profileOf(Array.from({ length: MINIMUM_SAMPLE }, () => twoOne)),
    )
    expect(dna.available).toBe(true)
  })
})

describe('presentPredictionDna metrics', () => {
  const dna = presentPredictionDna(
    profileOf([
      ...Array.from({ length: 6 }, () => ({ home: 2, away: 1 })),
      ...Array.from({ length: 3 }, () => ({ home: 1, away: 1 })),
      ...Array.from({ length: 3 }, () => ({ home: 0, away: 2 })),
    ]),
  )
  if (!dna.available) throw new Error('expected a described profile')
  const byKey = Object.fromEntries(dna.metrics.map((metric) => [metric.key, metric]))

  it('measures goals per match over the predictions it counted', () => {
    // (6 × 3) + (3 × 2) + (3 × 2) = 30 goals over 12 predictions.
    expect(byKey.goals?.value).toBe('2.5')
    expect(byKey.goals?.detail).toContain('12 predictions')
  })

  it('splits the three outcomes and states each denominator', () => {
    expect(byKey.home?.value).toBe('50%')
    expect(byKey.draw?.value).toBe('25%')
    expect(byKey.away?.value).toBe('25%')
    expect(byKey.home?.detail).toBe('6 of 12 predictions')
  })

  it('names the most-used scoreline and how often it was used', () => {
    expect(byKey.scoreline?.value).toBe('2 – 1')
    expect(byKey.scoreline?.detail).toBe('used 6 times')
  })

  it("takes exact and correct rates from the server's settled denominator", () => {
    // 5 of 20 and 12 of 20 — the accuracy block's population, not the twelve
    // predictions counted above.
    expect(byKey.exact?.value).toBe('25%')
    expect(byKey.exact?.detail).toBe('5 of 20 settled predictions')
    expect(byKey.correct?.value).toBe('60%')
  })

  it('names the measurement rather than the person', () => {
    // A quarter of this profile's predictions are draws, which is the first
    // threshold it crosses; the panel prints the 25% beside the word.
    expect(dna.signature).toBe('Draw backer')
    const optimist = presentPredictionDna(
      profileOf(Array.from({ length: 12 }, () => ({ home: 3, away: 2 }))),
    )
    if (!optimist.available) throw new Error('expected a described profile')
    expect(optimist.signature).toBe('Goals optimist')
  })

  it('ignores a malformed prediction rather than counting it as nil-nil', () => {
    const dna = presentPredictionDna(
      profileOf([
        ...Array.from({ length: 12 }, () => twoOne),
        { home: Number.NaN, away: 1 },
      ]),
    )
    if (!dna.available) throw new Error('expected a described profile')
    expect(dna.predictions).toBe(12)
  })
})

describe('compareDna', () => {
  const mine = presentPredictionDna(
    profileOf(Array.from({ length: 12 }, () => ({ home: 3, away: 1 }))),
  )
  const theirs = presentPredictionDna(
    profileOf(Array.from({ length: 12 }, () => ({ home: 2, away: 0 }))),
  )

  it('states the difference as arithmetic and never as a judgement', () => {
    const lines = compareDna(mine, theirs, 'Craig')
    const goals = lines.find((line) => line.key === 'goals')
    // 4.0 against 2.0 — a doubling, stated as a percentage of theirs.
    expect(goals?.difference).toBe('100% more goals than Craig.')
    expect(lines.every((line) => !/bold|brave|better|worse/i.test(line.difference ?? ''))).toBe(
      true,
    )
  })

  it('compares nothing when either side has too small a sample', () => {
    const tiny = presentPredictionDna(profileOf([twoOne]))
    expect(compareDna(mine, tiny, 'Craig')).toEqual([])
    expect(compareDna(tiny, theirs, 'Craig')).toEqual([])
  })

  it('drops a metric one side does not have rather than comparing to nothing', () => {
    const noAccuracy = presentPredictionDna(
      profileOf(Array.from({ length: 12 }, () => twoOne), { accuracy: null }),
    )
    const lines = compareDna(mine, noAccuracy, 'Craig')
    expect(lines.some((line) => line.key === 'exact')).toBe(false)
  })
})
