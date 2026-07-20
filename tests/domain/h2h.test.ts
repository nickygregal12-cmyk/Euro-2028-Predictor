import { describe, it, expect } from 'vitest'
import {
  computeEntryStats,
  whereYouSplit,
  canRevealRival,
  type EntryPredictions,
  type H2HActuals,
} from '../../src/domain/tournament/h2h'

const noResults: H2HActuals = {
  resultsByMatch: new Map(),
  undecidedGroupCount: 0,
  eliminatedTeamIds: new Set(),
}

describe('computeEntryStats', () => {
  const actuals: H2HActuals = {
    resultsByMatch: new Map([
      ['m1', { home: 2, away: 1 }], // exact for the entry below
      ['m2', { home: 0, away: 0 }], // correct-result (they said 1-1)
      ['m3', { home: 3, away: 0 }], // wrong (they said 0-1)
    ]),
    undecidedGroupCount: 6,
    eliminatedTeamIds: new Set(['tEliminated']),
  }
  const preds: EntryPredictions = {
    groupMatches: [
      { matchId: 'm1', homeScore: 2, awayScore: 1, joker: false },
      { matchId: 'm2', homeScore: 1, awayScore: 1, joker: false },
      { matchId: 'm3', homeScore: 0, awayScore: 1, joker: false },
      { matchId: 'm4', homeScore: 1, awayScore: 0, joker: true }, // unresulted, jokered
    ],
    progression: [
      { teamId: 'tChamp', stage: 'CHAMPION' },
      { teamId: 'tFin', stage: 'FINAL' },
      { teamId: 'tEliminated', stage: 'QF' },
    ],
  }

  it('totals §1 points and counts exact scores', () => {
    const s = computeEntryStats(preds, actuals)
    expect(s.exactScores).toBe(1) // only m1
    expect(s.totalPoints).toBe(8) // 5 (exact) + 3 (correct) + 0
  })

  it('counts KO picks alive (excludes eliminated teams)', () => {
    expect(computeEntryStats(preds, actuals).koPicksAlive).toBe(2) // tChamp, tFin
  })

  it('max possible >= current total and reflects remaining upside', () => {
    const s = computeEntryStats(preds, actuals)
    expect(s.maxPossible).toBeGreaterThan(s.totalPoints)
  })

  it('handles an entry with zero predictions in a category', () => {
    const empty: EntryPredictions = { groupMatches: [], progression: [] }
    const s = computeEntryStats(empty, noResults)
    // Nothing scored/picked, but the undecided bonus ceiling (golden boot 25 +
    // total goals 40) still counts toward the optimistic "max still possible".
    expect(s).toEqual({ totalPoints: 0, exactScores: 0, koPicksAlive: 0, maxPossible: 65 })
  })

  it('gives two identical entries identical stats (tie handling)', () => {
    const a = computeEntryStats(preds, actuals)
    const b = computeEntryStats(preds, actuals)
    expect(a).toEqual(b)
  })
})

describe('whereYouSplit', () => {
  const mine: EntryPredictions = {
    groupMatches: [],
    progression: [
      { teamId: 'ESP', stage: 'CHAMPION' },
      { teamId: 'FRA', stage: 'FINAL' },
    ],
  }
  it('flags an agreed champion', () => {
    const split = whereYouSplit(mine, mine)
    expect(split.champion.agree).toBe(true)
    expect(split.finalists.sharedTeamIds.sort()).toEqual(['ESP', 'FRA'])
    expect(split.finalists.mineOnlyTeamIds).toEqual([])
  })
  it('flags a split champion + solo finalists', () => {
    const theirs: EntryPredictions = {
      groupMatches: [],
      progression: [
        { teamId: 'GER', stage: 'CHAMPION' },
        { teamId: 'FRA', stage: 'FINAL' },
      ],
    }
    const split = whereYouSplit(mine, theirs)
    expect(split.champion.agree).toBe(false)
    expect(split.champion.mineTeamId).toBe('ESP')
    expect(split.champion.theirsTeamId).toBe('GER')
    expect(split.finalists.sharedTeamIds).toEqual(['FRA'])
    expect(split.finalists.mineOnlyTeamIds).toEqual(['ESP'])
    expect(split.finalists.theirsOnlyTeamIds).toEqual(['GER'])
  })
})

describe('canRevealRival (mirror of the server gate)', () => {
  it('needs BOTH post-lock and a shared league', () => {
    expect(canRevealRival({ locked: true, sharesLeague: true })).toBe(true)
    expect(canRevealRival({ locked: false, sharesLeague: true })).toBe(false)
    expect(canRevealRival({ locked: true, sharesLeague: false })).toBe(false)
    expect(canRevealRival({ locked: false, sharesLeague: false })).toBe(false)
  })
})
