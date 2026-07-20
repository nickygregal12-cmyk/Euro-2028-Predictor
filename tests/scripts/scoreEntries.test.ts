import { describe, it, expect } from 'vitest'
import { buildFixture } from '../../scripts/seed-dev/fixture'
import { generateSeedData } from '../../scripts/seed-dev/generate'
import { rankScored, scoreEntries } from '../../scripts/seed-dev/scoreEntries'

// Reference / acceptance test for the scoring engine.
//
// The seed's TS pipeline (calculateScore → scoreEventsFromBreakdown) is the
// REFERENCE implementation. The database recompute (recompute_tournament_scores,
// 20260720130000_add_scoring.sql) must produce the same per-entry totals and the
// same standard-competition ranks on the same source data. On the seeded fake
// mid-tournament only §1 group-match points score (no group complete, no
// knockout result), which is exactly the category the SQL engine implements — so
// SQL === TS here by construction.
//
// This locks the reference output so the acceptance step ("the app leaderboard
// must match the seed dry-run") has a checked-in target: apply the migrations,
// run `npx tsx scripts/seed-dev/index.ts --commit`, and the League tab must show
// these totals and ranks.

// Captured from `npx tsx scripts/seed-dev/index.ts` (dry run) — the printed
// "Overall standings (group-match points so far)".
const EXPECTED: [rank: number, total: number, name: string][] = [
  [1, 30, 'Cristiano'],
  [2, 27, 'xX_Predictor_Xx'],
  [3, 23, 'Alex Turner'],
  [4, 22, 'Søren Kjær-Nielsen'],
  [5, 20, 'Anne-Marie Ndlovu-Okonkwo'],
  [5, 20, 'Jordan Blake'],
  [5, 20, 'Maximilian von Habsburg-Lothringen III'],
  [8, 19, '🦁 Leo the Lion'],
  [8, 19, 'Sam Okafor'],
  [10, 17, 'MEGA FAN 2028'],
  [11, 16, 'José Peña'],
  [12, 14, 'Zoë Müller'],
  [13, 13, 'Priya Shah'],
  [14, 12, 'Fatima Al-Sayed'],
  [15, 11, 'Wojciech Szczęsny'],
  [16, 9, 'Bo'],
  [16, 9, 'renée'],
  [18, 8, 'The Undisputed Champion Of All Groups'],
  [19, 6, 'Al'],
  [19, 6, "O'Sullivan"],
]

describe('seed scoring (reference for the DB recompute)', () => {
  it('produces the locked overall leaderboard on the seeded data', () => {
    const fixture = buildFixture()
    const data = generateSeedData(fixture)
    const ranked = rankScored(scoreEntries(fixture, data))

    expect(ranked.map((e) => [e.rank, e.total, e.displayName])).toEqual(EXPECTED)
  })

  it('is deterministic — a second run yields identical totals', () => {
    const fixture = buildFixture()
    const a = rankScored(scoreEntries(fixture, generateSeedData(fixture)))
    const b = rankScored(scoreEntries(fixture, generateSeedData(fixture)))
    expect(b.map((e) => [e.displayName, e.total])).toEqual(a.map((e) => [e.displayName, e.total]))
  })

  it('ranks shared totals with standard competition ranking (ties share, next skips)', () => {
    const fixture = buildFixture()
    const ranked = rankScored(scoreEntries(fixture, generateSeedData(fixture)))
    // Three entries tie on 20 at rank 5 → the next distinct total is rank 8.
    const fives = ranked.filter((e) => e.total === 20)
    expect(fives).toHaveLength(3)
    expect(fives.every((e) => e.rank === 5)).toBe(true)
    expect(ranked.find((e) => e.total === 19)?.rank).toBe(8)
  })
})
