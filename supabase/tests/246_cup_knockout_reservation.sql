-- Contract 198 / `CUP-006`: the Championship reserves the knockout it implies.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that a format the launcher ACCEPTS can
-- always be finished. Before this contract the shortfall surfaced at
-- qualification time, months after the group stage was played, as
-- `ensure_season_cup_knockout_windows` failing closed and naming it. The right
-- failure at the wrong moment.
--
-- It is swept rather than sampled, because the defect is arithmetic and a
-- worked example proves only itself.

begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- One authority for bracket depth.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_knockout_rounds(8),
  3,
  'a power-of-two field is exactly its log: eight qualifiers play three rounds');

select is(
  predictor_internal.cup_knockout_rounds(7),
  3,
  'a surplus adds ONE preliminary round rather than another full one');

select is(
  predictor_internal.cup_knockout_rounds(1),
  0,
  'a single qualifier has nothing to play');

-- The extracted authority must agree with the arithmetic still embedded in the
-- qualification function, over every count a competition can reach. Twenty
-- groups of twenty is ADR 0014's ceiling, so 280 qualifiers is the most.
select is(
  (select count(*)::integer
     from generate_series(1, 300) as q
    where predictor_internal.cup_knockout_rounds(q) <> (
      select r + case when q - p > 0 then 1 else 0 end
        from (select max(1 << n) as p from generate_series(0, 30) n where (1 << n) <= q) a,
             lateral (select count(*)::integer as r from generate_series(1, 30) n where (1 << n) <= a.p) b)),
  0,
  'the extracted depth authority agrees with the qualification arithmetic it came from');

select is(
  (select count(*)::integer from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_finalise_predictor_cup_groups'
      and p.prosrc like '%cup_knockout_rounds%'),
  1,
  'and qualification READS it rather than keeping its own copy');

-- ---------------------------------------------------------------------------
-- A single group is a LEAGUE. The league is never shortened.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.select_season_cup_format(10, 38))->'knockout',
  'null'::jsonb,
  'ten entrants over thirty-eight have seven qualifiers needing three rounds and only two spare, so the table decides it');

select is(
  ((predictor_internal.select_season_cup_format(10, 38))->>'leagueRounds')::integer,
  36,
  'and the league is NOT shortened to make room -- it plays all four meetings');

select is(
  (predictor_internal.select_season_cup_format(18, 38))->'knockout',
  '{"rounds": 4, "qualifiers": 12}'::jsonb,
  'eighteen entrants leave exactly four rounds for twelve qualifiers, so a knockout is reserved');

-- THE SWEEP. Every accepted format must be finishable inside its own calendar.
select is(
  (select count(*)::integer
     from generate_series(4, 60) as field,
          generate_series(1, 80) as rounds,
          lateral (select predictor_internal.select_season_cup_format(field, rounds) as f) fmt
    where fmt.f->>'kind' = 'single_group'
      and (fmt.f->>'leagueRounds')::integer
          + coalesce((fmt.f->'tail'->>'splitRounds')::integer, 0)
          + coalesce((fmt.f->'knockout'->>'rounds')::integer, 0)
          + (fmt.f->>'leftoverRounds')::integer <> rounds),
  0,
  'no single group ever uses more calendar than it was given, or less than it accounts for');

select is(
  (select count(*)::integer
     from generate_series(4, 60) as field,
          generate_series(1, 80) as rounds,
          lateral (select predictor_internal.select_season_cup_format(field, rounds) as f) fmt
    where fmt.f->'knockout' is not null
      and jsonb_typeof(fmt.f->'knockout') = 'object'
      and (fmt.f->'knockout'->>'rounds')::integer
          < predictor_internal.cup_knockout_rounds((fmt.f->'knockout'->>'qualifiers')::integer)),
  0,
  'and no reported knockout is ever shallower than the qualifiers it names');

-- THE ASSERTION ABOUT THE ASSERTION. A sweep that reached no knockout at all
-- would pass both of the above against an implementation that never reserves.
select cmp_ok(
  (select count(*)::integer
     from generate_series(4, 60) as field,
          generate_series(1, 80) as rounds,
          lateral (select predictor_internal.select_season_cup_format(field, rounds) as f) fmt
    where fmt.f->>'kind' = 'single_group'
      and jsonb_typeof(fmt.f->'knockout') = 'object'),
  '>',
  0,
  'the sweep really does reach single groups that reserve a knockout');

-- ---------------------------------------------------------------------------
-- A multi-group field cannot be one league, so it ALWAYS reserves.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from generate_series(21, 60) as field,
          generate_series(1, 80) as rounds,
          lateral (select predictor_internal.select_season_cup_format(field, rounds) as f) fmt
    where fmt.f->>'kind' = 'groups'
      and jsonb_typeof(fmt.f->'knockout') <> 'object'),
  0,
  'every multi-group format reserves a knockout, because its field cannot be one league');

-- Reserving shrinks the groups, which is the visible consequence: sixty
-- entrants over thirty-eight matchweeks were three groups of twenty when
-- nothing was reserved.
select is(
  (predictor_internal.select_season_cup_format(60, 38))->'groupSizes',
  '[15, 15, 15, 15]'::jsonb,
  'sixty entrants become four groups of fifteen once the bracket is reserved, not three of twenty');

-- ---------------------------------------------------------------------------
-- ADR 0014's bounds are untouched.
-- ---------------------------------------------------------------------------

select is(
  jsonb_build_array(
    (predictor_internal.select_season_cup_format(3, 38))->>'kind',
    (predictor_internal.select_season_cup_format(20, 38))->>'kind',
    (predictor_internal.select_season_cup_format(21, 38))->>'kind',
    (predictor_internal.select_season_cup_format(8, 38))->'tail'->>'kind'),
  '["declined_head_to_head", "single_group", "groups", "split"]'::jsonb,
  'the minimum field, the cap of twenty and the balancing split all stand where ADR 0014 put them');

select * from finish();
rollback;
