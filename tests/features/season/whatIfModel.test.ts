import { describe, expect, it } from 'vitest'
import {
  describeBranch,
  projectWhatIf,
  type WhatIfInput,
  type WhatIfLeagueInput,
} from '../../../src/features/season/whatIfModel'
import { scoreFixture, scoreMatchweek } from '../../../src/domain/season/scoring'

/**
 * `INNOV-001`. The point of these tests is not that the arithmetic is right —
 * `scoreFixture` owns that and has its own suite — but that the projection
 * never becomes an authority: it refuses to run over a settled fixture, refuses
 * to run without a provider score, and derives every point value from the
 * canonical rule rather than from a number written here.
 */

const base: WhatIfInput = {
  fixtureId: 'fx-1',
  homeName: 'Liverpool',
  awayName: 'Arsenal',
  prediction: { home: 2, away: 1 },
  result: null,
  live: { home: 1, away: 1 },
}

describe('projectWhatIf availability', () => {
  it('refuses a fixture that already has a confirmed result', () => {
    const projection = projectWhatIf({ ...base, result: { home: 2, away: 1 } })
    expect(projection).toEqual({ available: false, reason: 'settled' })
  })

  it('refuses a fixture with no provider score', () => {
    expect(projectWhatIf({ ...base, live: null })).toEqual({
      available: false,
      reason: 'no_live_score',
    })
  })

  it('refuses an implausible provider score rather than projecting past it', () => {
    expect(projectWhatIf({ ...base, live: { home: 99, away: 0 } })).toEqual({
      available: false,
      reason: 'unusable_live_score',
    })
  })

  it('refuses a half-reported provider score', () => {
    expect(
      projectWhatIf({ ...base, live: { home: 1, away: Number.NaN } }),
    ).toEqual({ available: false, reason: 'unusable_live_score' })
  })
})

describe('projectWhatIf branches', () => {
  it('offers now, home-scores and away-scores from the live score', () => {
    const projection = projectWhatIf(base)
    if (!projection.available) throw new Error('expected a projection')

    expect(projection.branches.map((branch) => branch.key)).toEqual(['now', 'home', 'away'])
    expect(projection.branches.map((branch) => branch.scoreLabel)).toEqual([
      '1 – 1',
      '2 – 1',
      '1 – 2',
    ])
    expect(projection.branches.map((branch) => branch.label)).toEqual([
      'As it stands',
      'If Liverpool score',
      'If Arsenal score',
    ])
  })

  it('takes every point value from the canonical scoring authority', () => {
    const projection = projectWhatIf(base)
    if (!projection.available) throw new Error('expected a projection')

    for (const branch of projection.branches) {
      expect(branch.points).toBe(scoreFixture(base.prediction, branch.score))
    }
    // And the reasons follow from it: the home goal makes 2-1 exact.
    expect(projection.branches[1]?.reason).toBe('exact_score')
    expect(projection.branches[1]?.points).toBe(5)
    expect(projection.branches[0]?.reason).toBe('wrong')
    expect(projection.branches[2]?.reason).toBe('wrong')
  })

  it('projects nothing for a player with no prediction, without refusing', () => {
    const projection = projectWhatIf({ ...base, prediction: null })
    if (!projection.available) throw new Error('expected a projection')
    expect(projection.prediction).toBeNull()
    expect(projection.branches.every((branch) => branch.points === 0)).toBe(true)
    expect(projection.branches.every((branch) => branch.reason === 'unscored')).toBe(true)
    expect(describeBranch(projection.branches[0]!)).toContain('no prediction')
  })

  it('drops a branch that would run past the plausible ceiling', () => {
    const projection = projectWhatIf({ ...base, live: { home: 20, away: 0 } })
    if (!projection.available) throw new Error('expected a projection')
    expect(projection.branches.map((branch) => branch.key)).toEqual(['now', 'away'])
  })
})

/**
 * Three players whose ranking branches visibly differ — the Innovation Lab's
 * own stated first experiment for this feature.
 */
