import { describe, it, expect } from 'vitest'
import {
  matchTemporalState,
  groupStake,
  koStake,
  groupDistribution,
  koSplit,
  orderLeagueGroupPicks,
  orderLeagueKoPicks,
  koLeagueCasualties,
} from '../../src/domain/tournament/matchCentre'

const AT = (iso: string) => new Date(iso)

describe('matchTemporalState', () => {
  const kick = '2028-06-10T18:00:00Z'
  it('is "after" once a result exists (regardless of clock)', () => {
    expect(matchTemporalState({ kickoffAt: kick, homeScore: 2, awayScore: 1 }, AT('2028-06-10T17:00:00Z'))).toBe('after')
  })
  it('is "before" ahead of kickoff', () => {
    expect(matchTemporalState({ kickoffAt: kick, homeScore: null, awayScore: null }, AT('2028-06-10T17:59:00Z'))).toBe('before')
  })
  it('is "during" after kickoff with no result yet (the live window)', () => {
    expect(matchTemporalState({ kickoffAt: kick, homeScore: null, awayScore: null }, AT('2028-06-10T18:30:00Z'))).toBe('during')
  })
  it('is "before" when there is no kickoff time and no result', () => {
    expect(matchTemporalState({ kickoffAt: null, homeScore: null, awayScore: null }, AT('2028-06-10T18:30:00Z'))).toBe('before')
  })
})

describe('groupStake', () => {
  it('scores an exact hit with joker doubling', () => {
    const s = groupStake({ homeScore: 2, awayScore: 1, joker: true }, { home: 2, away: 1 })
    expect(s.outcome).toBe('exact')
    expect(s.points).toBe(10)
  })
  it('scores a correct-outcome wrong-score at 3', () => {
    expect(groupStake({ homeScore: 3, awayScore: 1, joker: false }, { home: 2, away: 1 }).outcome).toBe('correct')
    expect(groupStake({ homeScore: 3, awayScore: 1, joker: false }, { home: 2, away: 1 }).points).toBe(3)
  })
  it('leaves outcome unknown + null points before a result', () => {
    const s = groupStake({ homeScore: 1, awayScore: 0, joker: false }, null)
    expect(s.outcome).toBe('unknown')
    expect(s.points).toBeNull()
  })
})

describe('koStake — backed team + correctness + progression points', () => {
  // R16 tie: home team predicted to reach the SF (through), away only to R16.
  it('backs the team predicted beyond this round, scores next-stage points if right', () => {
    const s = koStake('SF', 'R16', 'r16', 'home')
    expect(s.backed).toBe('home')
    expect(s.correct).toBe(true)
    expect(s.points).toBe(15) // reaching QF
  })
  it('marks a backed-loser wrong with 0', () => {
    const s = koStake('SF', 'R16', 'r16', 'away')
    expect(s.backed).toBe('home')
    expect(s.correct).toBe(false)
    expect(s.points).toBe(0)
  })
  it('backs neither when your bracket sent different teams here', () => {
    const s = koStake('R16', 'R16', 'r16', 'home')
    expect(s.backed).toBeNull()
    expect(s.correct).toBeNull()
  })
  it('final: champion pick backs home; points are the champion value', () => {
    const s = koStake('CHAMPION', 'FINAL', 'final', 'home')
    expect(s.backed).toBe('home')
    expect(s.points).toBe(40)
  })
})

describe('groupDistribution', () => {
  const buckets = [
    { homeScore: 1, awayScore: 1, count: 5 },
    { homeScore: 2, awayScore: 1, count: 8 },
    { homeScore: 0, awayScore: 0, count: 2 },
  ]
  it('orders bars by count desc, marks your row, and totals', () => {
    const { bars, total } = groupDistribution(buckets, { homeScore: 1, awayScore: 1 }, { home: 2, away: 1 })
    expect(total).toBe(15)
    expect(bars[0]).toMatchObject({ homeScore: 2, awayScore: 1, count: 8 }) // biggest first
    const you = bars.find((b) => b.isYou)!
    expect(you).toMatchObject({ homeScore: 1, awayScore: 1 })
    expect(bars.find((b) => b.homeScore === 2 && b.awayScore === 1)!.outcome).toBe('exact')
  })
})

describe('koSplit', () => {
  it('passes through counts + your backing + actual winner', () => {
    const s = koSplit({ homeCount: 12, awayCount: 7, totalEntries: 20 }, 'away', 'home')
    expect(s).toMatchObject({ homeCount: 12, awayCount: 7, total: 20, youBacked: 'away', actualWinner: 'home' })
  })
})

describe('orderLeagueGroupPicks', () => {
  it('orders exact → correct → wrong, computes points, keeps names within a tier', () => {
    const rows = orderLeagueGroupPicks(
      [
        { displayName: 'Zed', isYou: false, homeScore: 0, awayScore: 3, joker: false }, // wrong
        { displayName: 'Amy', isYou: true, homeScore: 2, awayScore: 1, joker: true }, // exact (joker)
        { displayName: 'Bo', isYou: false, homeScore: 3, awayScore: 0, joker: false }, // correct
      ],
      { home: 2, away: 1 },
    )
    expect(rows.map((r) => r.outcome)).toEqual(['exact', 'correct', 'wrong'])
    expect(rows[0]).toMatchObject({ displayName: 'Amy', points: 10, isYou: true })
    expect(rows[2].points).toBe(0)
  })
})

describe('orderLeagueKoPicks + casualties', () => {
  const picks = [
    { displayName: 'Winner-backer', isYou: false, homeStage: 'SF' as const, awayStage: 'R16' as const },
    { displayName: 'You-lost', isYou: true, homeStage: 'R16' as const, awayStage: 'SF' as const },
    { displayName: 'Loser-backer', isYou: false, homeStage: 'R16' as const, awayStage: 'FINAL' as const },
    { displayName: 'Neither', isYou: false, homeStage: 'R16' as const, awayStage: 'R16' as const },
  ]
  const rows = orderLeagueKoPicks(picks, 'r16', 'home') // home actually went through

  it('orders backed-winner → backed-loser → neither', () => {
    expect(rows.map((r) => r.backed)).toEqual(['home', 'away', 'away', null])
    expect(rows.map((r) => r.correct)).toEqual([true, false, false, null])
  })

  it('counts league casualties (backed the loser), excluding you, with an example', () => {
    const c = koLeagueCasualties(rows, true)
    expect(c.casualties).toBe(1) // only 'Loser-backer' (You-lost is excluded)
    expect(c.example).toBe('Loser-backer')
  })

  it('no casualties before a result', () => {
    expect(koLeagueCasualties(rows, false).casualties).toBe(0)
  })
})
