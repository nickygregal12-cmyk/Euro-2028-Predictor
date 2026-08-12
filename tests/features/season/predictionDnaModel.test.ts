import { describe, expect, it } from 'vitest'
import {
  compareDna,
  presentPredictionDna,
  type PredictionDna,
} from '../../../src/features/season/predictionDnaModel'
import { mapSeasonPredictionDna } from '../../../src/services/supabase/seasonPredictionDnaModel'

/**
 * `INNOV-002` over contract 176.
 *
 * WHAT THESE TESTS ARE FOR. Since the metrics became the server's, the way this
 * surface can still be wrong is by DETACHING a figure from what it was measured
 * over: quoting a rate whose group the server called insufficient, printing a
 * null rate as 0%, sharing a signature from four predictions, or comparing two
 * players on samples of very different sizes. Every case below is one of those.
 *
 * The payloads are shaped exactly as `get_season_prediction_dna` returns them,
 * snake_case included, and go through the real decoder.
 */

type Payload = Record<string, unknown>

function payload(over: Payload = {}): unknown {
  return {
    player: { user_id: 'u-1', display_name: 'Craig', is_self: false },
    entered: true,
    server_now: '2026-08-12T14:20:00Z',
    minimum_sample: 10,
    predictions_counted: 40,
    settled_predictions: 30,
    tendencies: {
      denominator: 40,
      sufficient: true,
      home_wins: 24,
      draws: 6,
      away_wins: 10,
      home_win_rate: 0.6,
      draw_rate: 0.15,
      away_win_rate: 0.25,
      average_predicted_goals: 3.2,
      average_predicted_margin: 0.6,
      most_common_scoreline: { home: 2, away: 1, count: 9 },
    },
    accuracy: {
      denominator: 30,
      sufficient: true,
      exact_scores: 4,
      correct_outcomes: 17,
      exact_score_rate: 0.1333,
      correct_outcome_rate: 0.5667,
    },
    consensus: {
      minimum_cohort: 10,
      settled_fixtures: 30,
      measured: 22,
      excluded_small_cohort: 5,
      excluded_no_consensus: 3,
      sufficient: true,
      agreed_with_field: 15,
      against_field: 7,
      against_field_correct: 3,
      agreement_rate: 0.6818,
      against_field_success_rate: 0.4286,
    },
    clubs: [
      {
        team_id: 'team-1',
        name: 'Liverpool',
        predictions: 9,
        settled: 7,
        exact_scores: 2,
        correct_outcomes: 5,
        predicted_to_win: 7,
        sufficient: false,
      },
    ],
    ...over,
  }
}

const present = (raw: unknown) => presentPredictionDna(mapSeasonPredictionDna(raw))

const available = (dna: PredictionDna): Extract<PredictionDna, { available: true }> => {
  if (!dna.available) throw new Error('expected an available profile')
  return dna
}

describe('presentPredictionDna', () => {
  it('keeps three groups with three separate denominators', () => {
    const dna = available(present(payload()))
    expect(dna.groups.map((group) => group.key)).toEqual([
      'tendencies',
      'accuracy',
      'consensus',
    ])
    expect(dna.groups.map((group) => group.denominator)).toEqual([40, 30, 22])
  })

  it('quotes the server rates and never recomputes them from the counts', () => {
    const dna = available(present(payload()))
    const accuracy = dna.groups.find((group) => group.key === 'accuracy')
    expect(accuracy?.metrics.find((metric) => metric.key === 'exact')).toMatchObject({
      value: '13%',
      detail: '4 of 30 settled',
    })
  })

  it('names what the agreement metric could not compare, rather than implying it saw everything', () => {
    const dna = available(present(payload()))
    const consensus = dna.groups.find((group) => group.key === 'consensus')
    expect(consensus?.caution).toContain('8 fixtures are not comparable')
    expect(consensus?.caution).toContain('fewer than 10 players predicted it')
  })

  it('withholds the signature when the tendency sample is short, and states the shortfall', () => {
    const short = payload({
      predictions_counted: 4,
      tendencies: {
        denominator: 4,
        sufficient: false,
        home_wins: 3,
        draws: 0,
        away_wins: 1,
        home_win_rate: 0.75,
        draw_rate: 0,
        away_win_rate: 0.25,
        average_predicted_goals: 3.5,
        average_predicted_margin: 1,
        most_common_scoreline: { home: 2, away: 1, count: 2 },
      },
    })
    const dna = available(present(short))
    expect(dna.signature).toBeNull()
    const tendencies = dna.groups.find((group) => group.key === 'tendencies')
    expect(tendencies?.sufficient).toBe(false)
    expect(tendencies?.caution).toBe('Measured over 4 predictions. Habits settle after 10.')
    // The counts are still shown. A short sample is stated, not hidden.
    expect(tendencies?.metrics.find((metric) => metric.key === 'home')?.detail).toBe('3 of 4')
  })

  it('renders no metric at all for a rate the server sent as null', () => {
    const dna = available(
      present(
        payload({
          accuracy: {
            denominator: 3,
            sufficient: false,
            exact_scores: 0,
            correct_outcomes: 0,
            exact_score_rate: null,
            correct_outcome_rate: null,
          },
        }),
      ),
    )
    expect(dna.groups.some((group) => group.key === 'accuracy')).toBe(false)
  })

  it('answers "not entered" as a state rather than as a zeroed profile', () => {
    const dna = present(
      payload({
        entered: false,
        predictions_counted: 0,
        settled_predictions: 0,
        tendencies: null,
        accuracy: null,
        consensus: null,
        clubs: [],
      }),
    )
    expect(dna).toMatchObject({ available: false, reason: 'not_entered', playerName: 'Craig' })
  })

  it('tells an entered player with nothing locked apart from one who never entered', () => {
    const dna = present(
      payload({
        predictions_counted: 0,
        settled_predictions: 0,
        tendencies: { denominator: 0, sufficient: false },
        accuracy: { denominator: 0, sufficient: false },
        consensus: { minimum_cohort: 10, measured: 0, sufficient: false },
        clubs: [],
      }),
    )
    expect(dna).toMatchObject({ available: false, reason: 'no_locked_predictions' })
  })

  it('reports a club without claiming a rate over a sample the server called short', () => {
    const dna = available(present(payload()))
    expect(dna.clubs[0]).toEqual({
      teamId: 'team-1',
      name: 'Liverpool',
      backing: 'Backed to win 7 of 9 times',
      accuracy: '2 exact, 5 right result of 7 settled',
      sufficient: false,
    })
  })
})

