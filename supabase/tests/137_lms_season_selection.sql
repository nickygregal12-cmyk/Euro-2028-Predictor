-- Contract 86: a season Last Man Standing entrant can pick at all.
--
-- Unlike `135` and `136`, this rule cannot be exercised with jsonb arguments:
-- it lives in a trigger, and the thing that changed is WHICH RELATION the
-- participation check reads. Only real rows in both link tables can tell the
-- widened check from the original, so this file seeds a league season and a
-- tournament side by side and drives inserts through the trigger.
--
-- THE FAILURE THIS GUARDS AGAINST is not the one the change fixes. Making the
-- season path work is easy to verify — a pick that used to be refused is now
-- accepted. The dangerous outcome is a widening that becomes a HOLE: an `or`
-- placed so that an EMPTY fixture list satisfies the check would accept any
-- club in any round, and every pre-existing tournament test would still pass,
-- because tournament rounds have fixtures. So the assertions below spend more
-- effort on what must STILL be refused than on what now succeeds.
--
-- The two rounds are deliberately in the same shape: each has one fixture, and
-- each is asked about its own two clubs, the other round's two clubs, and a
-- club that plays nowhere. A widening that leaks would show up as a season club
-- accepted into the tournament round.

begin;
select plan(13);

-- ---------------------------------------------------------------------------
-- One league season and one tournament, each with a Last Man Standing round.
-- ---------------------------------------------------------------------------

create temporary table lms_season_probe as
select
  (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
  (select id from public.tournaments where kind = 'tournament' order by name limit 1) as tournament_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'MW-LMS', 90, 'league_matchweek', 'Matchweek LMS' from lms_season_probe;

insert into public.teams (tournament_id, name)
select season_id, 'LMS Season Home' from lms_season_probe;
insert into public.teams (tournament_id, name)
select season_id, 'LMS Season Away' from lms_season_probe;
insert into public.teams (tournament_id, name)
select season_id, 'LMS Season Idle' from lms_season_probe;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at
)
select
  md5('lms-season-fixture')::uuid,
  p.season_id,
  (select id from public.competition_rounds
    where tournament_id = p.season_id and round_key = 'MW-LMS'),
  (select id from public.teams where tournament_id = p.season_id and name = 'LMS Season Home'),
  (select id from public.teams where tournament_id = p.season_id and name = 'LMS Season Away'),
  now() + interval '2 hours'
from lms_season_probe p;

-- The tournament comparison round, taken from the seeded Euro fixture list so
-- nothing about it is special to this file.
select set_config(
  'test.c86_match',
  (select m.id::text from public.matches m
     join lms_season_probe p on p.tournament_id = m.tournament_id
    where m.round = 'group' and m.matchday = 1
    order by m.match_ref limit 1),
  true
);

select set_config('test.c86_tourn_home',
  (select home_team_id::text from public.matches where id = current_setting('test.c86_match')::uuid), true);
select set_config('test.c86_tourn_away',
  (select away_team_id::text from public.matches where id = current_setting('test.c86_match')::uuid), true);

select set_config('test.c86_season_home',
  (select t.id::text from public.teams t join lms_season_probe p on p.season_id = t.tournament_id
    where t.name = 'LMS Season Home'), true);
select set_config('test.c86_season_away',
  (select t.id::text from public.teams t join lms_season_probe p on p.season_id = t.tournament_id
    where t.name = 'LMS Season Away'), true);
select set_config('test.c86_idle',
  (select t.id::text from public.teams t join lms_season_probe p on p.season_id = t.tournament_id
    where t.name = 'LMS Season Idle'), true);

-- The seed already gives every league season a Last Man Standing competition,
-- and `unique (tournament_id, game_key)` means there can only be one — so this
-- reuses it rather than inserting a rival. The tournament has no LMS
-- competition, so that one is created here.
select set_config(
  'test.c86_season_comp',
  (select c.id::text from public.bonus_competitions c
     join lms_season_probe p on p.season_id = c.tournament_id
    where c.game_key = 'last_man_standing'),
  true
);

