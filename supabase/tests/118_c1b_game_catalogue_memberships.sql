begin;

select plan(46);

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

select has_table('public', 'game_definitions', 'game definition catalogue exists');
select has_table('public', 'game_memberships', 'canonical game membership table exists');
select has_table('public', 'game_membership_events', 'append-only membership event table exists');

select is(
  (select count(*)::integer from public.game_definitions),
  5,
  'the five current game definitions are seeded exactly once'
);

select is(
  (select jsonb_agg(jsonb_build_object(
    'key', game_key,
    'scope', lock_scope,
    'buffer', buffer_minutes,
    'rejoin', allow_rejoin
  ) order by game_key) from public.game_definitions),
  '[{"key":"ko_predictor","scope":"match","buffer":0,"rejoin":true},{"key":"last_man_standing","scope":"round","buffer":30,"rejoin":false},{"key":"main_predictor","scope":"round","buffer":0,"rejoin":true},{"key":"original_predictor","scope":"entry","buffer":0,"rejoin":true},{"key":"predictor_cup","scope":"round","buffer":0,"rejoin":true}]'::jsonb,
  'game-owned lock policies and rejoin rules are persisted explicitly'
);

select is(
  (select count(*)::integer from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('game_definitions','game_memberships','game_membership_events')
     and relrowsecurity),
  3,
  'RLS is enabled on every C1b table'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('game_definitions','game_membership_events')
     and grantee in ('PUBLIC','anon','authenticated','service_role')),
  0,
  'catalogue and event custody have no browser or service table grants'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema='public' and table_name='game_memberships'
     and grantee='authenticated' and privilege_type='SELECT'),
  1,
  'authenticated users receive only their RLS-bounded membership read'
);

select is(
  (select count(*)::integer from public.tournaments season
   join public.competitions competition on competition.id=season.competition_id
   where competition.slug in ('premier-league','scottish-premiership')
     and season.season_key='2026-27'
     and season.kind='league_season'
     and season.display_timezone='Europe/London'
     and season.status='draft'),
  2,
  'Premier League and Scottish Premiership 2026/27 season roots are seeded without invented dates'
);

select is(
  (select count(*)::integer from public.bonus_competitions availability
   join public.tournaments season on season.id=availability.tournament_id
   join public.competitions competition on competition.id=season.competition_id
   where competition.slug in ('premier-league','scottish-premiership')
     and availability.game_key in ('main_predictor','last_man_standing','predictor_cup')
     and availability.availability_status='inactive'),
  6,
  'each domestic season has the three valid inactive game availabilities'
);

select is(
  (select count(*)::integer from public.bonus_competitions availability
   join public.tournaments season on season.id=availability.tournament_id
   where season.name='UEFA Euro 2028'
     and availability.game_key='original_predictor'
     and availability.availability_status='active'
     and not availability.published),
  1,
  'Euro Original Predictor is an explicit active game availability'
);

select is(
  (select count(*)::integer from public.entries where game_membership_id is null or game_competition_id is null),
  0,
  'every preserved Original Predictor entry is linked to canonical membership'
);

select is(
  (select count(*)::integer from public.bonus_competition_entrants where game_membership_id is null),
  0,
  'every preserved bonus-game entrant is linked to canonical membership'
);

select is(
  (select count(*)::integer from public.game_membership_events where event_type='joined'),
  (select count(*)::integer from public.game_memberships),
  'every backfilled membership has one initial joined event'
);

select ok(
  not has_function_privilege('anon','public.get_competition_games(uuid)','execute'),
  'anonymous callers cannot read the competition game catalogue'
);
select ok(
  has_function_privilege('authenticated','public.get_competition_games(uuid)','execute'),
  'authenticated callers can read the competition game catalogue'
);
select ok(
  has_function_privilege('authenticated','public.join_competition_game(uuid)','execute'),
  'authenticated callers can join one game explicitly'
);
select ok(
  has_function_privilege('authenticated','public.leave_competition_game(uuid)','execute'),
  'authenticated callers can leave one game explicitly'
);
select ok(
  not has_function_privilege('authenticated','public.admin_disqualify_competition_game_entry(uuid,uuid,text)','execute'),
  'disqualification is not browser callable'
);
select ok(
  has_function_privilege('service_role','public.admin_disqualify_competition_game_entry(uuid,uuid,text)','execute'),
  'service role alone receives the disqualification RPC'
);

