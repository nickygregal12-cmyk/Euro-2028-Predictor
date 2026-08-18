-- Contract 202: last Saturday must reach next Saturday's forecast.
--
-- `ai/README.md` states it as an invariant. Production was not meeting it.
-- Fifty-seven results from 14 to 17 August 2026 were imported at 05:55 on the
-- 18th; `predict.py` ran at 09:23 across the five leagues with upcoming
-- fixtures, rebuilt team state from the full history so its FEATURES did include
-- them, scored all 52 fixtures, and wrote NOTHING —
-- `{"written": 0, "fixtures": 12}` in every league.
--
-- The cause is the identity, not the code around it.
-- `predictions_one_per_model_fixture_horizon` is unique on (model_id,
-- fixture_id, horizon) and `insert_predictions` is `on conflict do nothing`,
-- which is CORRECT: a prediction is immutable and a trigger enforces it. But
-- `horizon` had one bucket beyond forty-eight hours, so the first forecast of
-- the week owned the fixture and every better one collided with it.
--
-- Both halves are asserted: a later forecast at a nearer horizon is a NEW row,
-- and the same horizon twice is still refused.

begin;

select plan(7);

insert into ai.models (id, league, version, family, training_matches, artifact_sha256)
values ('00000000-0000-4000-8000-000000000401', 'EPL', 'contract-202', 'poisson', 10,
        repeat('d', 64));

insert into ai.fixtures (id, division, season, league_key, match_date, kickoff_at,
                         home_canonical, away_canonical)
values ('00000000-0000-4000-8000-000000000402', 'E0', '2627', 'EPL',
        (now() + interval '6 days')::date, now() + interval '6 days',
        'C202 Home', 'C202 Away');

-- A week out, then closer, then closer again: three forecasts of one fixture on
-- successively more completed football.
insert into ai.predictions (model_id, league, fixture_id, kickoff_at, home_canonical,
                            away_canonical, p_home, p_draw, p_away, predicted_result,
                            features, horizon, hours_to_kickoff, features_version)
values ('00000000-0000-4000-8000-000000000401', 'EPL',
        '00000000-0000-4000-8000-000000000402', now() + interval '6 days',
        'C202 Home', 'C202 Away', .50, .28, .22, 'H', '{}', 't168', 150, 'f2'),
       ('00000000-0000-4000-8000-000000000401', 'EPL',
        '00000000-0000-4000-8000-000000000402', now() + interval '6 days',
        'C202 Home', 'C202 Away', .54, .26, .20, 'H', '{}', 't120', 110, 'f2'),
       ('00000000-0000-4000-8000-000000000401', 'EPL',
        '00000000-0000-4000-8000-000000000402', now() + interval '6 days',
        'C202 Home', 'C202 Away', .57, .25, .18, 'H', '{}', 't72', 60, 'f2');

select is(
  (select count(*)::integer from ai.predictions
    where fixture_id = '00000000-0000-4000-8000-000000000402'),
  3,
  'a fixture is re-forecast as it approaches instead of being frozen at the '
  'first run of the week'
);

select is(
  (select horizon from ai.canonical_fixture_predictions
    where fixture_id = '00000000-0000-4000-8000-000000000402'),
  't72',
  'and the fixture-level reads still see it once, as the nearest forecast'
);

-- The immutability the widening must not weaken.
select throws_ok(
  $$insert into ai.predictions (model_id, league, fixture_id, kickoff_at,
                                home_canonical, away_canonical, p_home, p_draw,
                                p_away, predicted_result, features, horizon,
                                hours_to_kickoff, features_version)
    values ('00000000-0000-4000-8000-000000000401', 'EPL',
            '00000000-0000-4000-8000-000000000402', now() + interval '6 days',
            'C202 Home', 'C202 Away', .99, .005, .005, 'H', '{}', 't72', 60, 'f2')$$,
  '23505',
  null,
  'the same model, fixture and horizon is still exactly one forecast'
);

select throws_ok(
  $$update ai.predictions set p_home = .99
     where fixture_id = '00000000-0000-4000-8000-000000000402'$$,
  null,
  null,
  'and a stored forecast still cannot be rewritten'
);

-- The vocabulary itself.
select ok(
  (select count(*) = 0
     from unnest(array['t168', 't120', 't72', 't48', 't24', 't6',
                       'scheduled', 'lineup', 'backtest']) as h(horizon)
    where not exists (
      select 1 from pg_catalog.pg_constraint c
       where c.conrelid = 'ai.predictions'::regclass
         and c.conname = 'predictions_horizon_check'
         and position(quote_literal(h.horizon) in pg_get_constraintdef(c.oid)) > 0)),
  'every horizon the forecaster can produce is admitted by the constraint'
);

select throws_ok(
  $$insert into ai.predictions (model_id, league, fixture_id, kickoff_at,
                                home_canonical, away_canonical, p_home, p_draw,
                                p_away, predicted_result, features, horizon,
                                hours_to_kickoff, features_version)
    values ('00000000-0000-4000-8000-000000000401', 'EPL',
            '00000000-0000-4000-8000-000000000402', now() + interval '6 days',
            'C202 Home', 'C202 Away', .5, .3, .2, 'H', '{}', 't999', 60, 'f2')$$,
  '23514',
  null,
  'and the vocabulary is still closed, so a typo is not a new horizon'
);

select ok(
  (select count(*) > 0
     from pg_catalog.pg_indexes
    where schemaname = 'ai'
      and indexname = 'predictions_one_per_model_fixture_horizon'),
  'the uniqueness key the widening works through is still installed'
);

select * from finish();

rollback;
