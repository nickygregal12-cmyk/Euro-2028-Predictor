-- Contract 203: only the CURRENT decision for a fixture can supply a leg.
--
-- `admin_ai_bet_builder_candidates` filtered `where r.decision = 'BET'` before
-- its `distinct on (r.prediction_id)`, so it returned the newest BET for a
-- prediction rather than the newest DECISION. A fixture whose price had gone
-- stale, and whose latest recommendation was therefore a PASS, still returned
-- its two-day-old BET as an actionable leg.
--
-- BOTH DIRECTIONS ARE ASSERTED. A filter that refuses everything also passes a
-- suite that only checks the superseded BET is gone, and an empty Bet Builder
-- caused by an over-strict read is exactly as wrong as one caused by a stale
-- leak — and much harder to notice, because it looks like an honest "no value".

begin;

select plan(10);

select ok(
  position('current_fixture_recommendations' in pg_get_functiondef(
    'public.admin_ai_bet_builder_candidates(text,text[],timestamptz,timestamptz,integer)'::regprocedure)) > 0,
  'the candidate read takes its currency rule from the one place that defines it'
);

select ok(
  position('current_fixture_recommendations' in pg_get_functiondef(
    'public.admin_ai_bet_builder_books()'::regprocedure)) > 0,
  'and so does the venue picker, so its leg count is what selecting it returns'
);

insert into ai.bookmakers (code, name, kind, is_real_price)
values ('T251', 'Test book 251', 'bookmaker', true)
on conflict (code) do nothing;

insert into ai.models (id, league, version, family, training_matches, artifact_sha256)
values ('00000000-0000-4000-8000-000000000501', 'EPL', 'c203-old', 'poisson', 10,
        repeat('e', 64)),
       ('00000000-0000-4000-8000-000000000502', 'EPL', 'c203-new', 'poisson', 10,
        repeat('f', 64));

insert into ai.fixtures (id, division, season, league_key, match_date, kickoff_at,
                         home_canonical, away_canonical)
values ('00000000-0000-4000-8000-000000000503', 'E0', '2627', 'EPL',
        (now() + interval '3 days')::date, now() + interval '3 days',
        'C203 Superseded Home', 'C203 Superseded Away'),
       ('00000000-0000-4000-8000-000000000504', 'E0', '2627', 'EPL',
        (now() + interval '3 days')::date, now() + interval '3 days' + interval '2 hours',
        'C203 Live Home', 'C203 Live Away');

insert into ai.predictions (id, model_id, league, fixture_id, kickoff_at,
                            home_canonical, away_canonical, p_home, p_draw, p_away,
                            predicted_result, features, horizon, hours_to_kickoff,
                            features_version, created_at)
values ('00000000-0000-4000-8000-000000000505',
        '00000000-0000-4000-8000-000000000501', 'EPL',
        '00000000-0000-4000-8000-000000000503', now() + interval '3 days',
        'C203 Superseded Home', 'C203 Superseded Away', .55, .25, .20, 'H', '{}',
        't168', 72, 'f2', now() - interval '2 days'),
       ('00000000-0000-4000-8000-000000000506',
        '00000000-0000-4000-8000-000000000502', 'EPL',
        '00000000-0000-4000-8000-000000000503', now() + interval '3 days',
        'C203 Superseded Home', 'C203 Superseded Away', .55, .25, .20, 'H', '{}',
        't72', 72, 'f2', now() - interval '1 hour'),
       ('00000000-0000-4000-8000-000000000507',
        '00000000-0000-4000-8000-000000000502', 'EPL',
        '00000000-0000-4000-8000-000000000504', now() + interval '3 days' + interval '2 hours',
        'C203 Live Home', 'C203 Live Away', .58, .23, .19, 'H', '{}',
        't72', 74, 'f2', now() - interval '1 hour');

-- Fixture one: a BET two days ago, superseded by a PASS an hour ago.
insert into ai.recommendations (prediction_id, model_id, league, market, selection,
                                decision, reason_codes, bookmaker, odds_offered,
                                calibrated_prob, fair_odds, expected_value, kickoff_at,
                                hours_to_kickoff, decided_at, odds_captured_at,
                                odds_age_seconds, evidence)
