import { describe, expect, it } from 'vitest'
import { describeBranch, presentWhatIf } from '../../../src/features/season/whatIfModel'
import { mapSeasonMatchweekProjection } from '../../../src/services/supabase/seasonMatchweekProjectionModel'

/**
 * `INNOV-001` over contract 175.
 *
 * WHAT THESE TESTS ARE FOR, NOW THAT THE PROJECTION IS THE SERVER'S. They no
 * longer check arithmetic — there is none left in the module — and instead
 * check the three things a presentation layer can still get wrong: showing a
 * projection where there is nothing to project, mislabelling which basis a
 * score came from, and turning a hidden league into an empty one.
 *
 * The payloads below are shaped exactly as `get_season_matchweek_projection`
 * returns them, snake_case included, and go through the real decoder — a test
 * that hand-builds the decoded type proves nothing about the wire format.
 */

type Payload = Record<string, unknown>

function payload(over: Payload = {}): unknown {
  return {
    server_now: '2026-08-12T14:20:00Z',
    tournament_id: 't-1',
    matchweek: { matchweek_id: 'r-1', ordinal: 5, label: 'Matchweek 5' },
    locks_at: '2026-08-12T11:30:00Z',
    locked: true,
    joker_played: false,
    projected_points: 8,
    settled: false,
    fixtures: [inPlayFixture()],
    league: null,
    ...over,
  }
}

function inPlayFixture(over: Payload = {}): Payload {
  return {
    fixture_id: 'fx-1',
    home_team_id: 'team-h',
    away_team_id: 'team-a',
    kickoff_at: '2026-08-12T14:00:00Z',
    status: 'scheduled',
    basis: 'provisional',
    official: null,
    provisional: {
      home: 1,
      away: 1,
      provider_status: 'IN_PLAY',
      kind: 'in_play',
      observed_at: '2026-08-12T14:19:00Z',
    },
    prediction: { home: 2, away: 1 },
    points: 0,
    branches: {
      home_scores: { home: 2, away: 1, matchweek_points: 13 },
      away_scores: { home: 1, away: 2, matchweek_points: 8 },
    },
    ...over,
  }
}

const present = (raw: unknown) =>
  presentWhatIf(mapSeasonMatchweekProjection(raw), 'fx-1', 'Liverpool', 'Arsenal')

