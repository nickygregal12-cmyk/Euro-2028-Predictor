-- Contract 166: the multi-group Championship, which the single-group launcher
-- refuses by name.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the three that make a draw either
-- correct or quietly wrong for a whole season:
--
--   * every entrant is drawn exactly once, into groups whose sizes match what
--     `select_season_cup_format` declared. Two independent expressions of one
--     rule — the format's arithmetic and the dealing — is how they drift;
--   * every pairing inside a group occurs exactly once and nobody plays twice
--     in a matchday. A schedule that got this wrong would look plausible and
--     produce a nonsense table in week six;
--   * a second launch REFUSES rather than redraws. Everywhere else in this
--     batch a second run is a no-op; here it would redraw a competition people
--     are already playing.

begin;

select plan(13);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C166 Multi Group', 2051, t.competition_id, 'multi-group', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.mg_season',
  (select id::text from public.tournaments where season_key = 'multi-group'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('mg-t1')::uuid, current_setting('test.mg_season')::uuid, 'MG Rovers'),
  (md5('mg-t2')::uuid, current_setting('test.mg_season')::uuid, 'MG United');

-- Forty future matchweeks, so the calendar is not what limits the format.
insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('mg-r' || n)::uuid, current_setting('test.mg_season')::uuid,
       'mg-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 40) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.mg_season')::uuid, md5('mg-r' || n)::uuid,
       md5('mg-t1')::uuid, md5('mg-t2')::uuid,
       now() + (n || ' days')::interval, 'scheduled'
  from generate_series(1, 40) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
-- PUBLIC, so name, owner and invite code are all NULL:
-- `bonus_competitions_private_identity` (contract 152) requires a private
-- competition to have all three and a public one to have none. A public
-- competition belongs to the platform and is not anybody's to name.
values (md5('mg-cup')::uuid, current_setting('test.mg_season')::uuid, 'predictor_cup',
        null, true, 'active', true, 'public', now() - interval '30 days');

-- TWENTY-FIVE entrants, chosen deliberately over a round number: it produces
-- groups of 13 and 12, so the draw's remainder handling and the different
-- round requirements of an odd and an even group are both exercised. A field
-- that split evenly would prove neither.
set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('mg-u' || n)::uuid, format('mg-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 25) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('mg-u' || n)::uuid, 'MG Player ' || n, now() from generate_series(1, 25) as n;

insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('mg-cup')::uuid, md5('mg-u' || n)::uuid from generate_series(1, 25) as n;

-- ---------------------------------------------------------------------------
-- The gate
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('mg-u1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.admin_launch_cup_group_stage(%L::uuid)$$, md5('mg-cup')::uuid),
  '42501', null,
  'drawing a Championship needs competition administration');

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('mg-u1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select set_config('test.mg_result',
  public.admin_launch_cup_group_stage(md5('mg-cup')::uuid)::text, true);

select is(
  current_setting('test.mg_result')::jsonb ->> 'outcome', 'launched',
  'the multi-group field the single-group launcher refuses is drawn here');

select is(
  current_setting('test.mg_result')::jsonb ->> 'groupCount', '2',
  'twenty-five entrants take two groups');

select is(
  current_setting('test.mg_result')::jsonb ->> 'roundsNeeded', '13',
  'and the competition runs for as many rounds as its LARGEST group needs');

-- THE FIRST ASSERTION THIS FILE EXISTS FOR.
select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('mg-cup')::uuid),
  25,
  'every entrant is drawn exactly once');

select is(
  (select count(distinct draw_number)::integer from public.bonus_cup_members
    where competition_id = md5('mg-cup')::uuid),
  25,
  'and holds a distinct draw number');

select is(
  (select count(*)::integer
     from public.bonus_cup_groups cup_group
     left join (select group_id, count(*) as drawn from public.bonus_cup_members
                 where competition_id = md5('mg-cup')::uuid group by group_id) counted
            on counted.group_id = cup_group.id
    where cup_group.competition_id = md5('mg-cup')::uuid
      and coalesce(counted.drawn, 0) <> cup_group.size),
  0,
  'and the drawn membership matches the size the format declared, group for group');

-- THE SECOND ASSERTION.
select is(
  (select count(*)::integer from (
     select least(home_user_id::text, away_user_id::text) a,
            greatest(home_user_id::text, away_user_id::text) b
       from public.bonus_cup_fixtures where competition_id = md5('mg-cup')::uuid
      group by 1, 2 having count(*) <> 1) offending),
  0,
  'every pairing inside a group occurs exactly once');

select is(
  (select count(*)::integer from (
     select matchday, who from (
       select matchday, home_user_id as who from public.bonus_cup_fixtures
        where competition_id = md5('mg-cup')::uuid
       union all
       select matchday, away_user_id from public.bonus_cup_fixtures
        where competition_id = md5('mg-cup')::uuid
     ) sides group by matchday, who having count(*) > 1) clashes),
  0,
  'and nobody plays twice in one matchday');

-- Contract 124's established behaviour, and the reason a smaller group is not a
-- problem to be solved: it simply has no fixture in the last rounds.
select is(
  (select max(fixture.matchday)::integer
     from public.bonus_cup_fixtures fixture
     join public.bonus_cup_groups cup_group on cup_group.id = fixture.group_id
    where fixture.competition_id = md5('mg-cup')::uuid and cup_group.size = 12),
  11,
  'the SMALLER group simply has no fixture in the last rounds, as contract 124 established');

-- Auditable.
select is(
  (select detail ->> 'drawRule' from public.bonus_competition_audit
    where competition_id = md5('mg-cup')::uuid
      and action = 'championship_group_stage_drawn'),
  'draw numbers by entrant id ascending; groups dealt round-robin by draw number',
  'the draw records the rule it followed, so it can be re-derived and checked');

select is(
  (select jsonb_array_length(detail -> 'allocation') from public.bonus_competition_audit
    where competition_id = md5('mg-cup')::uuid
      and action = 'championship_group_stage_drawn'),
  2,
  'and records the full allocation, because a draw nobody can inspect is one nobody can check');

-- THE THIRD ASSERTION.
select is(
  public.admin_launch_cup_group_stage(md5('mg-cup')::uuid) ->> 'outcome',
  'already_drawn',
  'A SECOND LAUNCH REFUSES rather than redrawing a competition already in play');

reset role;

select * from finish();

rollback;
