-- Contract 201: the private AI Lab stops needing a database console.
--
-- An operator looking at an empty Bet Builder could not tell whether the model
-- had found no value or the pipeline was broken. Both look identical, and
-- telling them apart needed five queries against schema `ai`, which no browser
-- role can read.
--
-- Two things are asserted here that a screenshot cannot show. The reads are
-- FIXTURE-FIRST — `ai.predictions` is unique on (model_id, fixture, horizon), so
-- a match forecast by three model versions was being listed and averaged three
-- times, which is what made a read-only audit report ECH on 17 August as "5
-- graded, 0 result correct" for ONE fixture. And they REPORT decisions rather
-- than making them: nothing here re-derives a BET or a PASS.

begin;

select plan(13);

-- ---------------------------------------------------------------------------
-- Custody. Three definer reads, two views no browser role can reach.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_ai_fixture_coverage', 'admin_ai_operational_health',
                        'admin_ai_results_review')
      and p.prosecdef
      and p.provolatile = 's'),
  3,
  'all three reads are STABLE SECURITY DEFINER, so none of them can write'
);

select is(
  (select count(*)::integer
     from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in ('admin_ai_fixture_coverage', 'admin_ai_operational_health',
                           'admin_ai_results_review')
      and grantee = 'authenticated'),
  3,
  'all three are callable by authenticated'
);

select is(
  (select count(*)::integer
     from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in ('admin_ai_fixture_coverage', 'admin_ai_operational_health',
                           'admin_ai_results_review')
      and grantee in ('PUBLIC', 'anon')),
  0,
  'none of them is callable by an anonymous role'
);

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'ai'
      and table_name in ('canonical_fixture_predictions', 'current_fixture_recommendations')
      and grantee in ('PUBLIC', 'anon', 'authenticated')),
  0,
  'the two fixture-first views stay inside schema ai'
);

-- ---------------------------------------------------------------------------
-- The refusal vocabulary has one home and covers itself.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from unnest(array['PASS_LOW_EDGE', 'PASS_STALE_PRICE', 'PASS_LOW_DATA',
                       'PASS_HIGH_MODEL_DISAGREEMENT', 'PASS_WIDE_UNCERTAINTY',
                       'PASS_MARKET_DISCREPANCY', 'PASS_INPUT_PENDING',
                       'PASS_LONGSHOT', 'PASS_ODDS_OUT_OF_RANGE',
                       'PASS_UNBETTABLE_BOOK', 'PASS_NO_MARKET_REFERENCE']) as code
    where ai.pass_reason_explanation(code) like 'No explanation%'
       or length(ai.pass_reason_explanation(code)) < 30),
  0,
  'every refusal code in value_engine.REASON_CODES has a sentence'
);

select ok(
  ai.pass_reason_explanation('PASS_INVENTED') like 'No explanation%',
  'an unknown code says so rather than inventing a reason'
);

-- ---------------------------------------------------------------------------
-- Fixture-first, over real rows.
-- ---------------------------------------------------------------------------

insert into ai.bookmakers (code, name, kind, is_real_price)
values ('T249', 'Test book 249', 'bookmaker', true)
on conflict (code) do nothing;

insert into ai.models (id, league, version, family, training_matches, artifact_sha256, status)
values ('00000000-0000-4000-8000-000000000301', 'EPL', 'c201-old', 'poisson', 10,
        repeat('b', 64), 'retired'),
       ('00000000-0000-4000-8000-000000000302', 'EPL', 'c201-new', 'poisson', 10,
        repeat('c', 64), 'retired');

insert into ai.fixtures (id, division, season, league_key, match_date, kickoff_at,
                         home_canonical, away_canonical)
values ('00000000-0000-4000-8000-000000000303', 'E0', '2627', 'EPL',
        (now() + interval '3 days')::date, now() + interval '3 days',
        'C201 Priced Home', 'C201 Priced Away'),
       ('00000000-0000-4000-8000-000000000304', 'E0', '2627', 'EPL',
        (now() + interval '3 days')::date, now() + interval '3 days' + interval '2 hours',
        'C201 Bare Home', 'C201 Bare Away');