describe('presentWhatIf', () => {
  it('reports every figure the server sent and derives no point value of its own', () => {
    const view = present(payload())
    expect(view.available).toBe(true)
    if (!view.available) return

    expect(view.matchweekPoints).toBe(8)
    expect(view.live).toEqual({ home: 1, away: 1 })
    expect(view.branches.map((branch) => branch.matchweekPoints)).toEqual([8, 13, 8])
    // The change is the difference between two server numbers, never a
    // browser-computed fixture score.
    expect(view.branches.map((branch) => branch.change)).toEqual([0, 5, 0])
  })

  it('names the branch that would make the prediction exact', () => {
    const view = present(payload())
    if (!view.available) throw new Error('expected an available projection')
    const home = view.branches.find((branch) => branch.key === 'home')
    expect(home?.reason).toBe('exact_score')
    expect(describeBranch(home!)).toContain('exact')
    expect(describeBranch(home!)).toContain('5 more across the matchweek')
  })

  it('renders nothing once the matchweek has been banked', () => {
    expect(present(payload({ settled: true }))).toEqual({ available: false, reason: 'settled' })
  })

  it('renders nothing for a fixture with an official result', () => {
    const official = inPlayFixture({
      basis: 'official',
      official: { home: 2, away: 1 },
      provisional: null,
      branches: null,
      points: 5,
    })
    expect(present(payload({ fixtures: [official] }))).toEqual({
      available: false,
      reason: 'fixture_settled',
    })
  })

  it('renders nothing when no score of any kind has been reported', () => {
    const none = inPlayFixture({ basis: 'none', provisional: null, branches: null })
    expect(present(payload({ fixtures: [none] }))).toEqual({
      available: false,
      reason: 'no_live_score',
    })
  })

  it('says so rather than guessing when the projection does not carry the fixture', () => {
    expect(present(payload({ fixtures: [] }))).toEqual({
      available: false,
      reason: 'fixture_absent',
    })
  })

  it('still answers with the current score when the server offered no branches', () => {
    const noBranches = inPlayFixture({ branches: null })
    const view = present(payload({ fixtures: [noBranches] }))
    if (!view.available) throw new Error('expected an available projection')
    expect(view.branches).toHaveLength(1)
    expect(view.branches[0]?.key).toBe('now')
  })

  it('keeps a league hidden before the matchweek locks, with no rows at all', () => {
    const view = present(
      payload({
        locked: false,
        league: {
          league_id: 'lg-1',
          name: 'The Office',
          revealed: false,
          reason: 'matchweek_not_locked',
          locks_at: '2026-08-15T11:30:00Z',
          members_returned: 0,
          members_truncated: false,
          table: [],
        },
      }),
    )
    if (!view.available) throw new Error('expected an available projection')
    expect(view.league).toEqual({
      revealed: false,
      leagueName: 'The Office',
      locksAt: '2026-08-15T11:30:00Z',
    })
  })

  it('carries the server ranks after the lock without recomputing them', () => {
    const view = present(
      payload({
        league: {
          league_id: 'lg-1',
          name: 'The Office',
          revealed: true,
          reason: null,
          locks_at: '2026-08-12T11:30:00Z',
          members_total: 12,
          members_returned: 2,
          members_truncated: true,
          table: [
            {
              user_id: 'u-craig',
              display_name: 'Craig',
              is_self: false,
              entered: true,
              banked_points: 43,
              projected_matchweek_points: 11,
              projected_points: 54,
              current_rank: 1,
              projected_rank: 1,
            },
            {
              user_id: 'u-me',
              display_name: 'You',
              is_self: true,
              entered: true,
              banked_points: 40,
              projected_matchweek_points: 8,
              projected_points: 48,
              current_rank: 2,
              projected_rank: 2,
            },
          ],
        },
      }),
    )
    if (!view.available) throw new Error('expected an available projection')
    const league = view.league
    if (!league || !league.revealed) throw new Error('expected a revealed league')
    expect(league.you?.projectedRank).toBe(2)
    expect(league.leaderName).toBe('Craig')
    expect(league.gapToLeader).toBe(6)
    expect(league.membersTruncated).toBe(true)
    expect(league.membersTotal).toBe(12)
  })
})

describe('mapSeasonMatchweekProjection', () => {
  it('refuses a payload it cannot read rather than defaulting the shape', () => {
    expect(() => mapSeasonMatchweekProjection({ tournament_id: 't-1' })).toThrow(
      /not in the expected shape/,
    )
    expect(() => mapSeasonMatchweekProjection(null)).toThrow(/not in the expected shape/)
  })

  it('drops a fixture whose basis it does not recognise', () => {
    const decoded = mapSeasonMatchweekProjection(
      payload({ fixtures: [inPlayFixture({ basis: 'guessed' })] }),
    )
    expect(decoded.fixtures).toHaveLength(0)
  })

  it('never reads a provisional score as an official one', () => {
    const decoded = mapSeasonMatchweekProjection(payload())
    expect(decoded.fixtures[0]?.official).toBeNull()
    expect(decoded.fixtures[0]?.provisional?.kind).toBe('in_play')
  })

  it('drops a half-built branch pair rather than offering one side a next goal', () => {
    const decoded = mapSeasonMatchweekProjection(
      payload({
        fixtures: [
          inPlayFixture({
            branches: { home_scores: { home: 2, away: 1, matchweek_points: 13 } },
          }),
        ],
      }),
    )
    expect(decoded.fixtures[0]?.branches).toBeNull()
  })
})
