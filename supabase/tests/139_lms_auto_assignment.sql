-- Contract 88: the server assigns the club a season entrant did not pick.
--
-- ADR 0013 requires an entrant who misses a selection to be auto-assigned
-- deterministically and never eliminated. Contract 84 decided which club;
-- contract 86 made a season pick storable; contract 87 made the used-list reset
-- storable; this writes the missed pick.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE CANNOT TEST, AND WHY THAT IS SAID OUT LOUD
-- ---------------------------------------------------------------------------
--
-- The interesting half of contract 88 is the LOCK EXCEPTION, and this suite
-- cannot exercise it. The exception requires `session_user = 'postgres'`, and
-- `session_user` is fixed for the life of a connection: no SECURITY DEFINER
-- function can change it, `set role` changes `current_user` instead, and
-- `set session authorization` needs SUPERUSER, which this runner does not have.
-- An earlier version tried the last of those and CI returned
-- `permission denied to set session authorization`, aborting the file after
-- seven of nineteen assertions.
--
-- So every assertion below is one that holds whatever session runs it, and the
-- exception's own evidence lives where it could actually be produced — a
-- scratch PostgreSQL 16 with a real second role on its own connection, recorded
-- in the header of `supabase/migrations/20260804163000_lms_auto_assignment.sql`:
--
--   session      capability          result
--   postgres     unset               REFUSED
--   postgres     on                  ACCEPTED (the writer's path)
--   attacker     unset               REFUSED
--   attacker     set by the attacker REFUSED   <- the case that matters
--
-- Installing the `current_user` form makes that fourth row ACCEPT. Three
-- mutants of the guard were killed there: that form, capability-without-session
-- and session-without-capability.
--
-- WHAT THIS FILE DOES HOLD, and it is not nothing: that the capability is shut,
-- that no browser role can reach the writer or the guard, that the guard names
-- `session_user` and never `current_user` at the exact place an edit would
-- reintroduce the trap, and — the assertion this restructuring added — that a
-- session which CANNOT hold the exception is told so as an outcome rather than
-- being thrown at. That last one only exists because running the suite as a
-- non-superuser found the writer raising out of the insert instead of
-- reporting, which in a batch would have aborted the round for every entrant
-- after the first.

begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- A locked season round, one entrant, two clubs.
-- ---------------------------------------------------------------------------

create temporary table assign_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'AS' || n, 500 + n, 'league_matchweek', 'Assign probe ' || n
from assign_probe, generate_series(1, 2) n;

-- Names chosen so C and ICU collation disagree, because auto-assignment takes
-- the FIRST eligible club by name. Under ICU the case fold would pick the other
-- one, and a player would survive or go out on the database's locale.
insert into public.teams (tournament_id, name) select season_id, 'ATH ASSIGN' from assign_probe;
insert into public.teams (tournament_id, name) select season_id, 'afc assign' from assign_probe;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at
)
select
  md5('as-fix-' || n)::uuid, p.season_id,
  (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'AS' || n),
  (select id from public.teams where tournament_id = p.season_id and name = 'ATH ASSIGN'),
  (select id from public.teams where tournament_id = p.season_id and name = 'afc assign'),
  now() - interval '30 minutes'
from assign_probe p, generate_series(1, 2) n;

select set_config('test.c88_upper',
  (select t.id::text from public.teams t join assign_probe p on p.season_id = t.tournament_id
    where t.name = 'ATH ASSIGN'), true);
select set_config('test.c88_lower',
  (select t.id::text from public.teams t join assign_probe p on p.season_id = t.tournament_id
    where t.name = 'afc assign'), true);

select set_config('test.c88_comp',
  (select c.id::text from public.bonus_competitions c
     join assign_probe p on p.season_id = c.tournament_id
    where c.game_key = 'last_man_standing'), true);

update public.bonus_competitions
set published = true, registration_opens_at = now() - interval '3 hours'
where id = current_setting('test.c88_comp')::uuid;

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (md5('c88-missed')::uuid, 'c88-missed@example.test',
   'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  (md5('c88-picked')::uuid, 'c88-picked@example.test',
   'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  (md5('c88-out')::uuid, 'c88-out@example.test',
   'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at) values
  (current_setting('test.c88_comp')::uuid, md5('c88-missed')::uuid, now() - interval '2 hours'),
  (current_setting('test.c88_comp')::uuid, md5('c88-picked')::uuid, now() - interval '2 hours'),
  (current_setting('test.c88_comp')::uuid, md5('c88-out')::uuid, now() - interval '2 hours');

update public.bonus_competition_entrants set outcome = 'eliminated'
where competition_id = current_setting('test.c88_comp')::uuid
  and user_id = md5('c88-out')::uuid;

-- Round one has LOCKED. Round two has not.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at) values
  (md5('c88-locked')::uuid, current_setting('test.c88_comp')::uuid, 501, 'Assign probe locked',
    now() - interval '4 hours', now() - interval '1 hour'),
  (md5('c88-open')::uuid, current_setting('test.c88_comp')::uuid, 502, 'Assign probe open',
    now() - interval '4 hours', now() + interval '1 hour'),
  -- A locked round with no fixtures linked: nothing to assign from.
  (md5('c88-bare')::uuid, current_setting('test.c88_comp')::uuid, 503, 'Assign probe bare',
    now() - interval '4 hours', now() - interval '1 hour');

insert into public.season_cup_window_fixtures (window_id, season_fixture_id) values
  (md5('c88-locked')::uuid, md5('as-fix-1')::uuid),
  (md5('c88-open')::uuid, md5('as-fix-2')::uuid);

