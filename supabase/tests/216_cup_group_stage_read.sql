-- Contract 167: the multi-group Championship, made visible.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that an entrant sees EVERY group and
-- not only their own. A player in group 3 who cannot see groups 1, 2, 4 and 5
-- cannot tell whether their 24 points is winning the competition or losing it,
-- and every read that existed before this one was scoped to the caller.
--
-- The second is that it ranks nothing itself: every figure is
-- `cup_final_group_tables`'s, so the overview and the caller's own view cannot
-- disagree about a position.

begin;

select plan(11);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C167 Group Stage', 2052, t.competition_id, 'group-stage', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.gs_season',
  (select id::text from public.tournaments where season_key = 'group-stage'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('gs-t1')::uuid, current_setting('test.gs_season')::uuid, 'GS Rovers'),
  (md5('gs-t2')::uuid, current_setting('test.gs_season')::uuid, 'GS United');

insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('gs-r' || n)::uuid, current_setting('test.gs_season')::uuid,
       'gs-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 40) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.gs_season')::uuid, md5('gs-r' || n)::uuid,
       md5('gs-t1')::uuid, md5('gs-t2')::uuid,
       now() + (n || ' days')::interval, 'scheduled'
  from generate_series(1, 40) as n;

-- PRIVATE, deliberately: a private Championship's membership must not be
-- readable by anyone holding its id, which is what the entrancy boundary
-- protects and what a public fixture would not test.
insert into public.bonus_competitions (
  id, tournament_id, game_key, name, published, availability_status,
  draw_required, visibility_kind, registration_opens_at, owner_id, invite_code)
-- The PRIVATE Championship carries all three identity fields and the PUBLIC
-- Last Man Standing carries none, because `bonus_competitions_private_identity`
-- (contract 152) requires exactly that of each.
values (md5('gs-cup')::uuid, current_setting('test.gs_season')::uuid, 'predictor_cup',
        'Grouped Championship', true, 'active', true, 'private', now() - interval '30 days',
        md5('gs-u1')::uuid, 'GSCODE123456'),
       (md5('gs-lms')::uuid, current_setting('test.gs_season')::uuid, 'last_man_standing',
        null, true, 'active', false, 'public', now() - interval '30 days',
        null, null);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('gs-u' || n)::uuid, format('gs-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 25) as n;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('gs-out')::uuid, 'gs-out@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('gs-u' || n)::uuid, 'GS Player ' || n, now() from generate_series(1, 25) as n;
insert into public.profiles (id, display_name, welcomed_at)
values (md5('gs-out')::uuid, 'Outsider', now());

insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('gs-cup')::uuid, md5('gs-u' || n)::uuid from generate_series(1, 25) as n;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('gs-u1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select public.admin_launch_cup_group_stage(md5('gs-cup')::uuid);

-- ---------------------------------------------------------------------------
-- AN ENTRANT SEES THE WHOLE STAGE
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('gs-u3')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.gs_view',
  public.get_season_cup_group_stage(md5('gs-cup')::uuid)::text, true);

-- THE ASSERTION THIS FILE EXISTS FOR.
select is(
  jsonb_array_length(current_setting('test.gs_view')::jsonb -> 'groups'), 2,
  'an entrant sees EVERY group, not only their own');

select is(
  (select sum(jsonb_array_length(entry -> 'rows'))::integer
     from jsonb_array_elements(current_setting('test.gs_view')::jsonb -> 'groups') entry),
  25,
  'and every entrant in the competition appears somewhere in the stage');

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.gs_view')::jsonb -> 'groups') entry,
          jsonb_array_elements(entry -> 'rows') standing
    where (standing ->> 'is_me')::boolean),
  1,
  'the caller is marked exactly once across the whole stage');

select is(
  (select entry ->> 'ordinal'
     from jsonb_array_elements(current_setting('test.gs_view')::jsonb -> 'groups') entry
    where (entry ->> 'is_my_group')::boolean),
  current_setting('test.gs_view')::jsonb ->> 'my_group_ordinal',
  'and the group flagged as theirs is the one the payload names');

select is(
  current_setting('test.gs_view')::jsonb ->> 'matchdays', '13',
  'the competition''s round count comes from the fixtures that exist, so a smaller group does not shorten it');

-- Ordering inside a group is the ranking authority's, not this read's.
select is(
  (select standing ->> 'rank'
     from jsonb_array_elements(current_setting('test.gs_view')::jsonb -> 'groups') entry,
          jsonb_array_elements(entry -> 'rows') standing
    where (entry ->> 'ordinal')::integer = 1
    limit 1),
  '1',
  'the first row of a group carries the authority''s own rank');

-- ---------------------------------------------------------------------------
-- ONE GROUP AT A TIME, which is what keeps a hundred-entrant field renderable
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(public.get_season_cup_group_stage(md5('gs-cup')::uuid, 2) -> 'groups'), 1,
  'a caller may ask for one group, and gets one');

select is(
  public.get_season_cup_group_stage(md5('gs-cup')::uuid, 2) -> 'groups' -> 0 ->> 'ordinal', '2',
  'and it is the group they asked for');

-- ---------------------------------------------------------------------------
-- WHO MAY SEE IT
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('gs-out')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(public.get_season_cup_group_stage(md5('gs-cup')::uuid) -> 'groups'), 0,
  'a NON-ENTRANT sees no group at all: a private Championship''s membership is not public');

select is(
  public.get_season_cup_group_stage(md5('gs-cup')::uuid) ->> 'entered', 'false',
  'and is told so rather than refused, so a surface can offer to join');

-- A competition that is not a Championship refuses exactly as one that does not
-- exist, so an id cannot be probed for what kind of thing it names.
select throws_ok(
  format($$select public.get_season_cup_group_stage(%L::uuid)$$, md5('gs-lms')::uuid),
  'P0002', 'No such Championship',
  'a competition that is not a Championship refuses identically to one that does not exist');

reset role;

select * from finish();

rollback;
