import { describe, expect, it } from 'vitest'
import {
  presentLeagueFixture,
  presentLeagueMovement,
} from '../../../src/features/season/leagueFixtureModel'
import { presentLeagueMatchweek } from '../../../src/features/season/leagueMatchweekModel'
import { mapSeasonLeagueMatchweekPredictions } from '../../../src/services/supabase/seasonLeaguePredictionsModel'
import { mapSeasonLeagueMovement } from '../../../src/services/supabase/seasonLeagueMovementModel'

/**
 * Contracts 149 and 150 as the browser consumes them.
 *
 * WHAT THESE PROTECT. Three properties, each of which the previous UI session
 * could not have broken because the reads did not exist, and each of which is
 * now one careless edit away:
 *
 * 1. **The reveal boundary is the server's.** `revealed` comes from the read,
 *    which resolves the matchweek's own lock and accepts no time argument.
 *    Nothing in these models compares an instant to anything, so there is no
 *    clock for a change to get wrong.
 * 2. **Hidden means hidden completely.** No member rows and no predicted count
 *    before the lock — a count of who has already played is exactly what the
 *    boundary exists to withhold, and a decoder that "helpfully" filled it in
 *    would leak it.
 * 3. **Movement only from a settled matchweek.** Contract 150 answers
 *    `settled: false` for a matchweek still being scored, and reporting a climb
 *    out of totals that are still changing would show a player a position they
 *    never held.
 *
 * COUNTING IS NOT SCORING. `exact` and `correct` describe how a prediction
 * compares with the official result. No point value is derived anywhere below;
 * points come from `season_matchweek_scores` through the read and are null
 * until the matchweek settles.
 */

const FIXTURE_ONE = 'fixture-1'
const FIXTURE_TWO = 'fixture-2'

function payload(options: {
  revealed: boolean
  result?: { home: number; away: number } | null
  settledAt?: string | null
  /** Contract 171's two keys, absent unless a case is about them. */
  membersTruncated?: boolean
  memberCount?: number
}) {
  return {
    league: { id: 'league-1', name: 'The Office' },
    matchweek: {
      id: 'round-5',
      ordinal: 5,
      label: 'Matchweek 5',
      locks_at: '2026-08-15T11:30:00Z',
    },
    revealed: options.revealed,
    server_now: '2026-08-15T12:00:00Z',
    fixtures: [
      {
        id: FIXTURE_ONE,
        kickoff_at: '2026-08-15T14:00:00Z',
        status: options.result ? 'played' : 'scheduled',
        home: 'Arsenal',
        away: 'Chelsea',
        result: options.result ?? null,
      },
      {
        id: FIXTURE_TWO,
        kickoff_at: '2026-08-15T16:30:00Z',
        status: 'scheduled',
        home: 'Everton',
        away: 'Fulham',
        result: null,
      },
    ],
    member_count: options.memberCount ?? 3,
    predicted_count: options.revealed ? 2 : 0,
    members_returned: options.revealed ? 3 : 0,
    members_truncated: options.membersTruncated ?? false,
    members: options.revealed
      ? [
          {
            user_id: 'player-1',
            display_name: 'Alex',
            is_self: true,
            points: options.settledAt ? 12 : null,
            settled_at: options.settledAt ?? null,
            joker_played: false,
            predictions: {
              [FIXTURE_ONE]: { home: 2, away: 1 },
              [FIXTURE_TWO]: { home: 0, away: 0 },
            },
          },
          {
            user_id: 'player-2',
            display_name: 'Sam',
            is_self: false,
            points: options.settledAt ? 8 : null,
            settled_at: options.settledAt ?? null,
            joker_played: true,
            predictions: { [FIXTURE_ONE]: { home: 1, away: 0 } },
          },
          {
            user_id: 'player-3',
            display_name: 'Robin',
            is_self: false,
            points: null,
            settled_at: null,
            joker_played: false,
            predictions: {},
          },
        ]
      : [],
  }
}

describe('a league fixture, before and after the matchweek locks', () => {
  it('shows nothing at all before the lock, including how many have played', () => {
    const view = presentLeagueFixture(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: false })),
      FIXTURE_ONE,
    )

    expect(view.revealed).toBe(false)
    expect(view.rows).toEqual([])
    // Not "2 of 3 have predicted". The read withholds it, and so does this.
    expect(view.predictedCount).toBe(0)
    // The member COUNT is not a disclosure — it is the size of a league the
    // caller belongs to — and stays available so the surface can say so.
    expect(view.memberCount).toBe(3)
  })

  it('names every member’s prediction once the matchweek has locked', () => {
    const view = presentLeagueFixture(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: true })),
      FIXTURE_ONE,
    )

    expect(view.revealed).toBe(true)
    expect(view.rows.map((row) => [row.displayName, row.predictionLabel])).toEqual([
      ['Alex', '2 - 1'],
      ['Sam', '1 - 0'],
      // A member who predicted nothing is kept and shown as having none, rather
      // than dropped from their own league.
      ['Robin', null],
    ])
    expect(view.rows[0]?.isSelf).toBe(true)
  })

  it('counts an exact score and a correct result without awarding a point', () => {
    const view = presentLeagueFixture(
      mapSeasonLeagueMatchweekPredictions(
        payload({ revealed: true, result: { home: 2, away: 1 }, settledAt: '2026-08-15T18:00:00Z' }),
      ),
      FIXTURE_ONE,
    )

    expect(view.rows.map((row) => [row.displayName, row.outcome])).toEqual([
      ['Alex', 'exact'],
      ['Sam', 'correct'],
      ['Robin', null],
    ])
    // Points are the MATCHWEEK's, from the read, and are never per fixture.
    expect(view.rows[0]?.matchweekPoints).toBe(12)
    expect(view.settled).toBe(true)
  })

  it('reports no outcome at all until the fixture has an official result', () => {
    const view = presentLeagueFixture(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: true })),
      FIXTURE_ONE,
    )
    expect(view.rows.every((row) => row.outcome === null)).toBe(true)
    // And absent points are absent, not zero.
    expect(view.rows[0]?.matchweekPoints).toBeNull()
  })
})

