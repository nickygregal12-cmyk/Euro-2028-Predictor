-- Contract 154: a private Predictor Championship.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the two irreversible ones.
--
-- First: creating does not draw. Contract 111 fixes the format at the field
-- size it finds and refuses ever after, so a competition drawn at creation is
-- drawn at a field of one, permanently and unfixably.
--
-- Second: only the organiser launches. An entrant launching would fix a draw
-- the owner never agreed to, and nothing can undo it afterwards.

begin;

select plan(10);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C154 Private Cup Probe', 2043, t.competition_id, 'pcup-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.pc_season',
  (select id::text from public.tournaments where season_key = 'pcup-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.pc_season')::uuid, 'Gamma FC'),
  (current_setting('test.pc_season')::uuid, 'Delta FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.pc_season')::uuid, 'pcup-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 8) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pc_season')::uuid, r.id,
       (select id from public.teams where tournament_id = current_setting('test.pc_season')::uuid and name = 'Gamma FC'),
       (select id from public.teams where tournament_id = current_setting('test.pc_season')::uuid and name = 'Delta FC'),
       now() + (r.ordinal || ' days')::interval, 'scheduled'
  from public.competition_rounds r
 where r.tournament_id = current_setting('test.pc_season')::uuid;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('pc-user-' || n)::uuid, format('pc-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('pc-user-' || n)::uuid, 'Cup Player ' || n, now()
from generate_series(1, 5) as n;

-- ---------------------------------------------------------------------------
-- The organiser creates one.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pc-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.pc_created',
  public.create_private_season_cup(
    current_setting('test.pc_season')::uuid, 'Office Championship')::text, true);

select set_config('test.pc_competition',
  current_setting('test.pc_created')::jsonb ->> 'competition_id', true);
select set_config('test.pc_code',
  current_setting('test.pc_created')::jsonb ->> 'invite_code', true);

select is(
  (current_setting('test.pc_created')::jsonb ->> 'launched')::boolean,
  false,
  'creating a private Championship does not launch it');

-- ---------------------------------------------------------------------------
-- THE FIRST IRREVERSIBLE CASE: nothing is drawn at creation.
-- ---------------------------------------------------------------------------

-- The role convention in this file. What a PLAYER can do is asserted as
-- `authenticated`; what the DATABASE now holds is asserted as the session role.
-- `bonus_cup_groups` and `bonus_competitions` are revoked from every browser
-- role, so reading them to verify a draw did or did not happen is not a thing a
-- player does.
reset role;

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = current_setting('test.pc_competition')::uuid),
  0,
  'no group exists yet, so the draw was not fixed at a field size of one');

select is(
  (select draw_completed_at from public.bonus_competitions
    where id = current_setting('test.pc_competition')::uuid),
  null,
  'and the draw is recorded as outstanding rather than done');

select is(
  (select count(*)::integer from public.game_memberships
    where game_competition_id = current_setting('test.pc_competition')::uuid
      and user_id = md5('pc-user-1')::uuid and status = 'active'),
  1,
  'the organiser is entered in their own Championship');

-- ---------------------------------------------------------------------------
-- The field arrives, through contract 153's code join.
-- ---------------------------------------------------------------------------

reset role;
select set_config('test.pc_joined', '', true);

do $join$
declare
  n integer;
begin
  for n in 2..5 loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', md5('pc-user-' || n)::uuid, 'role', 'authenticated',
                        'app_metadata', json_build_object())::text, true);
    execute 'set local role authenticated';
    perform public.join_private_competition(current_setting('test.pc_code'));
    execute 'reset role';
  end loop;
end;
$join$;

select is(
  (select count(*)::integer from public.game_memberships
    where game_competition_id = current_setting('test.pc_competition')::uuid
      and status = 'active'),
  5,
  'the code join from contract 153 works for a Championship without knowing it is one');

-- ---------------------------------------------------------------------------
-- THE SECOND IRREVERSIBLE CASE: only the organiser launches.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pc-user-3')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.launch_private_season_cup(%L::uuid)$$,
         current_setting('test.pc_competition')),
  '42501',
  null,
  'an entrant cannot launch, because the draw they would fix cannot be undone');

reset role;
select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = current_setting('test.pc_competition')::uuid),
  0,
  'and the refusal drew nothing');

-- ---------------------------------------------------------------------------
-- The organiser launches, and the door closes behind the field.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('pc-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.pc_launch',
  public.launch_private_season_cup(current_setting('test.pc_competition')::uuid)::text, true);

select isnt(
  current_setting('test.pc_launch')::jsonb ->> 'outcome',
  'not_open',
  'a private Championship has no hundred-entrant threshold, so five entrants is a field');

reset role;

select cmp_ok(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = current_setting('test.pc_competition')::uuid),
  '>', 0,
  'contract 111 drew it');

select isnt(
  (select registration_closes_at from public.bonus_competitions
    where id = current_setting('test.pc_competition')::uuid),
  null,
  'and registration closed with it, so a sixth player cannot join a fixture list without them');

select * from finish();

rollback;
