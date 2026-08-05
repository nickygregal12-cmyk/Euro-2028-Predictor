-- Contract 118: the games hub stops being blind to a season's fixtures.
--
-- The assertion this file exists for is the behavioural one, not the shape
-- one: a season window must come back with its fixtures AND with a
-- `result_state` the hub can act on. Empty fixtures were never an error — they
-- were an empty array that made `resolveCompetitionStatus` unable to ever
-- settle a season window, so the hub card stuck on the first locked round.
-- Proving the array is non-empty is proving the stuck card is unstuck.
--
-- The vocabulary mapping gets its own assertions because it is the one place
-- this contract could be subtly wrong rather than obviously wrong. Contract 77
-- established `status = 'played'` and `result_state in ('confirmed',
-- 'corrected')` as the same answer to "has this fixture finished?"; if the
-- mapping drifted, a season window would either never settle (the bug this
-- fixes) or settle on a postponed fixture (worse than the bug this fixes).

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- The helpers exist, and stay internal.
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('predictor_internal.bonus_window_fixture_facts(uuid)') is not null,
  'the neutral combiner exists');

select is(
  has_function_privilege('authenticated',
    'predictor_internal.bonus_window_fixture_facts(uuid)', 'execute'),
  false,
  'and no browser role may call it directly');

select is(
  (select pg_get_functiondef(to_regprocedure('public.get_bonus_games(uuid)')::oid)
     like '%bonus_window_fixtures%'),
  false,
  'get_bonus_games no longer reaches the tournament fixture relation — the '
  'reason its entry leaves 168_tournament_only_browser_reads.sql');

-- ---------------------------------------------------------------------------
-- Setup: one season window with a played fixture and a scheduled one.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C117 Facts Probe Season', 2028, t.competition_id, 'c117-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

create temporary table facts_probe as
select (select id from public.tournaments where season_key = 'c117-probe') as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'C117-R1', 950, 'league_matchweek', 'Facts probe R1' from facts_probe;

insert into public.teams (tournament_id, name)
select season_id, name from facts_probe,
  (values ('C117 One'), ('C117 Two'), ('C117 Three'), ('C117 Four')) clubs(name);

insert into public.bonus_competitions (tournament_id, game_key, published)
select season_id, 'last_man_standing', true from facts_probe;

select set_config('test.c117_competition',
  (select c.id::text from public.bonus_competitions c join facts_probe p on p.season_id = c.tournament_id
    where c.game_key = 'last_man_standing'), true);

insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at, settles_at)
values (current_setting('test.c117_competition')::uuid, 1, 'Facts Round',
        now() - interval '2 days', now() - interval '1 day', now() + interval '1 day');

select set_config('test.c117_window',
  (select id::text from public.bonus_competition_windows
    where competition_id = current_setting('test.c117_competition')::uuid), true);

-- One played, one still scheduled.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score)
select p.season_id,
       (select id from public.competition_rounds r where r.tournament_id = p.season_id and r.round_key = 'C117-R1'),
       (select id from public.teams where name = 'C117 One'),
       (select id from public.teams where name = 'C117 Two'),
       now() - interval '30 hours', 'played', 1::smallint, 1::smallint
  from facts_probe p;

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
select p.season_id,
       (select id from public.competition_rounds r where r.tournament_id = p.season_id and r.round_key = 'C117-R1'),
       (select id from public.teams where name = 'C117 Three'),
       (select id from public.teams where name = 'C117 Four'),
       now() + interval '2 hours'
  from facts_probe p;

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select current_setting('test.c117_window')::uuid, f.id
  from public.season_fixtures f
 where f.competition_round_id =
   (select id from public.competition_rounds r join facts_probe p on p.season_id = r.tournament_id
     where r.round_key = 'C117-R1');

-- ---------------------------------------------------------------------------
-- The season limb, and the mapping.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from predictor_internal.bonus_window_fixture_facts(
       current_setting('test.c117_window')::uuid)),
  2,
  'the neutral combiner returns a season window''s fixtures — the empty array '
  'that stuck the hub card is gone');

select is(
  (select facts.result_state
     from predictor_internal.bonus_window_fixture_facts(
       current_setting('test.c117_window')::uuid) facts
    where facts.kickoff_at < now()),
  'confirmed',
  'a played season fixture maps to confirmed, on contract 77''s equivalence');

select is(
  (select facts.result_state
     from predictor_internal.bonus_window_fixture_facts(
       current_setting('test.c117_window')::uuid) facts
    where facts.kickoff_at > now()),
  'scheduled',
  'an unplayed season fixture maps to scheduled');

-- The mapping must not settle a window on a fixture that did not finish.
update public.season_fixtures
   set status = 'postponed'
 where tournament_id = (select season_id from facts_probe)
   and status = 'played';

select is(
  (select count(*)::integer
     from predictor_internal.bonus_window_fixture_facts(
       current_setting('test.c117_window')::uuid) facts
    where facts.result_state = 'confirmed'),
  0,
  'a POSTPONED fixture is never confirmed — mapping it as finished would settle '
  'a window on a match that was not played, which is worse than the bug this '
  'contract fixes');

update public.season_fixtures
   set status = 'played'
 where tournament_id = (select season_id from facts_probe)
   and status = 'postponed';

select is(
  (select count(*)::integer
     from predictor_internal.bonus_season_window_fixture_facts(
       current_setting('test.c117_window')::uuid)),
  2,
  'the season limb carries them');

select is(
  (select count(*)::integer
     from predictor_internal.bonus_tournament_window_fixture_facts(
       current_setting('test.c117_window')::uuid)),
  0,
  'and the tournament limb contributes nothing to a season window — which is '
  'why the combiner can union rather than branch');

-- ---------------------------------------------------------------------------
-- The tournament path is unchanged, which matters more than the season path
-- working: this contract redefines a function the Euro hub depends on.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from predictor_internal.bonus_season_window_fixture_facts(window_row.id)),
  0,
  'a tournament window gets nothing from the season limb')
  from (
    select w.id
      from public.bonus_competition_windows w
      join public.bonus_competitions c on c.id = w.competition_id
      join public.tournaments t on t.id = c.tournament_id
     where t.kind = 'tournament'
       and exists (select 1 from public.bonus_window_fixtures f where f.window_id = w.id)
     limit 1
  ) window_row;

select is(
  (select count(*)::integer
     from predictor_internal.bonus_window_fixture_facts(window_row.id)),
  (select count(*)::integer
     from public.bonus_window_fixtures f where f.window_id = window_row.id),
  'and the combiner returns exactly what the tournament relation holds for it — '
  'the Euro hub reads the same rows it read before this contract')
  from (
    select w.id
      from public.bonus_competition_windows w
      join public.bonus_competitions c on c.id = w.competition_id
      join public.tournaments t on t.id = c.tournament_id
     where t.kind = 'tournament'
       and exists (select 1 from public.bonus_window_fixtures f where f.window_id = w.id)
     limit 1
  ) window_row;

select is(
  (select count(*)::integer
     from predictor_internal.bonus_window_fixture_facts(
       '00000000-0000-0000-0000-000000000000'::uuid)),
  0,
  'an unknown window returns no rows rather than raising');

select finish();
rollback;
