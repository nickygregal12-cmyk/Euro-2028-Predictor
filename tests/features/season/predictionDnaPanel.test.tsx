import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PredictionDnaPanel } from '../../../src/features/season/PredictionDnaPanel'
import {
  mapSeasonPredictionDna,
  type SeasonPredictionDna,
} from '../../../src/services/supabase/seasonPredictionDnaModel'

/**
 * `INNOV-002` on screen, over contract 176. The panel's job is to keep every
 * percentage attached to what it was measured over, and to say when the server
 * called a sample too small rather than quietly rendering the number anyway.
 */

type Payload = Record<string, unknown>

function decode(over: Payload = {}): SeasonPredictionDna {
  return mapSeasonPredictionDna({
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
  })
}

const mount = (dna: SeasonPredictionDna, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PredictionDnaPanel dna={dna} {...props} />
    </MemoryRouter>,
  )

describe('PredictionDnaPanel', () => {
  it('prints each group with the denominator it was measured over', () => {
    mount(decode())
    expect(screen.getByRole('heading', { name: 'Prediction DNA' })).toBeInTheDocument()
    // The denominator sits directly under each group's heading, so it is never
    // more than a glance away from the percentages beneath it.
    expect(screen.getByRole('heading', { name: 'How they predict' })).toBeInTheDocument()
    expect(screen.getByText('40 locked predictions')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How often they are right' })).toBeInTheDocument()
    expect(screen.getByText('30 settled predictions')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'With the crowd, or against it' }),
    ).toBeInTheDocument()
    expect(screen.getByText('22 comparable fixtures')).toBeInTheDocument()
  })

  it('keeps every percentage beside its own counts', () => {
    mount(decode())
    expect(screen.getByText('13%')).toBeInTheDocument()
    expect(screen.getByText('4 of 30 settled')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('24 of 40')).toBeInTheDocument()
  })

  it('states what the field comparison excluded', () => {
    mount(decode())
    expect(screen.getByText(/8 fixtures are not comparable/)).toBeInTheDocument()
  })

  it('withholds the signature and offers no share when the sample is short', () => {
    mount(
      decode({
        player: { user_id: 'u-me', display_name: 'You', is_self: true },
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
        accuracy: null,
        consensus: null,
      }),
      { share: { competitionName: 'Premier League', url: '/x' } },
    )
    expect(screen.queryByText('Goals optimist')).not.toBeInTheDocument()
    expect(screen.getByText('Measured over 4 predictions. Habits settle after 10.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Share your DNA/ })).not.toBeInTheDocument()
  })

  it('names the player rather than showing an empty profile when they never entered', () => {
    mount(
      decode({
        entered: false,
        predictions_counted: 0,
        settled_predictions: 0,
        tendencies: null,
        accuracy: null,
        consensus: null,
        clubs: [],
      }),
    )
    expect(
      screen.getByText(/Craig has not entered this season/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('says nothing has locked yet rather than reporting zero habits', () => {
    mount(
      decode({
        predictions_counted: 0,
        settled_predictions: 0,
        tendencies: { denominator: 0, sufficient: false },
        accuracy: { denominator: 0, sufficient: false },
        consensus: { minimum_cohort: 10, measured: 0, sufficient: false },
        clubs: [],
      }),
    )
    expect(screen.getByText(/described once a matchweek has locked/)).toBeInTheDocument()
  })

  it('compares against the viewer only on somebody else’s page', () => {
    const theirs = decode()
    const mine = decode({ player: { user_id: 'u-me', display_name: 'You', is_self: true } })
    mount(theirs, { compareWith: mine })
    expect(screen.getByRole('heading', { name: 'Against you' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Craig' })).toBeInTheDocument()
  })

  it('does not compare a player with themselves', () => {
    const mine = decode({ player: { user_id: 'u-me', display_name: 'You', is_self: true } })
    mount(mine, { compareWith: mine })
    expect(screen.queryByRole('heading', { name: 'Against you' })).not.toBeInTheDocument()
  })
})
