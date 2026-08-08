-- Contract 133: a player can discover their private season Championship and
-- open its server-owned fixture/table/schedule without gaining direct table
-- reach or turning a guessed private UUID into an existence oracle.

begin;

select plan(22);

-- ---------------------------------------------------------------------------
-- Surface and grants.
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'get_my_season_cup_instances', array['uuid'],
  'the caller-owned Championship instance read exists');
select has_function(
  'public', 'get_season_cup_player_view', array['uuid'],
  'the explicit Championship player read exists');
select is(
  has_function_privilege('authenticated', 'public.get_my_season_cup_instances(uuid)', 'execute'),
  true, 'authenticated may discover their Championship instances');
select is(
  has_function_privilege('authenticated', 'public.get_season_cup_player_view(uuid)', 'execute'),
  true, 'authenticated may open an entitled Championship instance');
select is(
  has_function_privilege('anon', 'public.get_my_season_cup_instances(uuid)', 'execute'),
  false, 'anonymous may not discover Championship instances');
select is(
  has_function_privilege('anon', 'public.get_season_cup_player_view(uuid)', 'execute'),
  false, 'anonymous may not open a Championship player view');
select is(
  (select count(*)::integer
   from information_schema.role_table_grants grant_row
   where grant_row.table_schema = 'public'
     and grant_row.table_name in (
       'bonus_competitions', 'bonus_competition_entrants',
       'bonus_competition_windows', 'bonus_cup_groups',
       'bonus_cup_members', 'bonus_cup_fixtures'
     )
     and grant_row.grantee in ('anon', 'authenticated')),
  0,
  'the bounded reads add no direct browser grant to private Cup tables');

-- ---------------------------------------------------------------------------
-- Deterministic league-season fixture and two Championship instances.
-- ---------------------------------------------------------------------------

insert into public.tournaments (
  name, year, competition_id, season_key, kind, display_timezone, status
)
select
  'C133 Championship Probe Season', 2028, tournament.competition_id,
  'c133-probe', 'league_season', tournament.display_timezone, 'active'
from public.tournaments tournament
where tournament.kind = 'league_season'
order by tournament.name
limit 1;

create temporary table c133_probe as
select (select id from public.tournaments where season_key = 'c133-probe') as season_id;

insert into public.competition_rounds (
  tournament_id, round_key, ordinal, kind, label
)
select season_id, 'C133-R2', 2, 'league_matchweek', 'Matchweek 2'
from c133_probe;

insert into public.teams (tournament_id, name)
select season_id, club
from c133_probe,
(values ('C133 Alpha'), ('C133 Beta')) clubs(club);

select set_config(
  'test.c133_alpha',
  (select team.id::text from public.teams team where team.name = 'C133 Alpha'),
  true
);
select set_config(
  'test.c133_beta',
  (select team.id::text from public.teams team where team.name = 'C133 Beta'),
  true
);

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status
)
select
  probe.season_id,
  round.id,
  current_setting('test.c133_alpha')::uuid,
  current_setting('test.c133_beta')::uuid,
  now() + interval '2 days',
  'scheduled'
from c133_probe probe
join public.competition_rounds round
  on round.tournament_id = probe.season_id
 and round.round_key = 'C133-R2';

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('c133-user-' || n)::uuid,
  format('c133-user-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('c133-user-' || n)::uuid, format('C133 Player %s', n), now()
from generate_series(1, 5) n;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select md5('c133-entry-' || n)::uuid, md5('c133-user-' || n)::uuid,
       probe.season_id, now()
from c133_probe probe, generate_series(1, 4) n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  registration_opens_at, registration_closes_at, draw_required, visibility_kind
)
select
  md5('c133-public')::uuid, probe.season_id, 'predictor_cup', true, 'active',
  now() - interval '2 hours', now() + interval '1 day', true, 'public'
from c133_probe probe;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  registration_opens_at, registration_closes_at, draw_required, visibility_kind
)
select
  md5('c133-private')::uuid, probe.season_id, 'predictor_cup', false, 'active',
  now() - interval '2 hours', now() - interval '1 hour', true, 'private'
from c133_probe probe;

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('c133-private')::uuid, md5('c133-user-' || n)::uuid, now() - interval '90 minutes'
from generate_series(1, 4) n;

insert into public.bonus_competition_windows (
  id, competition_id, sequence, label, opens_at, locks_at
) values (
  md5('c133-window')::uuid,
  md5('c133-private')::uuid,
  1,
  'Matchweek 2',
  now() - interval '1 hour',
  now() + interval '2 days'
);

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select md5('c133-window')::uuid, fixture.id
from public.season_fixtures fixture
join c133_probe probe on probe.season_id = fixture.tournament_id;

insert into public.bonus_cup_groups (
  id, competition_id, tournament_id, ordinal, size, phase_kind
)
select
  md5('c133-group')::uuid, md5('c133-private')::uuid,
  probe.season_id, 1, 4, 'initial'
