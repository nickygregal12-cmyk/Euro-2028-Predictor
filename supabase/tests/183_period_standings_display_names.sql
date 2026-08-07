-- Contract 131: the retention tables can name their players.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that naming is OPTIONAL and off by
-- default. Contract 122 decided to return no display name and said why; this
-- preserves that decision as the default rather than overturning it, so the
-- three-argument answer must be byte-identical to what contract 122 returned.
--
-- THE SECOND ASSERTION is that there is exactly ONE definition of the read. A
-- fourth defaulted parameter added without dropping the old signature would
-- leave two, and every three-argument call would keep reaching the old one.
--
-- Self-contained: its own season, clubs, rounds, fixtures, entries and users.

begin;

select plan(13);

select ok(
  (select has_function_privilege('authenticated', proc.oid, 'EXECUTE')
     from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'get_season_period_standings'
      and proc.oid = to_regprocedure('public.get_season_period_standings(uuid,text,integer,boolean)')),
  'the four-argument read is the one a signed-in caller reaches');

select ok(
  not (select bool_or(has_function_privilege('authenticated', proc.oid, 'EXECUTE'))
         from pg_proc proc
         join pg_namespace ns on ns.oid = proc.pronamespace
        where ns.nspname = 'public'
          and proc.proname = 'get_season_period_standings'
          and proc.oid = to_regprocedure('public.get_season_period_standings(uuid,text,integer)')),
  'and the three-argument one is RETIRED — left in the catalogue because '
  'dropping it would make this migration destructive, revoked so no second '
  'body of the same read can answer differently');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'name_season_standing_rows'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the mapping beneath it reaches no browser or service role');

-- ---------------------------------------------------------------------------
-- Setup: one season, three matchweeks in one month, two entrants.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C131 Names Probe', 2030, t.competition_id, 'nam-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.nam_season',
  (select id::text from public.tournaments where season_key = 'nam-probe'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('nam-mp')::uuid, current_setting('test.nam_season')::uuid,
  'main_predictor', true, 'active', false, 'public',
  now() - interval '2 days'
);

insert into public.teams (tournament_id, name) values
  (current_setting('test.nam_season')::uuid, 'Nam Rovers'),
  (current_setting('test.nam_season')::uuid, 'Nam United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.nam_season')::uuid, 'nam-mw1', 1, 'league_matchweek', 'Matchweek 1'),
  (current_setting('test.nam_season')::uuid, 'nam-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.nam_mw1',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.nam_season')::uuid and round_key = 'nam-mw1'), true);
select set_config('test.nam_mw2',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.nam_season')::uuid and round_key = 'nam-mw2'), true);

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.nam_season')::uuid, round.id,
       (select id from public.teams where tournament_id = current_setting('test.nam_season')::uuid and name = 'Nam Rovers'),
       (select id from public.teams where tournament_id = current_setting('test.nam_season')::uuid and name = 'Nam United'),
       -- Fixed instants rather than offsets from now(). The monthly table is
       -- keyed on the CALENDAR MONTH a round's window opens in, and two
       -- relative dates can straddle a month boundary depending on the day CI
       -- runs — which would split one table into two and make the assertions
       -- below depend on the date.
       case round.round_key when 'nam-mw1' then timestamptz '2029-03-05 12:00:00+00'
                            else timestamptz '2029-03-12 12:00:00+00' end,
       'scheduled'
  from public.competition_rounds round
 where round.tournament_id = current_setting('test.nam_season')::uuid;

-- The month calendar reads `window_opens_at`, so it is derived through the
-- authority that owns it rather than written by hand.
select ok(
  predictor_internal.derive_round_play_windows(current_setting('test.nam_season')::uuid) = 2,
  'both matchweeks have a derived play window, so the month is placeable');

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('nam-user-' || n)::uuid, format('nam-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('nam-user-1')::uuid, 'Nam Leader', now()),
  (md5('nam-user-2')::uuid, 'Nam Chaser', now());

insert into public.entries (
  id, user_id, tournament_id, game_competition_id
)
select md5('nam-entry-' || n)::uuid, md5('nam-user-' || n)::uuid,
       current_setting('test.nam_season')::uuid, md5('nam-mp')::uuid
from generate_series(1, 2) as n;

insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored)
values
  (current_setting('test.nam_season')::uuid, md5('nam-entry-1')::uuid,
   current_setting('test.nam_mw1')::uuid, 9, 1),
  (current_setting('test.nam_season')::uuid, md5('nam-entry-2')::uuid,
   current_setting('test.nam_mw1')::uuid, 3, 1),
  (current_setting('test.nam_season')::uuid, md5('nam-entry-1')::uuid,
   current_setting('test.nam_mw2')::uuid, 6, 1),
  (current_setting('test.nam_season')::uuid, md5('nam-entry-2')::uuid,
   current_setting('test.nam_mw2')::uuid, 4, 1);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('nam-user-1')::uuid, 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- OFF BY DEFAULT, and the default answer is contract 122's exactly.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'form', 5, false))
    ->'rows'->0->>'display_name',
  null,
  'asking for no names carries no display name — contract 122''s decision is '
  'preserved as the off position rather than overturned');

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'form', 5, false))
    ->'rows'->0->>'entry_id',
  (md5('nam-entry-1')::uuid)::text,
  'and the entry id is still there, so nothing a caller reads today moves');

-- ---------------------------------------------------------------------------
-- ON BY REQUEST.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'form', 5, true))
    ->'rows'->0->>'display_name',
  'Nam Leader',
  'asking for names gives them');

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'form', 5, true))
    ->'rows'->0->>'points',
  '15',
  'beside the same points');

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'form', 5, true))
    ->'rows'->1->>'display_name',
  'Nam Chaser',
  'and the ORDER is preserved — the naming is a mapping over what the authority '
  'returned, not a re-sort');

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'month', null, true))
    ->'months'->0->'rows'->0->>'display_name',
  'Nam Leader',
  'the monthly table names its players too');

select is(
  (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'month', null, true))
    ->'months'->0->'rows'->0->>'rank',
  '1',
  'without disturbing the rank the authority computed');

select is(
  jsonb_array_length(
    (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'month', null, true))
      ->'months'),
  jsonb_array_length(
    (public.get_season_period_standings(current_setting('test.nam_season')::uuid, 'month', null, false))
      ->'months'),
  'and the same number of months either way');

-- ---------------------------------------------------------------------------
-- The boundary, unchanged.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('nam-user-2')::uuid, 'role', 'authenticated')::text, true);

select lives_ok(
  format('select public.get_season_period_standings(%L::uuid, %L, 5, true)',
         current_setting('test.nam_season'), 'form'),
  'a second entrant reads it too');

select * from finish();
rollback;
