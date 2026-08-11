import { describe, expect, it } from 'vitest'
import {
  correctOutcomeRate,
  exactScoreRate,
  mapSeasonWrapped,
} from '../../src/services/supabase/seasonWrappedModel'

const FINALISED = {
  finalised: true,
  season: { points: 412, rank: 7, field_size: 1204, matchweeks_played: 38 },
  best_matchweek: { ordinal: 21, points: 24 },
  accuracy: { fixtures_predicted: 372, exact_scores: 41, correct_outcomes: 198 },
  jokers_played: 5,
  finalised_at: '2027-05-25T18:00:00Z',
}

describe('mapSeasonWrapped', () => {
  it('decodes a finalised season exactly as the archive stored it', () => {
    expect(mapSeasonWrapped(FINALISED)).toEqual({
      finalised: true,
      season: { points: 412, rank: 7, fieldSize: 1204, matchweeksPlayed: 38 },
      bestMatchweek: { ordinal: 21, points: 24 },
      accuracy: { fixturesPredicted: 372, exactScores: 41, correctOutcomes: 198 },
      jokersPlayed: 5,
      finalisedAt: '2027-05-25T18:00:00Z',
    })
  })

  it('reads a season that has not finished as not finalised, never as zeros', () => {
    const wrapped = mapSeasonWrapped({ finalised: false })

    expect(wrapped).toEqual({ finalised: false })
    expect('season' in wrapped).toBe(false)
  })

  it('treats an absent or malformed payload as not finalised', () => {
    for (const payload of [null, undefined, {}, [], 'nope']) {
      expect(mapSeasonWrapped(payload)).toEqual({ finalised: false })
    }
  })

  it('keeps a null best matchweek null rather than inventing matchweek zero', () => {
    const wrapped = mapSeasonWrapped({ ...FINALISED, best_matchweek: null })

    expect(wrapped).toMatchObject({ finalised: true, bestMatchweek: null })
  })

  it('drops a half-decoded best matchweek rather than printing a points-less one', () => {
    const wrapped = mapSeasonWrapped({ ...FINALISED, best_matchweek: { ordinal: 21 } })

    expect(wrapped).toMatchObject({ bestMatchweek: null })
  })

  it('keeps an unknown rank and field size null rather than defaulting them to zero', () => {
    const wrapped = mapSeasonWrapped({
      ...FINALISED,
      season: { points: 12, rank: null, field_size: null, matchweeks_played: 2 },
    })

    expect(wrapped).toMatchObject({
      season: { points: 12, rank: null, fieldSize: null, matchweeksPlayed: 2 },
    })
  })
})

describe('accuracy rates', () => {
  it('divides only the numbers the archive stored', () => {
    const accuracy = { fixturesPredicted: 200, exactScores: 40, correctOutcomes: 120 }

    expect(exactScoreRate(accuracy)).toBeCloseTo(0.2)
    expect(correctOutcomeRate(accuracy)).toBeCloseTo(0.6)
  })

  it('answers null when nothing was predicted, rather than NaN or a confident zero', () => {
    const accuracy = { fixturesPredicted: 0, exactScores: 0, correctOutcomes: 0 }

    expect(exactScoreRate(accuracy)).toBeNull()
    expect(correctOutcomeRate(accuracy)).toBeNull()
  })
})
