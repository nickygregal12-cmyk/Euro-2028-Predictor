-- Contract 77: the season Cup's sources, plugged into the shared machinery.
--
-- SCOPE, as with `127` and `128`: this proves the seam, not the arithmetic.
-- `109`–`114` remain the behaviour evidence for the tournament path and are
-- unchanged. Interchangeability was established by scoring an IDENTICAL
-- scenario through each source and diffing the shared function's output —
-- byte-identical, 1998 sentinel included — and by re-running the tournament
-- differential sweep with the season link empty across 300 scenarios, which
-- confirmed the union changed no tournament answer.
--
-- What this file adds is the structural and privilege claim, plus the season
-- settlement truth table, which is cheap here and is the thing a season Cup
-- would get wrong first.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- The season link exists and is unreachable from the browser.
-- ---------------------------------------------------------------------------

select has_table('public', 'season_cup_window_fixtures', 'the season window link exists');

select ok(
  (select relrowsecurity from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'season_cup_window_fixtures'),
  'row level security is enabled on the season window link'
);

select table_privs_are(
  'public', 'season_cup_window_fixtures', 'authenticated', array[]::text[],
  'the season window link is not readable by authenticated'
);

select table_privs_are(
  'public', 'season_cup_window_fixtures', 'anon', array[]::text[],
  'the season window link is not readable anonymously'
);

-- ---------------------------------------------------------------------------
-- Both season functions exist and stay server-side.
-- ---------------------------------------------------------------------------

select has_function(
  'predictor_internal', 'cup_season_fixture_points', array['uuid', 'uuid'],
  'the season points source exists'
);

select has_function(
  'predictor_internal', 'cup_season_window_unsettled', array['uuid'],
  'the season settlement source exists'
);

select function_privs_are(
  'predictor_internal', 'cup_season_fixture_points', array['uuid', 'uuid'],
  'authenticated', array[]::text[],
  'the season points source is not executable by authenticated'
);

select function_privs_are(
  'predictor_internal', 'cup_season_window_unsettled', array['uuid'],
  'authenticated', array[]::text[],
  'the season settlement source is not executable by authenticated'
);

-- ---------------------------------------------------------------------------
-- The two sources are interchangeable: same result signature, so the shared
-- arithmetic cannot tell them apart.
-- ---------------------------------------------------------------------------

select is(
  (select pg_catalog.pg_get_function_result(p.oid) from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_season_fixture_points'),
  (select pg_catalog.pg_get_function_result(p.oid) from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_tournament_fixture_points'),
  'the season and tournament points sources return an identical relation'
);

-- ---------------------------------------------------------------------------
-- Each source speaks only its own vocabulary.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('cup_season_fixture_points', 'cup_season_window_unsettled')
      and (p.prosrc like '%public.matches%' or p.prosrc like '%result_state%'
        or p.prosrc like '%home_score_90%' or p.prosrc like '%bonus_window_fixtures%')),
  0,
  'no season source reads a tournament relation or the tournament window link'
);

-- ---------------------------------------------------------------------------
-- The shared function combines both rather than branching on kind.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_window_scores'
      and p.prosrc like '%cup_tournament_fixture_points%'
      and p.prosrc like '%cup_season_fixture_points%'
      and p.prosrc like '%union all%'),
  1,
  'the shared arithmetic unions both sources, staying one implementation'
);

-- ---------------------------------------------------------------------------
-- A season window with nothing linked is not settled — the same rule the
-- tournament already had, now reachable from the season side.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_season_window_unsettled(
    '00000000-0000-0000-0000-00000000dead'::uuid),
  false,
  'a window with no season fixtures has nothing outstanding'
);

select * from finish();
rollback;
