import { AiLabPage } from '../features/admin/AiLabPage'
import { previewCoverage, previewHealth, previewReview } from './aiLabPreviewContext'
import { mapAiLabSnapshot } from '../services/supabase/aiLabModel'

export const previewSnapshot = mapAiLabSnapshot({
  dashboard: {
    as_of: '2026-08-12T18:00:00Z',
    performance: {
      graded: 864, result_correct: 483, accuracy: 0.55903, exact_scores: 91,
      mean_log_loss: 1.0214, mean_rps: 0.2018, mean_brier: 0.6452,
    },
    models: [
      { id: 'epl-v4', league: 'EPL', version: 'v0.4', family: 'poisson', status: 'current', trained_at: '2026-08-10T07:00:00Z', training_matches: 2840, val_accuracy: 0.571, val_log_loss: 0.998 },
      { id: 'spl-v3', league: 'SPL', version: 'v0.3', family: 'logistic', status: 'current', trained_at: '2026-08-09T07:00:00Z', training_matches: 1550, val_accuracy: 0.548, val_log_loss: 1.027 },
      { id: 'sl2-v2', league: 'SL2', version: 'v0.2', family: 'poisson', status: 'candidate', trained_at: '2026-08-11T07:00:00Z', training_matches: 720, val_accuracy: 0.536, val_log_loss: 1.044 },
    ],
    calibration: [
      { bucket: 2, n: 154, mean_predicted: 0.34, actual_rate: 0.33 },
      { bucket: 3, n: 288, mean_predicted: 0.43, actual_rate: 0.41 },
      { bucket: 4, n: 251, mean_predicted: 0.54, actual_rate: 0.56 },
      { bucket: 5, n: 171, mean_predicted: 0.67, actual_rate: 0.65 },
    ],
    jobs: {
      sync_fixtures: { status: 'succeeded', rows_written: 126, started_at: '2026-08-12T06:00:00Z', finished_at: '2026-08-12T06:01:00Z' },
      predict: { status: 'succeeded', rows_written: 42, started_at: '2026-08-12T06:05:00Z', finished_at: '2026-08-12T06:06:00Z' },
      settle_bets: { status: 'succeeded', rows_written: 8, started_at: '2026-08-12T06:10:00Z', finished_at: '2026-08-12T06:10:30Z' },
    },
    gate: { public_enabled: false },
  },
  upcoming: [
    { id: 'p1', league: 'EPL', kickoff_at: '2026-08-15T14:00:00Z', home: 'Arsenal', away: 'Brighton', p_home: .58, p_draw: .24, p_away: .18, predicted_result: 'H', predicted_score: '2–1', model_version: 'v0.4', fixture_status: 'scheduled' },
    { id: 'p2', league: 'SPL', kickoff_at: '2026-08-15T15:00:00Z', home: 'Hearts', away: 'Motherwell', p_home: .49, p_draw: .28, p_away: .23, predicted_result: 'H', predicted_score: '1–0', model_version: 'v0.3', fixture_status: 'scheduled' },
  ],
  recent: [
    { id: 'r1', league: 'EPL', kickoff_at: '2026-08-09T14:00:00Z', home: 'Fulham', away: 'Everton', p_home: .44, p_draw: .29, p_away: .27, predicted_result: 'H', predicted_score: '1–0', actual_home_goals: 2, actual_away_goals: 0, result_correct: true, exact_score_correct: false, log_loss: .821, rps: .144, model_version: 'v0.4' },
    { id: 'r2', league: 'SL2', kickoff_at: '2026-08-09T15:00:00Z', home: 'Elgin City', away: 'Forfar Athletic', p_home: .31, p_draw: .32, p_away: .37, predicted_result: 'A', actual_home_goals: 1, actual_away_goals: 1, result_correct: false, exact_score_correct: false, log_loss: 1.139, rps: .228, model_version: 'v0.1' },
  ],
  breakdown: {
    overall: { n: 864, accuracy: .559, log_loss: 1.021, rps: .202 },
    by_league: {
      EPL: { n: 380, accuracy: .574, log_loss: .997 },
      SPL: { n: 228, accuracy: .548, log_loss: 1.028 },
      SL2: { n: 96, accuracy: .521, log_loss: 1.061 },
    },
  },
  betting: {
    clv: { n: 127, mean_clv: .0128, ci_low: .0031, ci_high: .0225, beat_close_rate: .574, significant: true },
    profit: { settled_bets: 143, staked: 143, pnl: 6.42, roi: .0449, hit_rate: .469, mean_odds: 2.18, mean_claimed_edge: .061 },
    open: { open_bets: 8, exposure: 6.2 },
    bookmakers: { total: 5, licence_verified: 3, unverified_real_books: [] },
    gate: { betting_public_enabled: false },
  },
  bettingGate: {
    settled_bets: { value: 127, required: 100, met: true },
    mean_clv: { value: .0128, required: .01, met: true },
    clv_ci_above_zero: { value: .0031, met: true },
    bookmaker_licences: { unverified: 0, met: true },
    age_gate: { met: false },
    safer_gambling_signpost: { value: null, met: false },
    full_record_published: { met: false },
    currently_public: false,
  },
  markets: {
    '1X2': { name: 'Match result', settled_bets: 143, clv_observations: 127, mean_clv: .0128, clv_ci_low: .0031, flat_unit_roi: .0449, required_bets: 100, required_clv: .01, trusted: true, meets_evidence_bar: true, free_historical_odds: true },
    OU25: { name: 'Over / under 2.5', settled_bets: 44, clv_observations: 39, mean_clv: .0062, flat_unit_roi: .018, required_bets: 100, required_clv: .01, trusted: false, meets_evidence_bar: false, free_historical_odds: true },
    AH: { name: 'Asian handicap', settled_bets: 20, clv_observations: 18, mean_clv: .004, flat_unit_roi: -.021, required_bets: 100, required_clv: .01, trusted: false, meets_evidence_bar: false, free_historical_odds: true },
  },
  odds: {
    month_to_date_credits: 80, monthly_credits: 500, soft_cap: 450,
    remaining_to_soft_cap: 370, cost_model_drift: 0,
    event_matching: { events_seen: 84, matched_to_fixture: 82, unmatched: ['Example United', 'Athletic FC'] },
    coverage: { EPL: ['h2h', 'totals'], SPL: ['h2h', 'totals'] },
    recent_calls: [
      { endpoint: 'events/odds', sport_key: 'soccer_epl', estimated_cost: 10, reported_cost: 10, reported_remaining: 420, rows_returned: 120, called_at: '2026-08-12T13:30:00Z' },
      { endpoint: 'events/odds', sport_key: 'soccer_spl', estimated_cost: 10, reported_cost: 10, reported_remaining: 410, rows_returned: 72, called_at: '2026-08-12T13:31:00Z' },
    ],
  },
})

export function AiLabPreview() {
  return (
    <AiLabPage
      previewSnapshot={previewSnapshot}
      previewContext={{ health: previewHealth, coverage: previewCoverage, review: previewReview }}
    />
  )
}