update public.bonus_competitions
set published = true, registration_opens_at = now() - interval '3 hours'
where id = current_setting('test.c86_season_comp')::uuid;

insert into public.bonus_competitions (id, tournament_id, game_key, published, registration_opens_at)
select md5('c86-tourn-comp')::uuid, tournament_id, 'last_man_standing', true, now() - interval '3 hours'
from lms_season_probe;

-- One player per assertion, and every one of them an entrant in BOTH
-- competitions. `bonus_lms_selections` carries a composite foreign key to
-- `bonus_competition_entrants`, so a non-entrant would be refused by the key
-- rather than by the trigger — and every refusal below would then pass for the
-- wrong reason.
set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('c86-' || who.name)::uuid,
  format('c86-%s@example.test', who.name),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (values ('player'), ('player-two'), ('player-three'), ('player-four'),
             ('player-five'), ('player-six'), ('player-seven'), ('player-eight'),
             ('player-nine')) as who(name);

set local session_replication_role = origin;

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select comp.id, md5('c86-' || who.name)::uuid, now() - interval '2 hours'
from (values (current_setting('test.c86_season_comp')::uuid), (md5('c86-tourn-comp')::uuid)) as comp(id)
cross join (values ('player'), ('player-two'), ('player-three'), ('player-four'),
                   ('player-five'), ('player-six'), ('player-seven'), ('player-eight'),
                   ('player-nine')) as who(name);

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at) values
  (md5('c86-season-window')::uuid, current_setting('test.c86_season_comp')::uuid, 901, 'Matchweek LMS',
    now() - interval '2 hours', now() + interval '1 hour'),
  (md5('c86-tourn-window')::uuid, md5('c86-tourn-comp')::uuid, 901, 'Matchday 1',
    now() - interval '2 hours', now() + interval '1 hour'),
  -- Same season round, already past its deadline. The lock is the guard this
  -- contract deliberately leaves alone.
  (md5('c86-locked-window')::uuid, current_setting('test.c86_season_comp')::uuid, 902, 'Matchweek LMS (locked)',
    now() - interval '4 hours', now() - interval '1 hour');

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('c86-tourn-window')::uuid, current_setting('test.c86_match')::uuid);

insert into public.season_cup_window_fixtures (window_id, season_fixture_id) values
  (md5('c86-season-window')::uuid, md5('lms-season-fixture')::uuid),
  (md5('c86-locked-window')::uuid, md5('lms-season-fixture')::uuid);

-- ---------------------------------------------------------------------------
-- The season round now accepts the clubs that play in it. Both sides, because
-- reading only `home_team_id` is the obvious half-implementation.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (current_setting('test.c86_season_comp')::uuid, md5('c86-player')::uuid,
            md5('c86-season-window')::uuid, current_setting('test.c86_season_home')::uuid)
  $$,
  'the home club of a season fixture can be picked — the pick this contract makes possible'
);

select lives_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (current_setting('test.c86_season_comp')::uuid, md5('c86-player-two')::uuid,
            md5('c86-season-window')::uuid, current_setting('test.c86_season_away')::uuid)
  $$,
  'and so can the away club'
);

