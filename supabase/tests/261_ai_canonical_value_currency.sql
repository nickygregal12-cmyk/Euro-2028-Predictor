-- Contract 214: current value evidence cannot survive a newer forecast.

begin;

select plan(5);

insert into ai.models (id, league, version, family, training_matches, artifact_sha256)
values ('00000000-0000-4000-8000-000000000601', 'EPL', 'c214-old', 'poisson', 10, repeat('a', 64)),
       ('00000000-0000-4000-8000-000000000602', 'EPL', 'c214-new', 'poisson', 10, repeat('b', 64));

insert into ai.fixtures (id, division, season, league_key, match_date, kickoff_at,
                         home_canonical, away_canonical)
values ('00000000-0000-4000-8000-000000000603', 'E0', '2627', 'EPL',
        (now() + interval '3 days')::date, now() + interval '3 days',
        'C214 Home', 'C214 Away');

insert into ai.predictions (id, model_id, league, fixture_id, kickoff_at,
                            home_canonical, away_canonical, p_home, p_draw, p_away,
                            predicted_result, features, horizon, hours_to_kickoff,
                            features_version, data_snapshot_at, created_at)
values ('00000000-0000-4000-8000-000000000604',
        '00000000-0000-4000-8000-000000000601', 'EPL',
        '00000000-0000-4000-8000-000000000603', now() + interval '3 days',
        'C214 Home', 'C214 Away', .48, .27, .25, 'H', '{}', 't120', 100, 'f2',
        now() - interval '2 days', now() - interval '2 days'),
       ('00000000-0000-4000-8000-000000000605',
        '00000000-0000-4000-8000-000000000602', 'EPL',
        '00000000-0000-4000-8000-000000000603', now() + interval '3 days',
        'C214 Home', 'C214 Away', .37, .27, .36, 'H', '{}', 't72', 72, 'f2',
        now() - interval '1 hour', now() - interval '1 hour');

insert into ai.recommendations (prediction_id, model_id, league, market, selection,
                                decision, reason_codes, bookmaker, odds_offered,
                                calibrated_prob, fair_odds, expected_value, kickoff_at,
                                hours_to_kickoff, decided_at, odds_captured_at,
                                odds_age_seconds, evidence)
values ('00000000-0000-4000-8000-000000000604',
        '00000000-0000-4000-8000-000000000601', 'EPL', '1X2', 'H', 'BET',
        array[]::text[], 'B365', 2.40, .48, 2.08, .152,
        now() + interval '3 days', 100, now() - interval '2 days',
        now() - interval '2 days', 300, '{}');

select is(
  (select id::text from ai.canonical_fixture_predictions
    where fixture_id = '00000000-0000-4000-8000-000000000603'),
  '00000000-0000-4000-8000-000000000605',
  'the newer forecast is canonical'
);

select is(
  (select count(*)::integer from ai.current_fixture_recommendations
    where fixture_id = '00000000-0000-4000-8000-000000000603'),
  0,
  'an older BET is not current after a newer forecast arrives'
);

insert into ai.recommendations (prediction_id, model_id, league, market, selection,
                                decision, reason_codes, bookmaker, odds_offered,
                                calibrated_prob, fair_odds, expected_value, kickoff_at,
                                hours_to_kickoff, decided_at, odds_captured_at,
                                odds_age_seconds, evidence)
values ('00000000-0000-4000-8000-000000000605',
        '00000000-0000-4000-8000-000000000602', 'EPL', '1X2', 'A', 'PASS',
        array['PASS_LOW_EDGE'], 'B365', 2.80, .36, 2.78, .008,
        now() + interval '3 days', 72, now(), now() - interval '5 minutes', 300, '{}');

select is(
  (select prediction_id::text from ai.current_fixture_recommendations
    where fixture_id = '00000000-0000-4000-8000-000000000603'),
  '00000000-0000-4000-8000-000000000605',
  'the current decision is tied to the canonical forecast once evaluated'
);

select is(
  (select decision from ai.current_fixture_recommendations
    where fixture_id = '00000000-0000-4000-8000-000000000603'),
  'PASS',
  'the canonical forecast decision is reported exactly'
);

select is(
  (select count(*)::integer from ai.recommendations
    where prediction_id = '00000000-0000-4000-8000-000000000604'),
  1,
  'the old recommendation remains immutable audit evidence'
);

select * from finish();

rollback;
