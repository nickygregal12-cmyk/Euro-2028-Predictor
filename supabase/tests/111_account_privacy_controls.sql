begin;

select plan(24);

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

select has_column(
  'public',
  'profiles',
  'deadline_reminder_emails_enabled',
  'profiles stores the deadline-reminder preference'
);

select col_type_is(
  'public',
  'profiles',
  'deadline_reminder_emails_enabled',
  'boolean',
  'the deadline-reminder preference is boolean'
);

select is(
  (
    select column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'deadline_reminder_emails_enabled'
  ),
  'true',
  'deadline reminders default on'
);

select has_function(
  'public',
  'clear_my_entry',
  array['uuid'],
  'the atomic clear-my-entry RPC exists'
);

select is(
  (
    select p.proconfig::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.oid::regprocedure::text = 'clear_my_entry(uuid)'
  ),
  '{"search_path="""}',
  'clear_my_entry has an immutable empty search path'
);

select ok(
  not has_function_privilege('anon', 'public.clear_my_entry(uuid)', 'execute'),
  'anonymous users cannot clear an entry'
);

select ok(
  has_function_privilege('authenticated', 'public.clear_my_entry(uuid)', 'execute'),
  'authenticated users can call clear_my_entry'
);

select ok(
  has_function_privilege('service_role', 'public.clear_my_entry(uuid)', 'execute'),
  'service_role can call clear_my_entry for controlled operations'
);

select set_config(
  'test.account_tournament',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);
