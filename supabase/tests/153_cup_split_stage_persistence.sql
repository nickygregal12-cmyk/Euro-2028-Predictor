-- Contract 102: the Predictor Championship split is a distinct persisted phase.
-- Persistence only: creation, scheduling and combined standings remain later
-- drivers/read authorities.

begin;
select plan(41);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

select set_config(
  'test.c102_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('c102-user-' || n)::uuid, format('c102-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 7) n;
set local session_replication_role = origin;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at,
  registration_closes_at, draw_required
) values (
  md5('c102-comp')::uuid, current_setting('test.c102_tournament_id')::uuid,
  'predictor_cup', true, now() - interval '1 day', now() - interval '1 hour', true
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('c102-comp')::uuid, md5('c102-user-' || n)::uuid, now() - interval '2 days'
from generate_series(1, 7) n;

insert into public.bonus_competition_windows
  (id, competition_id, sequence, label, opens_at, locks_at)
values (
  md5('c102-window')::uuid, md5('c102-comp')::uuid, 34, 'Cup round 34',
  now() + interval '1 hour', now() + interval '1 day'
);

insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
values (md5('c102-initial')::uuid, md5('c102-comp')::uuid, 1, 6);

insert into public.bonus_cup_groups
  (id, competition_id, ordinal, size, phase_kind, parent_group_id)
values
  (md5('c102-split-top')::uuid, md5('c102-comp')::uuid, 2, 3,
   'split', md5('c102-initial')::uuid),
  (md5('c102-split-bottom')::uuid, md5('c102-comp')::uuid, 3, 3,
   'split', md5('c102-initial')::uuid);

insert into public.bonus_cup_members
  (competition_id, user_id, group_id, draw_number)
select md5('c102-comp')::uuid, md5('c102-user-' || n)::uuid,
       md5('c102-initial')::uuid, n
from generate_series(1, 6) n;

insert into public.bonus_cup_members
  (competition_id, user_id, group_id, draw_number, phase_kind)
select md5('c102-comp')::uuid, md5('c102-user-' || n)::uuid,
       case when n <= 3 then md5('c102-split-top')::uuid
            else md5('c102-split-bottom')::uuid end,
       n, 'split'
from generate_series(1, 6) n;

-- A second competition supplies the wrong-parent probe.
do $seed_second_competition$
declare
  v_competition uuid;
  v_tournament uuid;
begin
  insert into public.competitions (slug, name, sport)
  values ('c102-parent-probe', 'Contract 102 parent probe', 'football')
  returning id into v_competition;

  insert into public.tournaments
    (name, year, competition_id, season_key, kind, display_timezone, status)
  values ('Contract 102 parent probe', 2026, v_competition, 'c102-parent',
          'league_season', 'Europe/London', 'active')
  returning id into v_tournament;

  insert into public.bonus_competitions
    (id, tournament_id, game_key, published, draw_required)
  values (md5('c102-other-comp')::uuid, v_tournament, 'predictor_cup', false, true);

  insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
  values (md5('c102-other-group')::uuid, md5('c102-other-comp')::uuid, 1, 4);
end;
$seed_second_competition$;

-- Stored shape: assertions 1-12.
select has_column('public', 'bonus_cup_groups', 'phase_kind', 'groups persist phase');
select has_column('public', 'bonus_cup_groups', 'parent_group_id', 'split groups persist parent');
select has_column('public', 'bonus_cup_members', 'phase_kind', 'membership persists phase');
select ok((select pg_get_constraintdef(oid) like '%initial%split%' from pg_constraint
  where conrelid = 'public.bonus_cup_groups'::regclass
    and conname = 'bonus_cup_groups_phase_kind_allowed'), 'group phase is bounded');
select ok((select pg_get_constraintdef(oid) like '%competition_id, user_id, phase_kind%'
  from pg_constraint where conrelid = 'public.bonus_cup_members'::regclass
    and conname = 'bonus_cup_members_pkey'), 'membership identity includes phase');
select ok((select pg_get_constraintdef(oid) like '%competition_id, phase_kind, draw_number%'
  from pg_constraint where conrelid = 'public.bonus_cup_members'::regclass
    and conname = 'bonus_cup_members_draw_number_phase_key'), 'draw number is phase-scoped');
select ok((select pg_get_constraintdef(oid) like '%competition_id, group_id, phase_kind%'
  and pg_get_constraintdef(oid) like '%bonus_cup_groups%competition_id, id, phase_kind%'
  from pg_constraint where conrelid = 'public.bonus_cup_members'::regclass
    and conname = 'bonus_cup_members_group_phase_fkey'), 'membership phase matches group phase');
select ok((select pg_get_constraintdef(oid) like '%group%split%playoff%knockout%'
  from pg_constraint where conrelid = 'public.bonus_cup_fixtures'::regclass
    and conname = 'bonus_cup_fixtures_stage_allowed'), 'split is a distinct fixture stage');
select ok((select pg_get_constraintdef(oid) like '%group%split%group_id IS NOT NULL%matchday IS NOT NULL%'
  and pg_get_constraintdef(oid) like '%playoff%knockout%group_id IS NULL%matchday IS NULL%'
  from pg_constraint where conrelid = 'public.bonus_cup_fixtures'::regclass
    and conname = 'bonus_cup_fixtures_group_shape'), 'split is group-shaped');
select ok((select pg_get_constraintdef(oid) like '%group%split%round_size IS NULL%bracket_slot IS NULL%'
  from pg_constraint where conrelid = 'public.bonus_cup_fixtures'::regclass
    and conname = 'bonus_cup_fixtures_stage_bracket_shape'), 'split has no bracket metadata');
select ok((select pg_get_constraintdef(oid) like '%group%split%winner_user_id IS NULL%'
  from pg_constraint where conrelid = 'public.bonus_cup_fixtures'::regclass
    and conname = 'bonus_cup_fixtures_group_never_settles'), 'split has no stored winner');
select is((select count(*)::integer from pg_attribute where attrelid in (
    'public.bonus_cup_groups'::regclass,
    'public.bonus_cup_members'::regclass,
    'public.bonus_cup_fixtures'::regclass
  ) and not attisdropped and attname in ('carried_points', 'starting_points', 'points_carried')),
  0, 'no copied carry-forward points exist');

-- Groups and membership: assertions 13-27.
select is((select phase_kind from public.bonus_cup_groups where id = md5('c102-initial')::uuid),
  'initial', 'existing-style groups default to initial');
select is((select count(*)::integer from public.bonus_cup_groups
  where competition_id = md5('c102-comp')::uuid and phase_kind = 'split'), 2,
  'one initial group can have two split children');
select is((select count(*)::integer from public.bonus_cup_groups child
  join public.bonus_cup_groups parent on parent.id = child.parent_group_id
  where child.competition_id = md5('c102-comp')::uuid and child.phase_kind = 'split'
    and parent.phase_kind = 'initial' and parent.competition_id = child.competition_id),
  2, 'split children point to the same-competition initial group');
select is((select count(*)::integer from public.bonus_cup_members
  where competition_id = md5('c102-comp')::uuid), 12,
  'six entrants hold twelve memberships across two phases');
select is((select count(*)::integer from public.bonus_cup_members
  where competition_id = md5('c102-comp')::uuid and phase_kind = 'initial'), 6,
  'original memberships remain');
select is((select count(*)::integer from public.bonus_cup_members
  where competition_id = md5('c102-comp')::uuid and phase_kind = 'split'), 6,
  'split memberships coexist');
select is((select count(*)::integer from public.bonus_cup_members initial
  join public.bonus_cup_members split on split.competition_id = initial.competition_id
    and split.user_id = initial.user_id and split.draw_number = initial.draw_number
    and split.phase_kind = 'split'
  where initial.competition_id = md5('c102-comp')::uuid and initial.phase_kind = 'initial'),
  6, 'neutral draw number can carry into the later phase');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_members
  (competition_id,user_id,group_id,draw_number,phase_kind) values
  (md5('c102-comp')::uuid,md5('c102-user-1')::uuid,md5('c102-split-bottom')::uuid,7,'split')$sql$),
  '23505', 'an entrant cannot hold two memberships in one phase');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_members
  (competition_id,user_id,group_id,draw_number,phase_kind) values
  (md5('c102-comp')::uuid,md5('c102-user-7')::uuid,md5('c102-split-top')::uuid,7,'initial')$sql$),
  '23503', 'an initial membership cannot point at a split group');
