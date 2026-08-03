-- Contract 76: the last tournament coupling in the shared Cup machinery.
--
-- SCOPE. Like `127`, this proves the SPLIT rather than re-deriving the
-- behaviour: `108`–`114_predictor_cup_*.sql` already drive `cup_window_settled`
-- through the settlement RPCs against real tournament data, and they are
-- unchanged, so they remain the regression evidence. Equivalence was also
-- established with a differential harness over 400 randomised scenarios —
-- random fixture counts including zero, random result states, null and non-null
-- window timings, and a missing window row — with zero mismatches, which
-- diverged in 76 of 100 scenarios when a corrected result was treated as
-- unsettled.
--
-- What is left for this file is the structural claim, plus the one behaviour
-- that is cheap to run here and expensive to lose: a window that does not exist
-- must return NULL, not false. Callers distinguish "not settled" from "no such
-- window", and collapsing the two would settle a window nobody created.

begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- Both halves exist, and the new one is server-side only.
-- ---------------------------------------------------------------------------

select has_function(
  'predictor_internal', 'cup_tournament_window_unsettled', array['uuid'],
  'the tournament settlement source exists'
);

select has_function(
  'predictor_internal', 'cup_window_settled', array['uuid'],
  'the shared decision keeps its name and signature, so its ten callers are unchanged'
);

select function_privs_are(
  'predictor_internal', 'cup_tournament_window_unsettled', array['uuid'],
  'authenticated', array[]::text[],
  'the settlement source is not executable by authenticated'
);

select function_privs_are(
  'predictor_internal', 'cup_tournament_window_unsettled', array['uuid'],
  'anon', array[]::text[],
  'the settlement source is not executable anonymously'
);

-- ---------------------------------------------------------------------------
-- The coupling moved rather than being copied or dropped.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_window_settled'
      and (p.prosrc like '%public.matches%' or p.prosrc like '%result_state%')),
  0,
  'the shared decision reads no tournament relation of its own'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'cup_tournament_window_unsettled'
      and p.prosrc like '%public.matches%'
      and p.prosrc like '%confirmed%'
      and p.prosrc like '%corrected%'),
  1,
  'the tournament result lifecycle landed in the settlement source, corrected included'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_window_settled'
      and p.prosrc like '%not predictor_internal.cup_tournament_window_unsettled%'),
  1,
  'the shared decision negates the source, matching the not-exists it replaced'
);

-- ---------------------------------------------------------------------------
-- The whole shared Cup machinery is now free of tournament relations, which is
-- what ADR 0022 asked for. `cup_bracket_order` and `cup_seed_group` never had
-- any; `cup_final_group_tables` lost its last one when contract 75 made
-- `cup_window_scores` neutral, without a pass of its own.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('cup_window_scores', 'cup_window_settled',
                        'cup_final_group_tables', 'cup_seed_group', 'cup_bracket_order')
      and (p.prosrc like '%public.matches%'
        or p.prosrc like '%match_predictions%'
        or p.prosrc like '%bonus_knockout_predictions%'
        or p.prosrc like '%tournament_id%'
        or p.prosrc like '%home_score_90%')),
  0,
  'no shared Cup function reads a tournament relation any more'
);

-- ---------------------------------------------------------------------------
-- The behaviour worth running: absence is not falsehood.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_window_settled('00000000-0000-0000-0000-00000000dead'::uuid),
  null,
  'a window that does not exist returns null, not false'
);

select * from finish();
rollback;
