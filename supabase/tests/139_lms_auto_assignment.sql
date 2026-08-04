-- Contract 88: the server assigns the club a season entrant did not pick.
--
-- ADR 0013 requires an entrant who misses a selection to be auto-assigned
-- deterministically and never eliminated. Contract 84 decided which club;
-- contract 86 made a season pick storable; contract 87 made the used-list reset
-- storable; this writes the missed pick.
--
-- MOST OF THIS FILE IS ABOUT THE LOCK, not about the assignment. Assignment
-- happens BECAUSE the round locked, so the writer needs an exception to the one
-- control that stops a player picking after they have seen a result. A hole
-- there is the worst defect this game can have, and it would be invisible: the
-- feature would work perfectly either way.
--
-- The exception is a PAIR — a `postgres` session AND an explicitly opened
-- capability — and the four cases below are why both halves are needed. Case
-- four is the attack: an ordinary role can set a custom GUC on its own session,
-- so the capability alone controls nothing. Case one is the other half: without
-- it, any server function running as `postgres` could write past a lock by
-- accident.
--
-- The tournament's comparable exception is written `current_user = 'postgres'`,
-- which inside a SECURITY DEFINER function is the OWNER for every caller and so
-- admits case four. That form is not copied, and case four is the assertion
-- that would catch anyone copying it.

begin;
select plan(19);

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
-- The lock exception: four cases, and both halves of the pair.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.lms_auto_assignment_in_progress(),
  false,
  'the capability is shut by default — an open default would be a standing hole in the lock'
);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (current_setting('test.c88_comp')::uuid, md5('c88-picked')::uuid,
            md5('c88-locked')::uuid, current_setting('test.c88_upper')::uuid, 0)
  $$,
  '23514',
  'This round has locked',
  'case one: a postgres session WITHOUT the capability is refused past the lock'
);

select set_config('predictor.lms_auto_assign', 'on', true);

select is(
  predictor_internal.lms_auto_assignment_in_progress(),
  true,
  'case two: a postgres session WITH the capability holds the exception'
);

select lives_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (current_setting('test.c88_comp')::uuid, md5('c88-picked')::uuid,
            md5('c88-locked')::uuid, current_setting('test.c88_upper')::uuid, 0)
  $$,
  'and may therefore write past the lock — the writer''s own path'
);

select set_config('predictor.lms_auto_assign', '', true);

select is(
  predictor_internal.lms_auto_assignment_in_progress(),
  false,
  'closing the capability shuts the exception again within the same transaction'
);

delete from public.bonus_lms_selections where window_id = md5('c88-locked')::uuid;

-- Cases three and four need a session that is NOT `postgres` but CAN reach the
-- table, so that the guard is the only thing left between the caller and the
-- lock. `authenticated` cannot be used for it — asserted below, it holds
-- nothing on either the table or the schema, so a refusal would prove the
-- privilege boundary rather than the guard. This role exists for the length of
-- this transaction and disappears with the rollback.
select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name = 'bonus_lms_selections' and grantee in ('authenticated', 'anon')),
  0,
  'no browser role holds any grant on the selections table — writes arrive through the RPC'
);

select is(
  (select count(*)::integer from (values ('authenticated'), ('anon')) r(name)
    where has_schema_privilege(r.name, 'predictor_internal', 'usage')),
  0,
  'and no browser role can reach predictor_internal at all'
);

create or replace function pg_temp.capture_error(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '(no error)';
exception when others then
  return sqlerrm;
end;
$$;

create role c88_probe nologin;
grant insert, select on public.bonus_lms_selections to c88_probe;

-- `set session authorization`, NOT `set role`. This matters and is easy to get
-- wrong: `set role` changes `current_user` and leaves `session_user` alone, so
-- a postgres session that does `set role` is STILL a postgres session and the
-- guard admits it — correctly, by its own definition. Written with `set role`,
-- case four below passes the trigger and fails on row-level security instead,
-- which looks like a pass for the wrong reason. The guard distinguishes
-- SESSIONS; only `set session authorization` changes what it reads.
--
-- The attempts are made under the probe authorization but every ASSERTION is
-- made after it is reset. Running an assertion as a role with no rights of its
-- own would fail on the test framework's own bookkeeping rather than on
-- anything this contract does, and that failure would look like a finding.
set local session authorization c88_probe;

select set_config('test.c88_case_three', pg_temp.capture_error(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (current_setting('test.c88_comp')::uuid, md5('c88-picked')::uuid,
            md5('c88-locked')::uuid, current_setting('test.c88_upper')::uuid, 0)
  $$), true);

-- THE ATTACK. Setting a custom GUC needs no privilege, so the attacker really
-- does set it — the capability alone controls nothing.
select set_config('predictor.lms_auto_assign', 'on', true);
select set_config('test.c88_capability_seen',
  current_setting('predictor.lms_auto_assign', true), true);

select set_config('test.c88_case_four', pg_temp.capture_error(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (current_setting('test.c88_comp')::uuid, md5('c88-picked')::uuid,
            md5('c88-locked')::uuid, current_setting('test.c88_upper')::uuid, 0)
  $$), true);

select set_config('predictor.lms_auto_assign', '', true);
reset session authorization;

select is(
  current_setting('test.c88_case_three'),
  'This round has locked',
  'case three: a non-postgres session that CAN write is still refused past the lock'
);

select is(
  current_setting('test.c88_capability_seen'),
  'on',
  'case four: a non-postgres session CAN open the capability — it is not a privileged setting'
);

-- Written `current_user = 'postgres'`, the guard would be TRUE here — the
-- trigger is owned by postgres — and the lock would let this through. This is
-- the assertion that catches that form; it was checked by installing the
-- `current_user` version and watching it fail.
--
-- Under that mutant it fails with the ROW-LEVEL SECURITY message rather than
-- this one, because the probe writes on behalf of another user and the policy
-- catches what the lock let past. Recorded plainly so the second line of
-- defence is not mistaken for the first: an attacker inserting for THEMSELVES
-- satisfies the policy, so with the wrong guard there would be nothing left.
select is(
  current_setting('test.c88_case_four'),
  'This round has locked',
  'but the lock still refuses it, because session_user is the caller where current_user is the owner'
);

revoke insert, select on public.bonus_lms_selections from c88_probe;
drop role c88_probe;

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

select is(
  predictor_internal.auto_assign_lms_entrant(
    current_setting('test.c88_comp')::uuid, md5('c88-missed')::uuid, md5('c88-locked')::uuid),
  jsonb_build_object(
    'outcome', 'assigned',
    'teamId', current_setting('test.c88_upper'),
    'usedCycle', 0),
  'a missed pick is assigned the code-point-first eligible club — ATH ASSIGN, not afc assign'
);

-- THE ASSERTION THAT CATCHES A LEAKED CAPABILITY. If the writer left it open,
-- every later statement in the transaction could write past a lock, and nothing
-- about the assignment itself would look wrong.
select is(
  predictor_internal.lms_auto_assignment_in_progress(),
  false,
  'and the writer closes the capability behind itself'
);

select is(
  predictor_internal.auto_assign_lms_entrant(
    current_setting('test.c88_comp')::uuid, md5('c88-missed')::uuid, md5('c88-locked')::uuid)
    ->> 'outcome',
  'already_picked',
  'running it again assigns nothing — idempotent, so a retry after a crash is safe'
);

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