insert into public.bonus_cup_members
  (competition_id,user_id,group_id,draw_number,phase_kind) values
  (md5('c102-comp')::uuid,md5('c102-user-7')::uuid,
   md5('c102-initial')::uuid,7,'initial');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_members
  (competition_id,user_id,group_id,draw_number,phase_kind) values
  (md5('c102-comp')::uuid,md5('c102-user-7')::uuid,md5('c102-split-top')::uuid,1,'split')$sql$),
  '23505', 'a draw number cannot repeat inside one phase');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_members
  (competition_id,user_id,group_id,draw_number,phase_kind,group_position) values
  (md5('c102-comp')::uuid,md5('c102-user-7')::uuid,md5('c102-split-top')::uuid,7,'split',1)$sql$),
  '23514', 'split membership cannot invent qualification metadata');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_groups
  (competition_id,ordinal,size,phase_kind,parent_group_id) values
  (md5('c102-comp')::uuid,4,3,'split',md5('c102-split-top')::uuid)$sql$),
  '23514', 'a split group cannot parent another split group');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_groups
  (competition_id,ordinal,size,phase_kind,parent_group_id) values
  (md5('c102-comp')::uuid,4,3,'split',md5('c102-other-group')::uuid)$sql$),
  '23514', 'a split group cannot point across competitions');