-- ---------------------------------------------------------------------------
-- What the widening must NOT have opened.
--
-- The two cross-competition cases below are belt-and-braces, and honestly so:
-- contract 65's `bonus_lms_tournament_team_fkey` already keys a selection's
-- club to the selection's competition, so a club from another competition is
-- refused by the database whatever the trigger does. They are asserted anyway
-- because the trigger is what produces the message a player sees, and because
-- the sqlstate distinguishes which guard fired. Under a mutant that drops the
-- club filter from the season branch, case two below reports 23503 from that
-- foreign key instead of 23514 from the trigger — a real difference, and the
-- reason the expected sqlstate is pinned rather than left as "it threw".
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (current_setting('test.c86_season_comp')::uuid, md5('c86-player-three')::uuid,
            md5('c86-season-window')::uuid, current_setting('test.c86_idle')::uuid)
  $$,
  '23514',
  'The picked team does not play in this round',
  'a season club playing in no fixture of the round is still refused'
);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (current_setting('test.c86_season_comp')::uuid, md5('c86-player-four')::uuid,
            md5('c86-season-window')::uuid, current_setting('test.c86_tourn_home')::uuid)
  $$,
  '23514',
  'The picked team does not play in this round',
  'a tournament club cannot be picked into a season round'
);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (md5('c86-tourn-comp')::uuid, md5('c86-player-five')::uuid,
            md5('c86-tourn-window')::uuid, current_setting('test.c86_season_home')::uuid)
  $$,
  '23514',
  'The picked team does not play in this round',
  'and a season club cannot be picked into a tournament round — the widening does not leak'
);

-- ---------------------------------------------------------------------------
-- The tournament path, unchanged. These would pass before this contract too,
-- which is exactly why they are here: they are the regression, not the news.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (md5('c86-tourn-comp')::uuid, md5('c86-player')::uuid,
            md5('c86-tourn-window')::uuid, current_setting('test.c86_tourn_home')::uuid)
  $$,
  'the tournament round still accepts its own home club'
);

select lives_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (md5('c86-tourn-comp')::uuid, md5('c86-player-six')::uuid,
            md5('c86-tourn-window')::uuid, current_setting('test.c86_tourn_away')::uuid)
  $$,
  'and its own away club'
);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (md5('c86-tourn-comp')::uuid, md5('c86-player-seven')::uuid,
            md5('c86-tourn-window')::uuid,
            (select m.home_team_id from public.matches m
               where m.id <> current_setting('test.c86_match')::uuid
                 and m.home_team_id not in (
                   current_setting('test.c86_tourn_home')::uuid,
                   current_setting('test.c86_tourn_away')::uuid)
               order by m.match_ref limit 1))
  $$,
  '23514',
  'The picked team does not play in this round',
  'a tournament club playing elsewhere is still refused'
);

-- ---------------------------------------------------------------------------
-- Every other guard is untouched. The lock in particular: the auto-assignment
-- writer needs an exception to it, and that exception is NOT in this contract.
-- If one of these starts passing, the hole arrived early.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (current_setting('test.c86_season_comp')::uuid, md5('c86-player-eight')::uuid,
            md5('c86-locked-window')::uuid, current_setting('test.c86_season_home')::uuid)
  $$,
  '23514',
  'This round has locked',
  'a locked season round still refuses a club that genuinely plays in it'
);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (current_setting('test.c86_season_comp')::uuid, md5('c86-player-nine')::uuid,
            gen_random_uuid(), current_setting('test.c86_season_home')::uuid)
  $$,
  '23514',
  'Selections belong to a Last Man Standing round',
  'a round that does not exist is refused by the trigger, which runs BEFORE the foreign key'
);

-- ---------------------------------------------------------------------------
-- The change is confined to the participation check.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'assert_bonus_lms_selection_shape'
      and p.prosrc like '%season_cup_window_fixtures%'
      and p.prosrc like '%bonus_window_fixtures%'),
  1,
  'the trigger reads BOTH links — neither replaced the other'
);

select is(
  (select count(*)::integer from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'assert_bonus_lms_selection_shape'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']),
  1,
  'redefining it kept SECURITY DEFINER and the empty search_path'
);

-- The trigger binding is what actually enforces any of the above. `create or
-- replace` leaves it alone, but a future contract that drops and recreates the
-- function would silently take it with it.
select is(
  (select count(*)::integer from pg_catalog.pg_trigger t
     join pg_catalog.pg_class c on c.oid = t.tgrelid
    where c.relname = 'bonus_lms_selections'
      and not t.tgisinternal
      and t.tgfoid = 'predictor_internal.assert_bonus_lms_selection_shape()'::regprocedure),
  1,
  'and the selections table is still bound to it'
);

select * from finish();
rollback;
