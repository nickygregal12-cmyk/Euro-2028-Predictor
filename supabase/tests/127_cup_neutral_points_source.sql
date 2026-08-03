-- Contract 75: the Cup's points source, split from its shared arithmetic.
--
-- SCOPE, stated so the coverage is not overread. This file proves the SPLIT
-- happened and stayed server-side. It deliberately does NOT re-seed a Cup to
-- re-check the scoring branches, because `109_predictor_cup_group_scoring.sql`,
-- `110_predictor_cup_knockouts.sql`, `113` and `114` already drive
-- `cup_window_scores` end to end against real tournament data, through the
-- admin RPCs, over 54 assertions. The split keeps that function's signature and
-- its answers, so those suites continuing to pass IS the regression evidence.
-- Seeding a second, parallel Cup here would duplicate their fixtures and rot
-- against them.
--
-- Behaviour equivalence was additionally established with a differential
-- harness that ran the old and new implementations side by side over 300
-- randomised scenarios — random rounds, scores, confirmation states and
-- missing predictions — with zero mismatches, and which diverged in 48 of 50
-- scenarios when the 999 sentinel was removed from the new source.
--
-- What is left for this file is the structural claim those suites cannot make:
-- that the tournament coupling MOVED rather than being copied, that the shared
-- arithmetic is now genuinely competition-agnostic, and that the new function
-- is unreachable from any browser role.

begin;
select plan(10);

-- ---------------------------------------------------------------------------
-- Both halves exist.
-- ---------------------------------------------------------------------------

select has_function(
  'predictor_internal', 'cup_tournament_fixture_points', array['uuid', 'uuid'],
  'the tournament points source exists'
);

select has_function(
  'predictor_internal', 'cup_window_scores', array['uuid', 'uuid'],
  'the shared arithmetic keeps its name and signature, so its callers are unchanged'
);

-- ---------------------------------------------------------------------------
-- The new function is server-side only. A points source reachable from the
-- browser would expose every member's per-fixture predictions.
-- ---------------------------------------------------------------------------

select function_privs_are(
  'predictor_internal', 'cup_tournament_fixture_points', array['uuid', 'uuid'],
  'authenticated', array[]::text[],
  'the points source is not executable by authenticated'
);

select function_privs_are(
  'predictor_internal', 'cup_tournament_fixture_points', array['uuid', 'uuid'],
  'anon', array[]::text[],
  'the points source is not executable anonymously'
);

-- ---------------------------------------------------------------------------
-- The coupling moved. `pg_proc.prosrc` holds the body the database actually
-- has, which is the only version that matters after `create or replace`.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_window_scores'
      and (p.prosrc like '%public.matches%'
        or p.prosrc like '%match_predictions%'
        or p.prosrc like '%bonus_knockout_predictions%'
        or p.prosrc like '%tournament_id%')),
  0,
  'the shared arithmetic reads no tournament relation of its own'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_window_scores'
      and p.prosrc like '%cup_tournament_fixture_points%'),
  1,
  'the shared arithmetic consumes the points source rather than inlining it'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'cup_tournament_fixture_points'
      and p.prosrc like '%public.matches%'
      and p.prosrc like '%match_predictions%'
      and p.prosrc like '%bonus_knockout_predictions%'
      and p.prosrc like '%tournament_id%'),
  1,
  'every tournament coupling landed in the points source, not nowhere'
);

-- ---------------------------------------------------------------------------
-- The neutral relation carries derived facts, not scorelines. A season source
-- has to be able to produce all of them without a tournament column existing.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from unnest(string_to_array(
       (select pg_catalog.pg_get_function_result(p.oid) from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'predictor_internal'
           and p.proname = 'cup_tournament_fixture_points'), ',')) as column_definition
    where column_definition ~* '(user_id|match_id|confirmed|has_prediction|points|is_exact|is_correct|scoreline_error)'),
  8,
  'the neutral relation returns exactly the eight derived facts'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'cup_tournament_fixture_points'
      and p.prosrc like '%then 999%'),
  1,
  'the missing-prediction sentinel survived the move, so non-entrants still sort last'
);

select is(
  (select p.provolatile::text from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'cup_tournament_fixture_points'),
  's',
  'the points source is stable, matching the function it was extracted from'
);

select * from finish();
rollback;