describe('the matchweek grid and its phone layout', () => {
  it('builds one cell per fixture for every member, in the fixtures’ order', () => {
    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: true })),
      'UTC',
    )

    expect(view.members.map((member) => member.cells.map((cell) => cell.label))).toEqual([
      ['2 - 1', '0 - 0'],
      ['1 - 0', null],
      [null, null],
    ])
    expect(view.members[0]?.predicted).toBe(2)
  })

  it('puts the caller’s own row first in every fixture, which the grid does not', () => {
    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: true })),
      'UTC',
    )

    const first = view.fixtures[0]
    expect(first?.rows.map((row) => row.displayName)).toEqual(['Alex', 'Sam'])
    expect(first?.rows[0]?.isSelf).toBe(true)
    // The grid keeps the server's order, which is points-descending once
    // settled — the two layouts answer different questions.
    expect(view.members.map((member) => member.displayName)).toEqual(['Alex', 'Sam', 'Robin'])
  })

  it('hides every fixture row before the lock', () => {
    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: false })),
      'UTC',
    )
    expect(view.revealed).toBe(false)
    expect(view.members).toEqual([])
    expect(view.fixtures.every((fixture) => fixture.rows.length === 0)).toBe(true)
  })

  // ---------------------------------------------------------------------
  // Contract 171.
  // ---------------------------------------------------------------------

  it('carries what the read actually returned against the league’s real size', () => {
    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(
        payload({ revealed: true, membersTruncated: true, memberCount: 300 }),
      ),
      'UTC',
    )

    expect(view.coverage).toEqual({ returned: 3, total: 300, truncated: true })
    // The caption's own two numbers are whole-league counts the server takes
    // across every member, so truncation does not make them wrong.
    expect(view.memberCount).toBe(300)
    expect(view.predictedCount).toBe(2)
  })

  it('reports no truncation when the server reported none', () => {
    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(payload({ revealed: true })),
      'UTC',
    )

    expect(view.coverage).toEqual({ returned: 3, total: 3, truncated: false })
  })

  it('never claims truncation of a hidden matchweek, which carries no rows by rule', () => {
    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(
        payload({ revealed: false, memberCount: 300 }),
      ),
      'UTC',
    )

    // Zero rows out of three hundred, and NOT truncated: the emptiness is the
    // reveal boundary, and a "showing 0 of 300" line would describe a cap that
    // did not happen.
    expect(view.coverage).toEqual({ returned: 0, total: 300, truncated: false })
  })

  it('counts the rows it kept, not the rows it was sent', () => {
    // A member row this decoder discards as malformed is also a member the
    // surface is not showing, and the coverage line is what admits that.
    const base = payload({ revealed: true, membersTruncated: true, memberCount: 300 })
    const withRubbish = {
      ...base,
      members: [...base.members, { display_name: 'No identity' }, null],
    }

    const view = presentLeagueMatchweek(
      mapSeasonLeagueMatchweekPredictions(withRubbish),
      'UTC',
    )

    expect(view.members).toHaveLength(3)
    expect(view.coverage.returned).toBe(3)
  })

  it('reads a server that predates contract 171 as untruncated rather than unknown', () => {
    const { members_returned: _r, members_truncated: _t, ...older } = payload({
      revealed: true,
    })

    const view = presentLeagueMatchweek(mapSeasonLeagueMatchweekPredictions(older), 'UTC')

    expect(view.coverage).toEqual({ returned: 3, total: 3, truncated: false })
  })
})

describe('rank movement over a settled matchweek', () => {
  function movement(settled: boolean) {
    return mapSeasonLeagueMovement({
      league: { id: 'league-1' },
      matchweek: { id: 'round-5', ordinal: 5, label: 'Matchweek 5' },
      settled,
      server_now: '2026-08-15T18:00:00Z',
      members: [
        {
          user_id: 'player-1',
          display_name: 'Alex',
          is_self: true,
          points_before: 40,
          points_after: 52,
          points_this_matchweek: 12,
          rank_before: 5,
          rank_after: 3,
          movement: 2,
          gap_to_leader_before: 9,
          gap_to_leader_after: 4,
        },
        {
          user_id: 'player-2',
          display_name: 'Sam',
          is_self: false,
          points_before: 49,
          points_after: 56,
          points_this_matchweek: 7,
          rank_before: 1,
          rank_after: 1,
          movement: 0,
          gap_to_leader_before: 0,
          gap_to_leader_after: 0,
        },
      ],
    })
  }

  it('reports the caller’s climb, with the field it climbed through', () => {
    const line = presentLeagueMovement(movement(true))
    expect(line).toEqual({
      settled: true,
      matchweekLabel: 'Matchweek 5',
      rankBefore: 5,
      rankAfter: 3,
      movement: 2,
      pointsThisMatchweek: 12,
      gapToLeaderAfter: 4,
      fieldSize: 2,
    })
  })

  it('reports nothing at all from a matchweek that has not settled', () => {
    // The decoder drops the rows and the presenter refuses to speak. A climb
    // out of totals that are still changing is a position nobody held.
    const unsettled = movement(false)
    expect(unsettled.members).toEqual([])
    expect(presentLeagueMovement(unsettled)).toBeNull()
  })
})