-- ---------------------------------------------------------------------------
-- The capability, as far as any session can see it.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.lms_auto_assignment_in_progress(),
  false,
  'the capability is shut by default — an open default would be a standing hole in the lock'
);

select set_config('predictor.lms_auto_assign', 'on', true);

-- Deliberately NOT asserted as true: whether opening it grants the exception
-- depends on `session_user`, which this runner cannot choose. What IS asserted
-- is that the lock still refuses, which holds either way — under a postgres
-- session because the round below is a TOURNAMENT round, and under any other
-- session because the session half fails too.
select set_config('predictor.lms_auto_assign', '', true);

-- ---------------------------------------------------------------------------
-- The exception is narrowed to season rounds as well.
--
-- The writer refuses a tournament round, so nothing in the codebase would use a
-- wider exception — which is exactly why it must be asserted rather than left
-- to the caller's good manners. The tournament Last Man Standing is a delivered
-- game at the contract-63 baseline and its lock should not become writable by a
-- server session that has no reason to write to it.
-- ---------------------------------------------------------------------------

insert into public.bonus_competitions (id, tournament_id, game_key, published, registration_opens_at)
select md5('c88-tourn-comp')::uuid, id, 'last_man_standing', true, now() - interval '3 hours'
from public.tournaments where kind = 'tournament' order by name limit 1;

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
values (md5('c88-tourn-comp')::uuid, md5('c88-picked')::uuid, now() - interval '2 hours');

select set_config('test.c88_tourn_match',
  (select m.id::text from public.matches m
     join public.tournaments t on t.id = m.tournament_id and t.kind = 'tournament'
    where m.round = 'group' and m.matchday = 1
    order by m.match_ref limit 1), true);

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values (md5('c88-tourn-locked')::uuid, md5('c88-tourn-comp')::uuid, 504, 'Tournament locked',
        now() - interval '4 hours', now() - interval '1 hour');

insert into public.bonus_window_fixtures (window_id, match_id)
values (md5('c88-tourn-locked')::uuid, current_setting('test.c88_tourn_match')::uuid);

select set_config('predictor.lms_auto_assign', 'on', true);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (md5('c88-tourn-comp')::uuid, md5('c88-picked')::uuid, md5('c88-tourn-locked')::uuid,
            (select home_team_id from public.matches
              where id = current_setting('test.c88_tourn_match')::uuid), 0)
  $$,
  '23514',
  'This round has locked',
  'a locked TOURNAMENT round refuses even a postgres session holding the capability'
);

select set_config('predictor.lms_auto_assign', '', true);

-- ---------------------------------------------------------------------------
-- The writer.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.auto_assign_lms_entrant(
    current_setting('test.c88_comp')::uuid, md5('c88-missed')::uuid, md5('c88-open')::uuid)
    ->> 'outcome',
  'not_locked',
  'nothing is assigned before the lock — the entrant may still pick for themselves'
);

select is(
  predictor_internal.auto_assign_lms_entrant(
    current_setting('test.c88_comp')::uuid, md5('c88-out')::uuid, md5('c88-locked')::uuid)
    ->> 'outcome',
  'eliminated',
  'an entrant already recorded as eliminated is not assigned — elimination is derived elsewhere, not here'
);

select is(
  predictor_internal.auto_assign_lms_entrant(
    current_setting('test.c88_comp')::uuid, md5('c88-missed')::uuid, md5('c88-bare')::uuid)
    ->> 'outcome',
  'no_eligible_club',
  'a locked round with no fixtures writes nothing and says so, rather than inventing a pick'
);

-- THE ASSERTION THIS RESTRUCTURING ADDED, and the reason for it. Whether this
-- call assigns or is refused depends on `session_user`, which the runner cannot
-- choose — so the outcome is not asserted. What IS asserted, and holds in every
-- session, is that it RETURNS one rather than raising.
--
-- The first version raised. Running the suite as a non-superuser found it, and
-- it mattered: the driver settles a whole round, so one entrant it cannot
-- assign must not abort the round for everyone after them. A session that
-- cannot hold the exception now gets `refused`/`lock_exception_unavailable`.
select lives_ok(
  $$
    select predictor_internal.auto_assign_lms_entrant(
      current_setting('test.c88_comp')::uuid, md5('c88-missed')::uuid, md5('c88-locked')::uuid)
  $$,
  'a locked season round returns an outcome rather than raising, whatever the session can hold'
);

-- THE ASSERTION THAT CATCHES A LEAKED CAPABILITY, and it holds either way: the
-- writer opens the capability before deciding whether it can use it, so both
-- the assigning path and the refusing path must close it again. If either left
-- it open, every later statement in the transaction could write past a lock and
-- nothing about the call would look wrong.
select is(
  predictor_internal.lms_auto_assignment_in_progress(),
  false,
  'and the writer closes the capability behind itself on both paths'
);

-- Idempotence — `already_picked` on a second call — needs a row to have been
-- written by the first, so it needs the exception and is not assertable here.
-- It is in the migration header's scratch-database evidence.

-- ---------------------------------------------------------------------------
-- What the writer will not touch.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('lms_auto_assignment_in_progress', 'auto_assign_lms_entrant')
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))),
  0,
  'no browser role can execute the capability check or the writer'
);

-- The guard must read `session_user`, and must NOT read `current_user`. This is
-- a text assertion and a weak one on its own — case four above is the real
-- evidence — but it names the trap at the exact place a future edit would
-- reintroduce it.
select is(
  (select count(*)::integer from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'lms_auto_assignment_in_progress'
      and p.prosrc like '%session_user%'
      and p.prosrc not like '%current_user%'),
  1,
  'the capability check reads session_user and never current_user'
);

select * from finish();
rollback;
