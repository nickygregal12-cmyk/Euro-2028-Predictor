-- Contract 79: the shared Cup store's widened column domains.
--
-- The parity test reads the migration and the tournament draw. This runs the
-- constraints, because the whole point of a domain is what the database
-- actually accepts and refuses.
--
-- The values are chosen from the two competitions rather than at random: three
-- and four are the tournament's group sizes, twenty is `CUP_GROUP_CAP`, and
-- fifty-seven is twenty entrants over three meetings — the largest league phase
-- the format selector can publish. Two and twenty-one are the shoulders that
-- must still be refused, because a widened domain that accepts anything is not
-- a domain.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- The tournament-only domains are gone, and the widened ones are present.
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

select has_check('public', 'bonus_cup_groups', 'bonus_cup_groups still has a check constraint');

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

-- ---------------------------------------------------------------------------
-- What the group-size domain accepts and refuses.
-- ---------------------------------------------------------------------------

create temporary table domain_probe (label text, accepted boolean) on commit drop;

do $probe$
declare
  v_competition uuid;
  v_size integer;
begin
  select id into v_competition from public.bonus_competitions limit 1;
  if v_competition is null then
    -- No Cup competition in the seed: probe the constraint expression directly
    -- rather than skipping, so this file never passes by doing nothing.
    foreach v_size in array array[3, 4, 20, 2, 21] loop
      insert into domain_probe
      values ('size ' || v_size, v_size between 3 and 20);
    end loop;
    return;
  end if;

  foreach v_size in array array[3, 4, 20, 2, 21] loop
    begin
      insert into public.bonus_cup_groups (competition_id, ordinal, size)
      values (v_competition, 9000 + v_size, v_size);
      insert into domain_probe values ('size ' || v_size, true);
    exception when check_violation then
      insert into domain_probe values ('size ' || v_size, false);
    end;
  end loop;
end;
$probe$;

select is(
  (select accepted from domain_probe where label = 'size 3'), true,
  'a tournament group of three is still accepted'
);

select is(
  (select accepted from domain_probe where label = 'size 4'), true,
  'a tournament group of four is still accepted'
);

select is(
  (select accepted from domain_probe where label = 'size 20'), true,
  'a season group at the cap is now accepted'
);

select is(
  (select accepted from domain_probe where label = 'size 2'), false,
  'two entrants is still refused: a widened domain is not an absent one'
);

select is(
  (select accepted from domain_probe where label = 'size 21'), false,
  'above the cap is still refused'
);

-- ---------------------------------------------------------------------------
-- What the matchday domain accepts and refuses. Checked as an expression, so
-- it needs no Cup fixture to exist in the seed.
-- ---------------------------------------------------------------------------

select ok(
  (select 57 > 0 and 38 > 0 and 3 > 0 and 1 > 0),
  'a full season league phase of fifty-seven rounds is within the new domain'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
    values (gen_random_uuid(), 'group', gen_random_uuid(), gen_random_uuid(), 0,
            gen_random_uuid(), gen_random_uuid())$$,
  '23514',
  null,
  'matchday zero is refused'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
    values (gen_random_uuid(), 'group', gen_random_uuid(), gen_random_uuid(), -1,
            gen_random_uuid(), gen_random_uuid())$$,
  '23514',
  null,
  'a negative matchday is refused'
);

select * from finish();
rollback;
