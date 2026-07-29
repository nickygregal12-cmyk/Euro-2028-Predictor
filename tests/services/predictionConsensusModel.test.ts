import { describe, expect, it } from 'vitest'
import { mapPredictionConsensus } from '../../src/services/supabase/predictionConsensusModel'

const basePayload = {
  server_now: '2028-06-09T12:00:00.000Z',
  locked_at: '2028-06-09T10:00:00.000Z',
  submitted_entries: 3,
  champion_race: [{ team_id: 'team-1', picks: 2 }],
  peoples_final: [{ team_a_id: 'team-1', team_b_id: 'team-2', picks: 2 }],
  golden_boot: [{ player_id: 'player-1', team_id: 'team-1', picks: 2 }],
  most_agreed_match: {
    match_id: 'match-1',
    match_ref: 'M1',
    home_team_id: 'team-1',
    away_team_id: 'team-2',
    predictions: 3,
    home_picks: 2,
    draw_picks: 0,
    away_picks: 1,
    dominant_outcome: 'home',
    dominant_picks: 2,
  },
  most_divided_match: {
    match_id: 'match-2',
    match_ref: 'M2',
    home_team_id: 'team-3',
    away_team_id: 'team-4',
    predictions: 3,
    home_picks: 1,
    draw_picks: 1,
    away_picks: 1,
    top_two_gap: 0,
  },
  most_trusted_team: { team_id: 'team-1', predicted_wins: 4 },
  goals_spread: {
    minimum: 4,
    median: 6,
    maximum: 8,
    average: 6,
    distinct_totals: 3,
    distribution: [
      { total_goals: 4, entries: 1 },
      { total_goals: 6, entries: 1 },
      { total_goals: 8, entries: 1 },
    ],
  },
  only_you: [
    { kind: 'champion', team_id: 'team-3' },
    {
      kind: 'exact_score',
      match_id: 'match-2',
      match_ref: 'M2',
      home_score: 1,
      away_score: 1,
    },
  ],
}

describe('prediction consensus response model', () => {
  it('maps the bounded aggregate response', () => {
    const result = mapPredictionConsensus(basePayload)

    expect(result.submittedEntries).toBe(3)
    expect(result.championRace).toEqual([{ teamId: 'team-1', picks: 2 }])
    expect(result.mostAgreedMatch?.dominantOutcome).toBe('home')
    expect(result.goalsSpread.distribution).toHaveLength(3)
    expect(result.onlyYou).toEqual([
      { kind: 'champion', teamId: 'team-3' },
      {
        kind: 'exact_score',
        matchId: 'match-2',
        matchRef: 'M2',
        homeScore: 1,
        awayScore: 1,
      },
    ])
  })

  it('accepts empty nullable aggregate states', () => {
    const result = mapPredictionConsensus({
      ...basePayload,
      submitted_entries: 0,
      champion_race: [],
      peoples_final: [],
      golden_boot: [],
      most_agreed_match: null,
      most_divided_match: null,
      most_trusted_team: null,
      goals_spread: {
        minimum: null,
        median: null,
        maximum: null,
        average: null,
        distinct_totals: 0,
        distribution: [],
      },
      only_you: [],
    })

    expect(result.submittedEntries).toBe(0)
    expect(result.mostAgreedMatch).toBeNull()
    expect(result.goalsSpread.minimum).toBeNull()
  })

  it('rejects oversized ranked lists and distributions', () => {
    expect(() =>
      mapPredictionConsensus({
        ...basePayload,
        champion_race: Array.from({ length: 11 }, (_, index) => ({
          team_id: `team-${index}`,
          picks: 1,
        })),
      }),
    ).toThrow(/champion race/i)

    expect(() =>
      mapPredictionConsensus({
        ...basePayload,
        goals_spread: {
          ...basePayload.goals_spread,
          distribution: Array.from({ length: 41 }, (_, index) => ({
            total_goals: index,
            entries: 1,
          })),
        },
      }),
    ).toThrow(/goals distribution/i)
  })

  it('rejects inconsistent match totals', () => {
    expect(() =>
      mapPredictionConsensus({
        ...basePayload,
        most_agreed_match: {
          ...basePayload.most_agreed_match,
          predictions: 4,
        },
      }),
    ).toThrow(/outcome counts/i)
  })

  it('rejects unordered goal buckets and malformed unique picks', () => {
    expect(() =>
      mapPredictionConsensus({
        ...basePayload,
        goals_spread: {
          ...basePayload.goals_spread,
          distribution: [
            { total_goals: 6, entries: 1 },
            { total_goals: 4, entries: 1 },
          ],
        },
      }),
    ).toThrow(/ordering/i)

    expect(() =>
      mapPredictionConsensus({
        ...basePayload,
        only_you: [{ kind: 'mystery' }],
      }),
    ).toThrow(/kind/i)
  })
})