-- A tournament-shaped season cannot receive Main Predictor availability.
select is(
  pg_temp.capture_sqlstate($sql$
    insert into public.bonus_competitions (tournament_id,game_key)
    select id,'main_predictor' from public.tournaments where name='UEFA Euro 2028'
  $sql$),
  '23514',
  'game availability rejects an incompatible competition-season kind'
);

set local session_replication_role = replica;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  (md5('c1b-user-one')::uuid,'c1b-one@example.test','authenticated','authenticated','{}','{}',now(),now()),
  (md5('c1b-user-two')::uuid,'c1b-two@example.test','authenticated','authenticated','{}','{}',now(),now()),
  (md5('c1b-delete-user')::uuid,'c1b-delete@example.test','authenticated','authenticated','{}','{}',now(),now());
set local session_replication_role = origin;

select set_config('test.c1b_pl_tournament',(
  select season.id::text from public.tournaments season
  join public.competitions competition on competition.id=season.competition_id
  where competition.slug='premier-league' and season.season_key='2026-27'
),true);
select set_config('test.c1b_main_game',(
  select id::text from public.bonus_competitions
  where tournament_id=current_setting('test.c1b_pl_tournament')::uuid
    and game_key='main_predictor'
),true);
select set_config('test.c1b_lms_game',(
  select id::text from public.bonus_competitions
  where tournament_id=current_setting('test.c1b_pl_tournament')::uuid
    and game_key='last_man_standing'
),true);
select set_config('test.c1b_cup_game',(
  select id::text from public.bonus_competitions
  where tournament_id=current_setting('test.c1b_pl_tournament')::uuid
    and game_key='predictor_cup'
),true);

update public.bonus_competitions
set availability_status='active', registration_opens_at=now()-interval '1 hour', registration_closes_at=null
where id in (
  current_setting('test.c1b_main_game')::uuid,
  current_setting('test.c1b_lms_game')::uuid,
  current_setting('test.c1b_cup_game')::uuid
);

select set_config('request.jwt.claim.sub',md5('c1b-user-one'),true);
set local role authenticated;

select is(
  jsonb_array_length(public.get_competition_games(current_setting('test.c1b_pl_tournament')::uuid)->'games'),
  3,
  'the generic Hub read returns every configured game for the selected season'
);

select is(
  public.get_competition_games(current_setting('test.c1b_pl_tournament')::uuid)->>'competition_member',
  'false',
  'competition membership is initially derived as false from game memberships'
);

select is(
  public.join_competition_game(current_setting('test.c1b_main_game')::uuid)->>'status',
  'active',
  'joining Main Predictor creates an active canonical membership'
);

select is(
  (select count(*)::integer from public.entries
   where user_id=md5('c1b-user-one')::uuid
     and game_competition_id=current_setting('test.c1b_main_game')::uuid),
  1,
  'joining Main Predictor creates exactly one prediction entry'
);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.join_competition_game(%L::uuid)',
    current_setting('test.c1b_main_game')
  )),
  '23505',
  'joining the same active game twice is idempotently refused'
);

select is(
  public.leave_competition_game(current_setting('test.c1b_main_game')::uuid)->>'status',
  'left',
  'leaving Main Predictor records a left membership state'
);

select is(
  (select count(*)::integer from public.entries
   where user_id=md5('c1b-user-one')::uuid
     and game_competition_id=current_setting('test.c1b_main_game')::uuid),
  1,
  'leaving Main Predictor preserves its accumulated entry and prediction container'
);

select is(
  public.join_competition_game(current_setting('test.c1b_main_game')::uuid)->>'rejoin_count',
  '1',
  'Main Predictor can resume through an explicit rejoin'
);