values ('00000000-0000-4000-8000-000000000505',
        '00000000-0000-4000-8000-000000000501', 'EPL', '1X2', 'H', 'BET',
        array[]::text[], 'T251', 2.40, .55, 1.82, .32,
        now() + interval '3 days', 72, now() - interval '2 days',
        now() - interval '2 days', 300, '{}'),
       ('00000000-0000-4000-8000-000000000506',
        '00000000-0000-4000-8000-000000000502', 'EPL', '1X2', 'H', 'PASS',
        array['PASS_STALE_PRICE'], 'T251', 2.40, .55, 1.82, .32,
        now() + interval '3 days', 72, now() - interval '1 hour',
        now() - interval '3 days', 259200, '{}'),
       -- Fixture two: a BET an hour ago, and nothing after it.
       ('00000000-0000-4000-8000-000000000507',
        '00000000-0000-4000-8000-000000000502', 'EPL', '1X2', 'H', 'BET',
        array[]::text[], 'T251', 2.50, .58, 1.72, .45,
        now() + interval '3 days' + interval '2 hours', 74, now() - interval '1 hour',
        now() - interval '5 minutes', 300, '{}');

select set_config('request.jwt.claims',
  json_build_object('sub', md5('c203-admin')::uuid, 'role', 'authenticated',
    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);

select is(
  (public.admin_ai_bet_builder_candidates(
     'T251', null, now(), now() + interval '7 days', 200) ->> 'leg_count')::integer,
  1,
  'the superseded BET is refused and the current one is not'
);

select is(
  (public.admin_ai_bet_builder_candidates(
     'T251', null, now(), now() + interval '7 days', 200)
   -> 'legs' -> 0 ->> 'fixture_id'),
  '00000000-0000-4000-8000-000000000504',
  'and the leg that survives is the one whose newest decision is still BET'
);

select is(
  (select count(*)::integer from ai.recommendations
    where decision = 'BET'
      and prediction_id = '00000000-0000-4000-8000-000000000505'),
  1,
  'the refused BET is still in the audit log: nothing was rewritten to hide it'
);

-- The response explains its own length, so an empty builder is never a blank.
--
-- Asserted as RELATIONS between the counts rather than as absolute numbers.
-- This suite runs against a restored copy of Production, which holds fixtures
-- this file did not create, and a pinned total would be asserting how much
-- football happens to be scheduled that week.
select ok(
  ((public.admin_ai_bet_builder_candidates(
      'T251', null, now(), now() + interval '7 days', 200)
    -> 'coverage' ->> 'fixtures_in_window'))::integer
  >= ((public.admin_ai_bet_builder_candidates(
      'T251', null, now(), now() + interval '7 days', 200)
    -> 'coverage' ->> 'with_current_decision'))::integer,
  'the read reports how many fixtures it looked at, and it is never fewer than '
  'the number it has a decision for'
);

select is(
  ((public.admin_ai_bet_builder_candidates(
      'T251', null, now(), now() + interval '7 days', 200)
    -> 'coverage' ->> 'actionable_at_this_book'))::integer,
  1,
  'exactly one fixture is actionable at this venue, and it is the leg returned'
);

select ok(
  ((public.admin_ai_bet_builder_candidates(
      'T251', null, now(), now() + interval '7 days', 200)
    -> 'coverage' -> 'pass_reason_counts' ->> 'PASS_STALE_PRICE'))::integer >= 1,
  'and the refusal that stopped the other one is counted by name, so a short '
  'list says WHY it is short'
);

select is(
  (select (b ->> 'legs')::integer
     from jsonb_array_elements(public.admin_ai_bet_builder_books() -> 'bookmakers') b
    where b ->> 'code' = 'T251'),
  1,
  'the venue picker counts the legs selecting it actually returns'
);

select throws_ok(
  $$select public.admin_ai_bet_builder_candidates('AVG', null, now(), now() + interval '7 days', 200)$$,
  '22023',
  null,
  'and an aggregate is still refused as an action venue'
);

select * from finish();

rollback;