describe('compareDna', () => {
  it('compares only metrics both sides measured sufficiently', () => {
    const mine = present(payload({ player: { user_id: 'u-me', display_name: 'You', is_self: true } }))
    const theirs = present(
      payload({
        // Their accuracy block is short of the minimum, so its two metrics must
        // not appear beside a settled figure of the caller's.
        accuracy: {
          denominator: 3,
          sufficient: false,
          exact_scores: 1,
          correct_outcomes: 2,
          exact_score_rate: 0.3333,
          correct_outcome_rate: 0.6667,
        },
      }),
    )
    const lines = compareDna(mine, theirs, 'Craig')
    expect(lines.some((line) => line.key === 'exact')).toBe(false)
    expect(lines.some((line) => line.key === 'goals')).toBe(true)
  })

  it('states a difference as arithmetic and never as a judgement', () => {
    const mine = present(
      payload({
        player: { user_id: 'u-me', display_name: 'You', is_self: true },
        tendencies: {
          denominator: 40,
          sufficient: true,
          home_wins: 24,
          draws: 6,
          away_wins: 10,
          home_win_rate: 0.6,
          draw_rate: 0.15,
          away_win_rate: 0.25,
          average_predicted_goals: 4,
          average_predicted_margin: 0.6,
          most_common_scoreline: { home: 2, away: 1, count: 9 },
        },
      }),
    )
    const theirs = present(payload())
    const goals = compareDna(mine, theirs, 'Craig').find((line) => line.key === 'goals')
    expect(goals?.mine).toBe('4.0')
    expect(goals?.theirs).toBe('3.2')
    expect(goals?.difference).toBe('25% more goals than Craig.')
  })

  it('compares nothing at all when either side is unavailable', () => {
    const mine = present(payload({ player: { user_id: 'u-me', display_name: 'You', is_self: true } }))
    const theirs = present(payload({ entered: false, tendencies: null, accuracy: null, consensus: null, clubs: [] }))
    expect(compareDna(mine, theirs, 'Craig')).toEqual([])
  })
})

describe('mapSeasonPredictionDna', () => {
  it('refuses a payload it cannot read', () => {
    expect(() => mapSeasonPredictionDna({ entered: true })).toThrow(/not in the expected shape/)
  })

  it('treats a non-numeric rate as absent rather than as zero', () => {
    const decoded = mapSeasonPredictionDna(
      payload({
        tendencies: {
          denominator: 40,
          sufficient: true,
          home_wins: 24,
          draws: 6,
          away_wins: 10,
          home_win_rate: '0.6',
          draw_rate: null,
          away_win_rate: 0.25,
          average_predicted_goals: null,
          average_predicted_margin: null,
          most_common_scoreline: null,
        },
      }),
    )
    expect(decoded.tendencies?.homeWinRate).toBeNull()
    expect(decoded.tendencies?.drawRate).toBeNull()
    expect(decoded.tendencies?.awayWinRate).toBe(0.25)
  })
})