const league: WhatIfLeagueInput = {
  leagueName: 'The Office',
  memberCount: 3,
  fixtures: [
    { id: 'fx-1', result: null },
    { id: 'fx-2', result: { home: 1, away: 0 } },
    { id: 'fx-3', result: null },
  ],
  members: [
    {
      userId: 'u-me',
      displayName: 'You',
      isSelf: true,
      jokerPlayed: false,
      points: null,
      predictions: { 'fx-1': { home: 2, away: 1 }, 'fx-2': { home: 1, away: 0 } },
    },
    {
      userId: 'u-craig',
      displayName: 'Craig',
      isSelf: false,
      jokerPlayed: false,
      points: null,
      predictions: { 'fx-1': { home: 1, away: 2 }, 'fx-2': { home: 2, away: 0 } },
    },
    {
      userId: 'u-sam',
      displayName: 'Sam',
      isSelf: false,
      jokerPlayed: false,
      points: null,
      predictions: { 'fx-1': { home: 1, away: 1 } },
    },
  ],
  seasonPointsBefore: { 'u-me': 40, 'u-craig': 43, 'u-sam': 44 },
}

describe('projectWhatIf league consequence', () => {
  const projection = projectWhatIf({ ...base, league })
  if (!projection.available) throw new Error('expected a projection')
  const byKey = Object.fromEntries(projection.branches.map((branch) => [branch.key, branch]))

  it('changes the projected order across the three branches', () => {
    // As it stands (1-1) Sam is exact on this fixture and leads.
    expect(byKey.now?.league?.leaderName).toBe('Sam')
    // A Liverpool goal makes the player's 2-1 exact and puts them top.
    expect(byKey.home?.league?.leaderName).toBe('You')
    // An Arsenal goal makes Craig's 1-2 exact and puts him top.
    expect(byKey.away?.league?.leaderName).toBe('Craig')
  })

  it('projects a rank and a gap for the player in every branch', () => {
    expect(byKey.now?.league?.you?.projectedRank).toBe(3)
    expect(byKey.home?.league?.you?.projectedRank).toBe(1)
    expect(byKey.home?.league?.gapToLeader).toBe(0)
    // Craig's exact 1-2 takes him past both, and the player's own settled exact
    // on the other fixture keeps them ahead of Sam.
    expect(byKey.away?.league?.you?.projectedRank).toBe(2)
    expect(byKey.away?.league?.gapToLeader).toBeGreaterThan(0)
  })

  it('derives each member total from the matchweek authority, Joker included', () => {
    const jokered: WhatIfLeagueInput = {
      ...league,
      members: league.members.map((member) =>
        member.isSelf ? { ...member, jokerPlayed: true } : member,
      ),
    }
    const withJoker = projectWhatIf({ ...base, league: jokered })
    if (!withJoker.available) throw new Error('expected a projection')
    const home = withJoker.branches.find((branch) => branch.key === 'home')
    const mine = home?.league?.you
    const expected = scoreMatchweek(
      [
        { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } },
        { prediction: { home: 1, away: 0 }, result: { home: 1, away: 0 } },
      ],
      true,
    ).totalPoints
    expect(mine?.matchweekPoints).toBe(expected)
  })

  it('states how many fixtures it could not account for', () => {
    expect(byKey.now?.league?.unknownFixtures).toBe(1)
  })

  it('suppresses the league half once the matchweek has settled', () => {
    const settled: WhatIfLeagueInput = {
      ...league,
      members: league.members.map((member) => ({ ...member, points: 12 })),
    }
    const after = projectWhatIf({ ...base, league: settled })
    if (!after.available) throw new Error('expected a projection')
    expect(after.branches.every((branch) => branch.league === null)).toBe(true)
  })

  it('reports matchweek points and no rank when season totals are absent', () => {
    const { seasonPointsBefore: _ignored, ...withoutTotals } = league
    const anonymous = projectWhatIf({ ...base, league: withoutTotals })
    if (!anonymous.available) throw new Error('expected a projection')
    const now = anonymous.branches.find((branch) => branch.key === 'now')
    expect(now?.league?.you?.matchweekPoints).toBeGreaterThanOrEqual(0)
    expect(now?.league?.you?.projectedRank).toBeNull()
    expect(now?.league?.leaderName).toBeNull()
    expect(now?.league?.gapToLeader).toBeNull()
  })

  it('shares a rank between tied projections rather than inventing an order', () => {
    const tied: WhatIfLeagueInput = {
      ...league,
      members: league.members.slice(0, 2).map((member) => ({ ...member, predictions: {} })),
      memberCount: 2,
      seasonPointsBefore: { 'u-me': 40, 'u-craig': 40 },
    }
    const level = projectWhatIf({ ...base, league: tied })
    if (!level.available) throw new Error('expected a projection')
    expect(level.branches[0]?.league?.rows.map((row) => row.projectedRank)).toEqual([1, 1])
  })
})
