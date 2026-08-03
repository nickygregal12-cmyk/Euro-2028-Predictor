-- Contract 78: the season Cup's league-phase schedule.
--
-- The parity test reads the SQL and executes the TypeScript. This runs the SQL,
-- against the properties that make a schedule publishable at entry close:
-- everyone meets everyone the right number of times, nobody plays twice in a
-- round, and the whole thing is reproducible from the audited draw.
--
-- The circle method is NOT a drop-in for the tournament's hardcoded three- and
-- four-player tables. I expected it to be and checked: both give a valid round
-- robin over the same pairings, but assign them to different rounds. The
-- tournament tables are therefore untouched, and no published fixture moves.

begin;
select plan(11);

-- ---------------------------------------------------------------------------
-- Deterministic from the draw, which is what makes it auditable.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_league_schedule(array['a','b','c','d'], 1),
  predictor_internal.cup_league_schedule(array['a','b','c','d'], 1),
  'the same draw yields the same schedule'
);

select isnt(
  predictor_internal.cup_league_schedule(array['a','b','c','d'], 1),
  predictor_internal.cup_league_schedule(array['b','a','c','d'], 1),
  'a different draw order yields a different schedule, so the draw genuinely shapes it'
);

-- ---------------------------------------------------------------------------
-- A valid round robin.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from (
     select least(t->>'home', t->>'away') a, greatest(t->>'home', t->>'away') b
       from jsonb_array_elements(
              predictor_internal.cup_league_schedule(
                array['a','b','c','d','e','f'], 1)->'rounds') r,
            jsonb_array_elements(r->'ties') t
      group by 1, 2 having count(*) <> 1) x),
  0,
  'six entrants over one meeting: every pair meets exactly once'
);

select is(
  (select count(distinct (least(t->>'home', t->>'away'), greatest(t->>'home', t->>'away')))::integer
     from jsonb_array_elements(
            predictor_internal.cup_league_schedule(
              array['a','b','c','d','e','f'], 1)->'rounds') r,
          jsonb_array_elements(r->'ties') t),
  15,
  'all fifteen pairings of a six-entrant field appear'
);

select is(
  (select count(*)::integer from (
     select r->>'round' rd, e
       from jsonb_array_elements(
              predictor_internal.cup_league_schedule(
                array['a','b','c','d','e','f','g'], 2)->'rounds') r,
            jsonb_array_elements(r->'ties') t,
            lateral (values (t->>'home'), (t->>'away')) as s(e)
      group by 1, 2 having count(*) > 1) y),
  0,
  'nobody plays twice in the same round, odd field over two meetings'
);

select is(
  (select count(*)::integer from (
     select least(t->>'home', t->>'away') a, greatest(t->>'home', t->>'away') b
       from jsonb_array_elements(
              predictor_internal.cup_league_schedule(array['a','b','c','d'], 3)->'rounds') r,
            jsonb_array_elements(r->'ties') t
      group by 1, 2 having count(*) <> 3) z),
  0,
  'three meetings means every pair meets exactly three times'
);

-- ---------------------------------------------------------------------------
-- The bye rotates, so an odd field rests everyone once before anyone twice.
-- ---------------------------------------------------------------------------

select is(
  (select count(distinct r->>'bye')::integer
     from jsonb_array_elements(
            predictor_internal.cup_league_schedule(array['a','b','c','d','e'], 1)->'rounds') r
    where r->>'bye' is not null),
  5,
  'five entrants over one meeting: each rests exactly once'
);

select is(
  (select count(*)::integer
     from jsonb_array_elements(
            predictor_internal.cup_league_schedule(array['a','b','c','d'], 1)->'rounds') r
    where r->>'bye' is not null),
  0,
  'an even field never carries a bye'
);

-- ---------------------------------------------------------------------------
-- Refusals, never a repaired schedule.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_league_schedule(array['a','a'], 1),
  '{"ok": false, "reason": "duplicate_entrant"}'::jsonb,
  'the same entrant twice is refused rather than deduplicated'
);

select is(
  predictor_internal.cup_league_schedule(array['a'], 1),
  '{"ok": false, "reason": "field_too_small"}'::jsonb,
  'a field of one is refused'
);

select is(
  predictor_internal.cup_league_schedule(array['a','b'], 0),
  '{"ok": false, "reason": "invalid_input"}'::jsonb,
  'zero meetings is refused rather than producing an empty fixture list'
);

select * from finish();
rollback;
