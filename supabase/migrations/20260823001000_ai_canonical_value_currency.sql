-- Contract 215: value evidence must use the forecast the Lab currently shows.
--
-- A fixture deliberately owns several immutable forecast horizons. Contract 202
-- widened those horizons so new completed football can reach a fixture as the
-- clock moves from t168 to t120/t72/t48/t24/t6. Contract 201 separately defined
-- `ai.canonical_fixture_predictions` as the one newest non-quarantined forecast
-- every fixture-level read should show.
--
-- The value loop and current-recommendation view did not finish that currency
-- rule. `find_value.py` could assess every historical valid prediction and this
-- view then picked the newest recommendation regardless of whether it belonged
-- to the canonical forecast. That creates two bad states:
--   * the immutable paper bet can be recorded from an older horizon while the
--     screen shows a newer forecast;
--   * after a new forecast arrives but before value is recalculated, yesterday's
--     recommendation still looks current.
--
-- `find_value.py` now reads `ai.canonical_fixture_predictions`. This migration
-- makes the read side fail closed too: a recommendation is current only when it
-- belongs to the fixture's canonical forecast. A new unpriced forecast therefore
-- produces NO current recommendation until the normal value job evaluates it.
-- Old recommendation rows remain immutable audit evidence.

begin;

create or replace view ai.current_fixture_recommendations as
  select distinct on (cp.fixture_id)
         cp.fixture_id,
         r.id            as recommendation_id,
         r.prediction_id,
         r.league, r.market, r.selection, r.decision, r.reason_codes,
         r.bookmaker, r.odds_offered, r.odds_captured_at, r.odds_age_seconds,
         r.calibrated_prob, r.fair_odds, r.expected_value,
         r.data_confidence, r.data_confidence_state,
         r.agreement_score, r.uncertainty_width,
         r.decided_at, r.kickoff_at, r.hours_to_kickoff, r.evidence
    from ai.canonical_fixture_predictions cp
    join ai.recommendations r on r.prediction_id = cp.id
   order by cp.fixture_id, r.decided_at desc, r.id desc;

comment on view ai.current_fixture_recommendations is
  'The newest recorded decision for each fixture ONLY when it belongs to that '
  'fixture''s canonical newest non-quarantined forecast. If a fresher forecast '
  'exists but has not yet been evaluated, there is deliberately no current '
  'recommendation; stale advice never crosses a forecast-version boundary. Old '
  'recommendations remain immutable audit evidence.';

commit;