from c133_probe probe;

insert into public.bonus_cup_members (
  competition_id, user_id, group_id, phase_kind, draw_number
)
select
  md5('c133-private')::uuid,
  md5('c133-user-' || n)::uuid,
  md5('c133-group')::uuid,
  'initial',
  n
from generate_series(1, 4) n;

insert into public.bonus_cup_fixtures (
  competition_id, tournament_id, stage, group_id, window_id, matchday,
  home_user_id, away_user_id
)
select
  md5('c133-private')::uuid, probe.season_id, 'group', md5('c133-group')::uuid,
  md5('c133-window')::uuid, 1,
  md5('c133-user-1')::uuid, md5('c133-user-2')::uuid
from c133_probe probe
union all
select
  md5('c133-private')::uuid, probe.season_id, 'group', md5('c133-group')::uuid,
  md5('c133-window')::uuid, 1,
  md5('c133-user-3')::uuid, md5('c133-user-4')::uuid
from c133_probe probe;

-- ---------------------------------------------------------------------------
-- Authentication gates.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_my_season_cup_instances((select season_id from c133_probe))$$,
  '42501', null, 'instance discovery requires authentication');
select throws_ok(
  $$select public.get_season_cup_player_view(md5('c133-private')::uuid)$$,
  '42501', null, 'the explicit player view requires authentication');

select set_config('request.jwt.claim.sub', md5('c133-user-1')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.get_my_season_cup_instances(null)$$,
  '22023', null, 'a null season refuses');

-- ---------------------------------------------------------------------------
-- Member discovery and selected-instance read.
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(
    public.get_my_season_cup_instances((select season_id from c133_probe)) -> 'instances'
  ),
  2,
  'a private member sees their private Championship and the current public instance');

select is(
  public.get_my_season_cup_instances((select season_id from c133_probe))
    #>> '{instances,0,visibility_kind}',
  'private',
  'the caller-owned private Championship is discoverable');

select is(
  public.get_my_season_cup_instances((select season_id from c133_probe))
    #>> '{instances,0,current_fixture,opponent,display_name}',
  'C133 Player 2',
  'instance discovery names the caller opponent on the server');

select is(
  public.get_my_season_cup_instances((select season_id from c133_probe))
    #>> '{instances,0,current_fixture,window_label}',
  'Matchweek 2',
  'instance discovery identifies the caller current window');

select is(
  (public.get_season_cup_player_view(md5('c133-private')::uuid) ->> 'entered')::boolean,
  true,
  'the private member may open the selected Championship');

select is(
  (public.get_season_cup_player_view(md5('c133-private')::uuid) #>> '{group,size}')::integer,
  4,
  'the selected view returns only the caller current group');

select is(
  jsonb_array_length(
    public.get_season_cup_player_view(md5('c133-private')::uuid) -> 'members'
  ),
  4,
  'the selected view discloses the four group members');

select is(
  public.get_season_cup_player_view(md5('c133-private')::uuid)
    #>> '{members,1,display_name}',
  'C133 Player 2',
  'group members are presented by bounded display name rather than raw ids alone');

select is(
  jsonb_array_length(
    public.get_season_cup_player_view(md5('c133-private')::uuid) -> 'fixtures'
  ),
  2,
  'the selected view returns the complete current-group fixture card');

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_season_cup_player_view(md5('c133-private')::uuid) -> 'fixtures'
    ) fixture
    where (fixture ->> 'is_my_fixture')::boolean
  ),
  1,
  'exactly one group fixture is marked as the caller fixture');

select is(
  public.get_season_cup_player_view(md5('c133-private')::uuid) -> 'table',
  public.get_season_cup_phase(md5('c133-private')::uuid) -> 'table',
  'the player view reuses the authoritative phase table without reranking it');

-- ---------------------------------------------------------------------------
-- Outsider privacy: discovery hides the private instance and direct-id probing
-- is indistinguishable from an id that does not exist.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('c133-user-5')::uuid::text, true);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_my_season_cup_instances((select season_id from c133_probe)) -> 'instances'
    ) instance
    where instance ->> 'visibility_kind' = 'private'
  ),
  0,
  'an authenticated outsider discovers no private Championship instance');

select is(
  jsonb_array_length(
    public.get_my_season_cup_instances((select season_id from c133_probe)) -> 'instances'
  ),
  1,
  'the outsider sees only the current public Championship');

select is(
  public.get_season_cup_player_view(md5('c133-private')::uuid) - 'competition_id',
  public.get_season_cup_player_view(md5('c133-missing')::uuid) - 'competition_id',
  'a guessed private UUID has the same response shape as a nonexistent UUID');

select is(
  jsonb_object_length(
    public.get_season_cup_player_view(md5('c133-private')::uuid)
  ),
  2,
  'the denied private-id response exposes no visibility, membership, group or fixture metadata');

select * from finish();
rollback;
