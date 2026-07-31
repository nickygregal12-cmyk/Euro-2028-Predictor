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
  'test.acct_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.acct_tournament_id')::uuid;

-- This test deliberately creates a joker. Contract 65 requires authoritative
-- fixture timing before a joker commitment can exist, so make the rollback-only
-- fixture catalogue explicit rather than relying on the old null-kickoff seed.
update public.matches
set kickoff_at = now() + interval '2 days'
where tournament_id = current_setting('test.acct_tournament_id')::uuid
  and round = 'group';

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('acct-user-1')::uuid, 'acct-1@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
values (md5('acct-user-1')::uuid, 'Account Tester', now());

insert into public.entries (id, user_id, tournament_id, submitted_at)
values (
  md5('acct-entry-1')::uuid, md5('acct-user-1')::uuid,
  current_setting('test.acct_tournament_id')::uuid, now()
);

insert into public.match_predictions (entry_id, match_id, home_score, away_score, joker)
select md5('acct-entry-1')::uuid, m.id, 2, 0, (row_number() over ()) = 1
from public.matches m
where m.tournament_id = current_setting('test.acct_tournament_id')::uuid
  and m.round = 'group'
order by m.matchday, m.match_ref
limit 2;

insert into public.bonus_predictions (entry_id, golden_boot_player_id)
values (md5('acct-entry-1')::uuid, null);

-- Structure and the reminder-email preference.

select has_function('public', 'clear_my_predictions', array['uuid'],
  'the pre-lock own-entry clear exists');

select is(
  (select profile.reminder_emails from public.profiles profile
    where profile.id = md5('acct-user-1')::uuid),
  true,
  'deadline reminder emails default to on'
);

update public.profiles profile
  set reminder_emails = false
  where profile.id = md5('acct-user-1')::uuid;
select is(
  (select profile.reminder_emails from public.profiles profile
    where profile.id = md5('acct-user-1')::uuid),
  false,
  'the reminder preference is updatable on the own row'
);

-- The clear: authentication, ownership, wipe and the lock boundary.

select is(
  pg_temp.capture_sqlstate(format(
    'select public.clear_my_predictions(%L::uuid)',
    current_setting('test.acct_tournament_id')
  )),
  '42501',
  'an unauthenticated caller cannot clear anything'
);

select set_config('request.jwt.claim.sub', md5('acct-user-1'), true);

select is(
  (
    select public.clear_my_predictions(
      current_setting('test.acct_tournament_id')::uuid
    ) - 'entry_id'
  ),
  jsonb_build_object(
    'scores', 2, 'tie_resolutions', 0, 'group_positions', 0,
    'progression', 0, 'awards', 1
  ),
  'the clear reports exactly the caller''s removed Original rows'
);

select is(
  (
    select (
      (select count(*) from public.entries e
        where e.id = md5('acct-entry-1')::uuid)
      + (select count(*) from public.match_predictions p
        where p.entry_id = md5('acct-entry-1')::uuid)
      + (select count(*) from public.bonus_predictions b
        where b.entry_id = md5('acct-entry-1')::uuid)
    )::integer
  ),
  0,
  'the old entry identity and every tested Original child row are gone'
);

-- A later provider reload creates a fresh empty entry. Use that fresh identity
-- to prove the same RPC still refuses after the tournament lock.
insert into public.entries (id, user_id, tournament_id)
values (
  md5('acct-entry-after-clear')::uuid,
  md5('acct-user-1')::uuid,
  current_setting('test.acct_tournament_id')::uuid
);

update public.tournaments
set lock_at = now() - interval '1 hour'
where id = current_setting('test.acct_tournament_id')::uuid;

select is(
  pg_temp.capture_sqlstate(format(
    'select public.clear_my_predictions(%L::uuid)',
    current_setting('test.acct_tournament_id')
  )),
  '23514',
  'the clear refuses once predictions are locked'
);

select is(
  pg_temp.capture_sqlstate(
    'select public.clear_my_predictions(gen_random_uuid())'
  ),
  'P0002',
  'a tournament without an entry reports no data'
);

select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
