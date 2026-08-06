-- Contract 79: the shared Cup store's widened column domains.
--
-- SCOPE, stated so the coverage is not overread. This asserts the constraints
-- the rebuilt database actually holds, read from `pg_constraint`. It
-- deliberately does NOT insert probe rows.
--
-- The first draft did, and it would have been fragile for reasons that are
-- worth recording rather than quietly fixing. `bonus_cup_fixtures` carries
-- foreign keys to `bonus_competitions`, `bonus_competition_windows` and
-- `bonus_competition_entrants`, and both Cup tables carry a
-- `prepare_competition_season_scope` BEFORE trigger from contract 65. An insert
-- built from `gen_random_uuid()` therefore fails on the trigger or a foreign
-- key (23503) before the CHECK (23514) is ever reached, so a `throws_ok`
-- expecting a check violation would have failed for the wrong reason — or worse,
-- passed for the wrong reason if the codes happened to line up.
--
-- Real accept/refuse behaviour was instead proven directly against a scratch
-- PostgreSQL 16 built from the baseline table definitions: sizes 3, 4 and 20
-- accepted with 2 and 21 refused; matchdays 1, 3, 38 and 57 accepted with 0 and
-- -1 refused. What belongs here is the claim CI can make deterministically —
-- that the rebuilt database carries those domains and not the old ones.
--
-- A first draft also asserted the boundaries as expressions: `3 between 3 and
-- 20`, `not (21 between 3 and 20)`, and so on. Those were removed. They restate
-- the domain rather than reading it, so they pass whether or not the migration
-- ran — a control that cannot fail, which is the exact shape this repository
-- keeps finding and deleting. Every assertion below reads `pg_constraint`, and
-- all six fail against an unmigrated database.

begin;
select plan(8);

-- ---------------------------------------------------------------------------
-- The tournament-only domains are gone.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
     join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'bonus_cup_groups' and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%ARRAY[3, 4]%'),
  0,
  'the tournament-only group-size domain is gone'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
     join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'bonus_cup_fixtures' and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%matchday >= 1%'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%matchday <= 3%'),
  0,
  'the tournament-only matchday domain is gone'
);

-- ---------------------------------------------------------------------------
-- The widened domains are present, named, and say what they should.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'bonus_cup_groups' and c.conname = 'bonus_cup_groups_size_allowed'),
  1,
  'the widened group-size constraint is present under its own name'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'bonus_cup_fixtures'
      and c.conname = 'bonus_cup_fixtures_matchday_positive'),
  1,
  'the widened matchday constraint is present under its own name'
);

select ok(
  (select pg_catalog.pg_get_constraintdef(c.oid) like '%size >= 3%'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%size <= 20%'
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'bonus_cup_groups' and c.conname = 'bonus_cup_groups_size_allowed'),
  'group size is bounded at the platform cap of twenty, not the tournament shape'
);

-- Contract 124 made this domain PHASE-AWARE, and both halves of that are
-- asserted so the change cannot later be read as having opened the group
-- domain. A split half of two is required — ADR 0014's minimum field of four
-- splits two and two — while a two-player GROUP STAGE is still not a group
-- stage. The assertion above still holds because the initial branch is where
-- the floor of three now lives.
select ok(
  (select pg_catalog.pg_get_constraintdef(c.oid) like '%size >= 2%'
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'bonus_cup_groups' and c.conname = 'bonus_cup_groups_size_allowed'),
  'a split half may hold two entrants, which the pre-124 floor of three refused '
  'and which the smallest legal Championship cannot split without'
);

select ok(
  (select pg_catalog.pg_get_constraintdef(c.oid) like '%phase_kind%'
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'bonus_cup_groups' and c.conname = 'bonus_cup_groups_size_allowed'),
  'and the relaxation is bounded by phase rather than applying to every group'
);

select ok(
  (select pg_catalog.pg_get_constraintdef(c.oid) like '%matchday > 0%'
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'bonus_cup_fixtures'
      and c.conname = 'bonus_cup_fixtures_matchday_positive'),
  'matchday is bounded below only, because the ceiling is a format decision'
);

select * from finish();
rollback;