select set_config(
  'test.account_group_match',
  (
    select m.id::text
    from public.matches m
    where m.tournament_id = current_setting('test.account_tournament')::uuid
      and m.round = 'group'
    order by m.matchday, m.match_ref
    limit 1
  ),
  true
);
select set_config(
  'test.account_knockout_match',
  (
    select m.id::text
    from public.matches m
    where m.tournament_id = current_setting('test.account_tournament')::uuid
      and m.round <> 'group'
    order by m.match_ref
    limit 1
  ),
  true
);
select set_config(
  'test.account_group',
  (
    select m.group_id::text
    from public.matches m
    where m.id = current_setting('test.account_group_match')::uuid
  ),
  true
);
select set_config(
  'test.account_home_team',
  (
    select m.home_team_id::text
    from public.matches m
    where m.id = current_setting('test.account_group_match')::uuid
  ),
  true
);
select set_config(
  'test.account_away_team',
  (
    select m.away_team_id::text
    from public.matches m
    where m.id = current_setting('test.account_group_match')::uuid
  ),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.account_tournament')::uuid;

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    md5('account-user-a')::uuid,
    'account-a@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Account Player A"}'::jsonb,
    now(),
    now()
  ),
  (
    md5('account-user-b')::uuid,
    'account-b@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Account Player B"}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('account-user-a')::uuid, 'Account Player A', now()),
  (md5('account-user-b')::uuid, 'Account Player B', now());

insert into public.entries (id, user_id, tournament_id, submitted_at) values
  (
    md5('account-entry-a')::uuid,
    md5('account-user-a')::uuid,
    current_setting('test.account_tournament')::uuid,
    now()
  ),
  (
    md5('account-entry-b')::uuid,
    md5('account-user-b')::uuid,
    current_setting('test.account_tournament')::uuid,
    now()
  );

insert into public.match_predictions (
  entry_id, match_id, home_score, away_score, joker
) values
  (
    md5('account-entry-a')::uuid,
    current_setting('test.account_group_match')::uuid,
    2, 1, true
  ),
  (
    md5('account-entry-b')::uuid,
    current_setting('test.account_group_match')::uuid,
    1, 0, false
  );

insert into public.predicted_group_positions (
  entry_id, group_id, team_id, position
) values (
  md5('account-entry-a')::uuid,
  current_setting('test.account_group')::uuid,
  current_setting('test.account_home_team')::uuid,
  1
);

insert into public.predicted_tie_resolutions (
  entry_id, scope, tie_key, ordered_team_ids
) values (
  md5('account-entry-a')::uuid,
  'group',
  'account-test-tie',
  array[
    current_setting('test.account_home_team')::uuid,
    current_setting('test.account_away_team')::uuid
  ]
);

insert into public.predicted_progression (entry_id, team_id, stage) values (
  md5('account-entry-a')::uuid,
  current_setting('test.account_home_team')::uuid,
  'champion'
);

insert into public.bonus_predictions (entry_id) values (
  md5('account-entry-a')::uuid
);

insert into public.leagues (
  id, tournament_id, owner_id, name, invite_code
) values (
  md5('account-league')::uuid,
  current_setting('test.account_tournament')::uuid,
  md5('account-user-a')::uuid,
  'Account Test League',
  'ACCT57'
);

insert into public.league_members (league_id, user_id, role) values (
  md5('account-league')::uuid,
  md5('account-user-a')::uuid,
  'owner'
);

insert into public.bonus_knockout_predictions (
  user_id, match_id, home_score, away_score
) values (
  md5('account-user-a')::uuid,
  current_setting('test.account_knockout_match')::uuid,
  1, 0
);

set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', md5('account-user-a')::uuid::text, true);
set local role authenticated;

update public.profiles
set deadline_reminder_emails_enabled = false
where id in (md5('account-user-a')::uuid, md5('account-user-b')::uuid);

select set_config(
  'test.account_clear_result',
  public.clear_my_entry(current_setting('test.account_tournament')::uuid)::text,
  true
);

reset role;

select is(
  (
    select deadline_reminder_emails_enabled
    from public.profiles
    where id = md5('account-user-a')::uuid
  ),
  false,
  'the signed-in user can opt out of deadline reminders'
);

select is(
  (
    select deadline_reminder_emails_enabled
    from public.profiles
    where id = md5('account-user-b')::uuid
  ),
  true,
  'own-profile RLS prevents changing another user preference'
);

select is(
  (current_setting('test.account_clear_result')::jsonb ->> 'entry_id')::uuid,
  md5('account-entry-a')::uuid,
  'clear_my_entry reports the caller entry'
);

select is(
  (current_setting('test.account_clear_result')::jsonb ->> 'match_predictions')::integer,
  1,
  'clear_my_entry reports the removed match prediction'
);

select is(
  (select count(*)::integer from public.match_predictions where entry_id = md5('account-entry-a')::uuid),
  0,
  'the caller match predictions are empty'
);

select is(
  (select count(*)::integer from public.predicted_group_positions where entry_id = md5('account-entry-a')::uuid),
  0,
  'the caller derived group positions are empty'
);

select is(
  (select count(*)::integer from public.predicted_tie_resolutions where entry_id = md5('account-entry-a')::uuid),
  0,
  'the caller tie resolutions are empty'
);

select is(
  (select count(*)::integer from public.predicted_progression where entry_id = md5('account-entry-a')::uuid),
  0,
  'the caller bracket progression is empty'
);

select is(
  (select count(*)::integer from public.bonus_predictions where entry_id = md5('account-entry-a')::uuid),
  0,
  'the caller Original Predictor award picks are empty'
);

select is(
  (select submitted_at from public.entries where id = md5('account-entry-a')::uuid),
  null,
  'the caller entry returns to an unsubmitted state'
);

select is(
  (select count(*)::integer from public.match_predictions where entry_id = md5('account-entry-b')::uuid),
  1,
  'another user Original Predictor entry is untouched'
);

select is(
  (
    select count(*)::integer
    from public.league_members
    where league_id = md5('account-league')::uuid
      and user_id = md5('account-user-a')::uuid
  ),
  1,
  'league membership survives clearing predictions'
);

select is(
  (
    select count(*)::integer
    from public.bonus_knockout_predictions
    where user_id = md5('account-user-a')::uuid
  ),
  1,
  'Bonus Games predictions survive clearing the Original entry'
);

select set_config('request.jwt.claim.sub', md5('account-user-a')::uuid::text, true);
set local role authenticated;
select set_config(
  'test.account_second_clear',
  public.clear_my_entry(current_setting('test.account_tournament')::uuid)::text,
  true
);
reset role;

select is(
  (current_setting('test.account_second_clear')::jsonb ->> 'match_predictions')::integer,
  0,
  'clearing an already-empty unlocked entry is idempotent'
);

update public.tournaments
set lock_at = now() - interval '1 minute'
where id = current_setting('test.account_tournament')::uuid;

select set_config('request.jwt.claim.sub', md5('account-user-b')::uuid::text, true);
set local role authenticated;
select set_config(
  'test.account_locked_sqlstate',
  pg_temp.capture_sqlstate(format(
    'select public.clear_my_entry(%L::uuid)',
    current_setting('test.account_tournament')
  )),
  true
);
reset role;

select is(
  current_setting('test.account_locked_sqlstate'),
  '23514',
  'clear_my_entry is denied after tournament lock'
);

select is(
  (select count(*)::integer from public.match_predictions where entry_id = md5('account-entry-b')::uuid),
  1,
  'the locked rejection leaves the entry intact'
);

select * from finish();
rollback;