insert into ai.predictions (id, model_id, league, fixture_id, kickoff_at,
                            home_canonical, away_canonical, p_home, p_draw, p_away,
                            predicted_result, features, horizon, hours_to_kickoff,
                            features_version, created_at, data_confidence)
values ('00000000-0000-4000-8000-000000000305',
        '00000000-0000-4000-8000-000000000301', 'EPL',
        '00000000-0000-4000-8000-000000000303', now() + interval '3 days',
        'C201 Priced Home', 'C201 Priced Away', .55, .25, .20, 'H', '{}', 't168', 72,
        'f2', now() - interval '2 days', '{"score":0.8,"state":"sufficient"}'),
       ('00000000-0000-4000-8000-000000000306',
        '00000000-0000-4000-8000-000000000302', 'EPL',
        '00000000-0000-4000-8000-000000000303', now() + interval '3 days',
        'C201 Priced Home', 'C201 Priced Away', .58, .23, .19, 'H', '{}', 't72', 72,
        'f2', now() - interval '1 hour', '{"score":0.8,"state":"sufficient"}');

select is(
  (select count(*)::integer from ai.canonical_fixture_predictions
    where fixture_id = '00000000-0000-4000-8000-000000000303'),
  1,
  'two forecasts of one match are one match'
);

select is(
  (select id from ai.canonical_fixture_predictions
    where fixture_id = '00000000-0000-4000-8000-000000000303'),
  '00000000-0000-4000-8000-000000000306'::uuid,
  'and the canonical one is the newest'
);

select is(
  (select forecasts_for_fixture::integer from ai.canonical_fixture_predictions
    where fixture_id = '00000000-0000-4000-8000-000000000303'),
  2,
  'how many forecasts collapsed is reported rather than hidden'
);

-- An older BET, then a newer PASS on a different forecast of the same fixture.
insert into ai.recommendations (prediction_id, model_id, league, market, selection,
                                decision, reason_codes, bookmaker, odds_offered,
                                calibrated_prob, expected_value, kickoff_at,
                                hours_to_kickoff, decided_at, odds_captured_at,
                                odds_age_seconds, evidence)
values ('00000000-0000-4000-8000-000000000305',
        '00000000-0000-4000-8000-000000000301', 'EPL', '1X2', 'H', 'BET',
        array[]::text[], 'T249', 2.10, .55, .155, now() + interval '3 days', 72,
        now() - interval '2 days', now() - interval '2 days', 120, '{}'),
       ('00000000-0000-4000-8000-000000000306',
        '00000000-0000-4000-8000-000000000302', 'EPL', '1X2', 'H', 'PASS',
        array['PASS_STALE_PRICE'], 'T249', 2.10, .58, .005,
        now() + interval '3 days', 72, now(), now() - interval '3 days', 259200, '{}');

select is(
  (select decision from ai.current_fixture_recommendations
    where fixture_id = '00000000-0000-4000-8000-000000000303'),
  'PASS',
  'a newer PASS supersedes an older BET, without either audit row being rewritten'
);

select is(
  (select count(*)::integer from ai.recommendations
    where prediction_id in ('00000000-0000-4000-8000-000000000305',
                            '00000000-0000-4000-8000-000000000306')),
  2,
  'and both decisions remain readable as the record of what was said when'
);

-- ---------------------------------------------------------------------------
-- The read reports; it does not decide.
-- ---------------------------------------------------------------------------

select ok(
  position('ai.current_fixture_recommendations' in
           pg_get_functiondef(
             'public.admin_ai_fixture_coverage(timestamptz,timestamptz,text[])'::regprocedure)) > 0
  and position('min_edge' in
           pg_get_functiondef(
             'public.admin_ai_fixture_coverage(timestamptz,timestamptz,text[])'::regprocedure)) = 0,
  'coverage reads the recorded decision and compares no edge to any threshold'
);

select ok(
  position('canonical_fixture_predictions' in
           pg_get_functiondef(
             'public.admin_ai_results_review(timestamptz,timestamptz,text[])'::regprocedure)) > 0
  and position('duplicate_graded_rows_excluded' in
           pg_get_functiondef(
             'public.admin_ai_results_review(timestamptz,timestamptz,text[])'::regprocedure)) > 0,
  'the results review is fixture-first and says how many rows it collapsed'
);

select * from finish();

rollback;