reset role;
select is(
  (select jsonb_agg(event.event_type order by event.recorded_at,event.id)
   from public.game_membership_events event
   join public.game_memberships membership on membership.id=event.membership_id
   where membership.game_competition_id=current_setting('test.c1b_main_game')::uuid
     and membership.user_id=md5('c1b-user-one')::uuid),
  '["joined","left","rejoined"]'::jsonb,
  'join, leave and rejoin history is append-only and ordered'
);

set local role authenticated;
select is(
  public.get_competition_games(current_setting('test.c1b_pl_tournament')::uuid)->>'competition_member',
  'true',
  'competition membership is derived as true when any game is active'
);

select is(
  (select count(*)::integer from public.create_game_league(
    current_setting('test.c1b_main_game')::uuid,
    'C1b Main League'
  )),
  1,
  'private league creation is scoped to the selected active game'
);

select is(
  (select game_competition_id from public.leagues where name='C1b Main League'),
  current_setting('test.c1b_main_game')::uuid,
  'the private league stores its game availability explicitly'
);

select set_config(
  'test.c1b_main_league_code',
  (select invite_code from public.leagues where name='C1b Main League'),
  true
);

select is(
  public.join_competition_game(current_setting('test.c1b_lms_game')::uuid)->>'status',
  'active',
  'Last Man Standing is joined independently from Main Predictor'
);

select is(
  public.leave_competition_game(current_setting('test.c1b_lms_game')::uuid)->>'status',
  'left',
  'Last Man Standing can be left explicitly'
);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.join_competition_game(%L::uuid)',
    current_setting('test.c1b_lms_game')
  )),
  '55000',
  'Last Man Standing cannot be rejoined in the same running game'
);

reset role;
set local role service_role;
select lives_ok(
  format(
    $sql$select public.admin_disqualify_competition_game_entry(%L::uuid,%L::uuid,'test disqualification')$sql$,
    current_setting('test.c1b_main_game'),
    md5('c1b-user-one')
  ),
  'service role can disqualify an existing game membership'
);

select is(
  (select status from public.game_memberships
   where game_competition_id=current_setting('test.c1b_main_game')::uuid
     and user_id=md5('c1b-user-one')::uuid),
  'disqualified',
  'disqualification becomes the canonical membership state'
);

reset role;
select is(
  pg_temp.capture_sqlstate(format(
    'update public.game_membership_events set detail=''{}'' where membership_id=(select id from public.game_memberships where game_competition_id=%L::uuid and user_id=%L::uuid)',
    current_setting('test.c1b_main_game'),
    md5('c1b-user-one')
  )),
  '42501',
  'membership history cannot be rewritten'
);

reset role;
select set_config('request.jwt.claim.sub',md5('c1b-user-one'),true);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(format(
    'select public.join_competition_game(%L::uuid)',
    current_setting('test.c1b_main_game')
  )),
  '55000',
  'a disqualified membership cannot rejoin'
);

-- A different user cannot join the private league without joining its game.
select set_config('request.jwt.claim.sub',md5('c1b-user-two'),true);
select is(
  pg_temp.capture_sqlstate($sql$select * from public.join_league(current_setting('test.c1b_main_league_code'))$sql$),
  '42501',
  'private league entry requires active membership in that exact game'
);

select is(
  public.join_competition_game(current_setting('test.c1b_main_game')::uuid)->>'status',
  'active',
  'a second user can independently join the season Main Predictor'
);

select lives_ok(
  $sql$select * from public.join_league(current_setting('test.c1b_main_league_code'))$sql$,
  'an active game member can join its private league'
);

-- Account deletion must retain the existing cascade semantics and must not be
-- blocked by the append-only event trigger.
reset role;
select set_config('request.jwt.claim.sub',md5('c1b-delete-user'),true);
set local role authenticated;
select lives_ok(
  format('select public.join_competition_game(%L::uuid)',current_setting('test.c1b_main_game')),
  'the deletion probe user can create membership state'
);
reset role;
select lives_ok(
  $sql$delete from auth.users where id=md5('c1b-delete-user')::uuid$sql$,
  'existing account deletion semantics cascade through C1b membership events'
);

select is(
  (select count(*)::integer from public.game_memberships where user_id=md5('c1b-delete-user')::uuid),
  0,
  'account deletion leaves no orphan C1b membership row'
);

select * from finish();
rollback;