select lives_ok($$update public.bonus_cup_members set group_position = 20
  where competition_id = md5('c102-comp')::uuid
    and user_id = md5('c102-user-1')::uuid and phase_kind = 'initial'$$,
  'position twenty is representable');
select is(pg_temp.capture_sqlstate($sql$update public.bonus_cup_members set group_position = 21
  where competition_id = md5('c102-comp')::uuid
    and user_id = md5('c102-user-1')::uuid and phase_kind = 'initial'$sql$),
  '23514', 'group position remains capped at twenty');

-- Fixtures: assertions 28-34.
select lives_ok($sql$insert into public.bonus_cup_fixtures
  (id,competition_id,stage,group_id,window_id,matchday,home_user_id,away_user_id) values
  (md5('c102-split-fixture')::uuid,md5('c102-comp')::uuid,'split',
   md5('c102-split-top')::uuid,md5('c102-window')::uuid,34,
   md5('c102-user-1')::uuid,md5('c102-user-2')::uuid)$sql$,
  'a split fixture persists with the overall Cup matchday');
select is((select jsonb_build_object('stage',stage,'matchday',matchday)
  from public.bonus_cup_fixtures where id = md5('c102-split-fixture')::uuid),
  '{"stage":"split","matchday":34}'::jsonb, 'stage and matchday remain explicit');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_fixtures
  (competition_id,stage,group_id,window_id,matchday,home_user_id,away_user_id) values
  (md5('c102-comp')::uuid,'split',md5('c102-initial')::uuid,md5('c102-window')::uuid,35,
   md5('c102-user-3')::uuid,md5('c102-user-4')::uuid)$sql$),
  '23514', 'split fixtures cannot reference an initial group');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_fixtures
  (competition_id,stage,group_id,window_id,matchday,home_user_id,away_user_id) values
  (md5('c102-comp')::uuid,'group',md5('c102-split-bottom')::uuid,md5('c102-window')::uuid,35,
   md5('c102-user-3')::uuid,md5('c102-user-4')::uuid)$sql$),
  '23514', 'initial fixtures cannot reference a split group');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_fixtures
  (competition_id,stage,group_id,window_id,home_user_id,away_user_id) values
  (md5('c102-comp')::uuid,'split',md5('c102-split-bottom')::uuid,md5('c102-window')::uuid,
   md5('c102-user-3')::uuid,md5('c102-user-4')::uuid)$sql$),
  '23514', 'split fixtures require matchday');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_fixtures
  (competition_id,stage,group_id,window_id,matchday,round_size,home_user_id,away_user_id) values
  (md5('c102-comp')::uuid,'split',md5('c102-split-bottom')::uuid,md5('c102-window')::uuid,36,4,
   md5('c102-user-3')::uuid,md5('c102-user-4')::uuid)$sql$),
  '23514', 'split fixtures cannot carry round_size');
select is(pg_temp.capture_sqlstate($sql$insert into public.bonus_cup_fixtures
  (competition_id,stage,group_id,window_id,matchday,home_user_id,away_user_id,
   winner_user_id,decided_by,settled_at) values
  (md5('c102-comp')::uuid,'split',md5('c102-split-bottom')::uuid,md5('c102-window')::uuid,37,
   md5('c102-user-5')::uuid,md5('c102-user-6')::uuid,
   md5('c102-user-5')::uuid,'points',now())$sql$),
  '23514', 'split fixtures cannot persist a winner');

-- Compatibility: assertions 35-41.
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='predictor_internal' and p.proname in
    ('cup_tournament_fixture_points','cup_season_fixture_points','cup_final_group_tables')
    and p.prosrc like '%phase_kind = ''initial''%'), 3,
  'points sources and tournament tables use the initial roster once');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_my_cup'
    and p.prosrc like '%phase_kind = ''initial''%'), 1,
  'the existing Cup read selects initial membership');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_finalise_predictor_cup_groups'
    and p.prosrc like '%phase_kind = ''initial''%'), 1,
  'tournament qualification remains initial-phase');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('admin_finalise_predictor_cup_groups','admin_settle_predictor_cup_round','submit_cup_penalty_number')
    and p.prosrc like '%stage <> ''group''%'), 0,
  'no authority treats every non-group stage as knockout');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('admin_finalise_predictor_cup_groups','admin_settle_predictor_cup_round','submit_cup_penalty_number')
    and p.prosrc like '%stage in (''playoff'', ''knockout'')%'), 3,
  'knockout authorities name playoff and knockout explicitly');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_draw_predictor_cup'
    and p.prosrc like '%phase_kind%'), 0,
  'the tournament draw is unchanged and uses initial defaults');
select is((select count(*)::integer from information_schema.role_routine_grants
  where routine_schema='predictor_internal'
    and routine_name in ('assert_bonus_cup_group_parent','assert_bonus_cup_fixture_group_phase')
    and grantee in ('PUBLIC','anon','authenticated','service_role')), 0,
  'integrity trigger functions are unreachable from API roles');

select * from finish();
rollback;
