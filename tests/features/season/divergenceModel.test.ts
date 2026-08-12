import { describe, expect, it } from 'vitest'
import {
  CONSENSUS_SHARE_FLOOR,
  CONTRARIAN_SHARE_CEILING,
  presentDivergence,
} from '../../../src/features/season/divergenceModel'
import type { SeasonConsensusFixture } from '../../../src/services/supabase/seasonConsensusModel'

/**
 * `INNOV-011`. These tests pin the two properties that matter: the sentence
 * always matches the share it is derived from, and no claim about a RESULT is
 * made before the fixture carries one.
 */

function fixtureOf(overrides: Partial<SeasonConsensusFixture> = {}): SeasonConsensusFixture {
  return {
    id: 'fx-1',
    homeName: 'Liverpool',
    awayName: 'Chelsea',
    kickoffAt: null,
    resultHome: null,
    resultAway: null,
    predicted: 100,
    homeWin: 70,
    draw: 19,
    awayWin: 11,
    shares: { homeWin: 70, draw: 19, awayWin: 11 },
    topScores: [
      { home: 2, away: 1, picks: 24 },
      { home: 1, away: 0, picks: 18 },
    ],
    ...overrides,
  }
}

describe('presentDivergence', () => {
  it('says nothing at all without a prediction', () => {
    expect(presentDivergence(fixtureOf(), null)).toBeNull()
  })

  it('says nothing when nobody predicted the fixture', () => {
    expect(presentDivergence(fixtureOf({ predicted: 0 }), { home: 1, away: 0 })).toBeNull()
  })

  it('bands on the published thresholds rather than on a feeling', () => {
    // The two constants are the definition, and the test reads them rather than
    // restating them: a threshold a test hard-codes is one that can be moved in
    // the model without anything noticing.
    const at = (share: number) =>
      presentDivergence(
        fixtureOf({ shares: { homeWin: 100 - share, draw: 0, awayWin: share } }),
        { home: 0, away: 1 },
      )?.band

    expect(at(CONTRARIAN_SHARE_CEILING)).toBe('against_the_field')
    expect(at(CONTRARIAN_SHARE_CEILING + 1)).toBe('split')
    expect(at(CONSENSUS_SHARE_FLOOR - 1)).toBe('split')
    expect(at(CONSENSUS_SHARE_FLOOR)).toBe('with_the_field')
  })

  it('names a low-share away pick as against the field', () => {
    const view = presentDivergence(fixtureOf(), { home: 0, away: 1 })
    expect(view?.band).toBe('against_the_field')
    expect(view?.outcomeShare).toBe(11)
    expect(view?.headline).toBe('Only 11% backed a Chelsea win, and you were one of them.')
  })

  it('names a high-share home pick as with the field', () => {
    const view = presentDivergence(fixtureOf(), { home: 2, away: 1 })
    expect(view?.band).toBe('with_the_field')
    expect(view?.headline).toContain('70% backed a Liverpool win')
  })

  it('calls an even three-way spread split rather than brave', () => {
    const view = presentDivergence(
      fixtureOf({ shares: { homeWin: 34, draw: 33, awayWin: 33 } }),
      { home: 1, away: 1 },
    )
    expect(view?.band).toBe('split')
    expect(view?.headline).toContain('Opinion was split')
  })

  it('reports how many shared the exact scoreline when the server listed it', () => {
    const view = presentDivergence(fixtureOf(), { home: 2, away: 1 })
    expect(view?.scorelinePicks).toBe(24)
    expect(view?.scorelineLine).toBe('24 players predicted 2 – 1, same as you.')
  })

  it('distinguishes an unlisted scoreline from a scoreline nobody picked', () => {
    const view = presentDivergence(fixtureOf(), { home: 4, away: 3 })
    expect(view?.scorelinePicks).toBeNull()
    expect(view?.scorelineLine).toContain('outside the most-predicted scores')
  })

  it('claims nothing about the outcome before the fixture carries a result', () => {
    const view = presentDivergence(fixtureOf(), { home: 0, away: 1 })
    expect(view?.resultLine).toBeNull()
    expect(view?.contrarianWin).toBe(false)
  })

  it('claims a contrarian win only for a low-share pick that landed', () => {
    const won = presentDivergence(fixtureOf({ resultHome: 0, resultAway: 2 }), {
      home: 0,
      away: 1,
    })
    expect(won?.contrarianWin).toBe(true)
    expect(won?.resultLine).toBe('Contrarian win — it finished 0 – 2.')

    const withCrowd = presentDivergence(fixtureOf({ resultHome: 3, resultAway: 0 }), {
      home: 2,
      away: 1,
    })
    expect(withCrowd?.contrarianWin).toBe(false)
    expect(withCrowd?.resultLine).toBe('You called it — it finished 3 – 0.')

    const missed = presentDivergence(fixtureOf({ resultHome: 1, resultAway: 1 }), {
      home: 0,
      away: 1,
    })
    expect(missed?.contrarianWin).toBe(false)
    expect(missed?.resultLine).toBe('It finished 1 – 1.')
  })

  it('ignores a half-reported result rather than guessing the other side', () => {
    const view = presentDivergence(fixtureOf({ resultHome: 2, resultAway: null }), {
      home: 2,
      away: 1,
    })
    expect(view?.resultLine).toBeNull()
  })
})
