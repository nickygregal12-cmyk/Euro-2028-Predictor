begin;

select plan(8);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

select set_config(
  'test.clear58_tournament',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);
select set_config(
  'test.clear58_group_match',
  (
    select m.id::text
    from public.matches m
    where m.tournament_id = current_setting('test.clear58_tournament')::uuid
      and m.round = 'group'
    order by m.matchday, m.match_ref
    limit 1
  ),
  true
);
select set_config(
  'test.clear58_knockout_match',
  (
    select m.id::text
    from public.matches m
    where m.tournament_id = current_setting('test.clear58_tournament')::uuid
      and m.round <> 'group'
    order by m.match_ref
    limit 1
  ),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.clear58_tournament')::uuid;

-- Both stores now require authoritative timing for a joker or knockout pick.
-- Seed the selected fixtures inside this rollback-only test transaction.
update public.matches
set kickoff_at = now() + interval '2 days'
where id in (
  current_setting('test.clear58_group_match')::uuid,
  current_setting('test.clear58_knockout_match')::uuid
);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('clear58-user')::uuid,
  'clear58@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
values (md5('clear58-user')::uuid, 'Clear Race Tester', now());

insert into public.entries (id, user_id, tournament_id, submitted_at)
values (
  md5('clear58-entry')::uuid,
  md5('clear58-user')::uuid,
  current_setting('test.clear58_tournament')::uuid,
  now()
);

insert into public.match_predictions (
  entry_id, match_id, home_score, away_score, joker
) values (
  md5('clear58-entry')::uuid,
  current_setting('test.clear58_group_match')::uuid,
  2, 1, true
);

insert into public.leagues (
  id, tournament_id, owner_id, name, invite_code
) values (
  md5('clear58-league')::uuid,
  current_setting('test.clear58_tournament')::uuid,
  md5('clear58-user')::uuid,
  'Clear Race League',
  'CLR058'
);
insert into public.league_members (league_id, user_id, role)
values (
  md5('clear58-league')::uuid,
  md5('clear58-user')::uuid,
  'owner'
);

insert into public.bonus_knockout_predictions (
  user_id, match_id, home_score, away_score
) values (
  md5('clear58-user')::uuid,
  current_setting('test.clear58_knockout_match')::uuid,
  1, 0
);

select set_config('request.jwt.claim.sub', md5('clear58-user'), true);

select is(
  (
    select public.clear_my_predictions(
      current_setting('test.clear58_tournament')::uuid
    ) - 'entry_id'
  ),
  jsonb_build_object(
    'scores', 1, 'tie_resolutions', 0, 'group_positions', 0,
    'progression', 0, 'awards', 0
  ),
  'the race-safe clear reports the removed Original row counts'
);

select is(
  (select count(*)::integer from public.entries e
    where e.id = md5('clear58-entry')::uuid),
  0,
  'the old entry identity is deleted'
);

select is(
  pg_temp.capture_sqlstate(format(
    'insert into public.match_predictions (entry_id, match_id, home_score, away_score) values (%L::uuid, %L::uuid, 3, 0)',
    md5('clear58-entry'),
    current_setting('test.clear58_group_match')
  )),
  '23503',
  'a delayed autosave against the deleted entry id fails the foreign key'
);

select is(
  (select count(*)::integer from public.match_predictions p
    where p.entry_id = md5('clear58-entry')::uuid),
  0,
  'the stale write cannot recreate a prediction'
);

select is(
  (select count(*)::integer from public.profiles p
    where p.id = md5('clear58-user')::uuid),
  1,
  'the account profile survives the clear'
);

select is(
  (select count(*)::integer from public.league_members member
    where member.league_id = md5('clear58-league')::uuid
      and member.user_id = md5('clear58-user')::uuid),
  1,
  'league membership survives the clear'
);

select is(
  (select count(*)::integer from public.bonus_knockout_predictions prediction
    where prediction.user_id = md5('clear58-user')::uuid),
  1,
  'Bonus Games predictions survive the clear'
);

select is(
  (select count(*)::integer from public.leagues league
    where league.id = md5('clear58-league')::uuid),
  1,
  'the owned league survives the clear'
);

select set_config('request.jwt.claim.sub', '', true);
select * from finish();
rollback;
