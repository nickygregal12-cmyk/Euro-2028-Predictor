-- Contract 126: a game that has not started can be rejoined.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one the preview found: leave a Last
-- Man Standing competition that has never opened a round, and get back in. That
-- was refused before this contract, permanently, from the moment the
-- competition was published — months before it can be played.
--
-- THE SECOND ASSERTION IS THE ONE THAT KEEPS THE RULE. ADR 0013 fixes the field
-- once the first round locks, and the rolling-entry rejection says why: a
-- player joining at round eight arrives with all twenty clubs while survivors
-- have burned eight. So the same leave-and-rejoin must be REFUSED the moment a
-- window has locked, and both halves are driven here against the same
-- competition rather than asserted from the function's text.
--
-- Self-contained: its own season, competitions and users.

begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('predictor_internal.competition_is_running(uuid)') is not null,
  'the running test exists');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_name = 'competition_is_running'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and no browser or service role may call it directly');

-- ---------------------------------------------------------------------------
-- Setup: one season, a Last Man Standing competition and a Championship, and
-- two players. The Championship is here because it is the control: its
-- `allow_rejoin` is true, so this contract must not change it in either state.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C126 Rejoin Probe', 2030, t.competition_id, 'rjn-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.rjn_season',
  (select id::text from public.tournaments where season_key = 'rjn-probe'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values
  (md5('rjn-lms')::uuid, current_setting('test.rjn_season')::uuid,
   'last_man_standing', true, 'active', false, 'public', now() - interval '2 days'),
  (md5('rjn-cup')::uuid, current_setting('test.rjn_season')::uuid,
   'predictor_cup', true, 'active', true, 'public', now() - interval '2 days');

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('rjn-user-' || n)::uuid, format('rjn-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('rjn-user-' || n)::uuid, format('Rjn Player %s', n), now()
from generate_series(1, 2) as n;

-- ---------------------------------------------------------------------------
-- What "running" means, before anything else depends on it.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.competition_is_running(md5('rjn-lms')::uuid),
  false,
  'a competition with no windows at all is not running');

insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
values (md5('rjn-lms')::uuid, 1, 'Round 1', now() - interval '1 day', now() + interval '3 days');

select is(
  predictor_internal.competition_is_running(md5('rjn-lms')::uuid),
  false,
  'nor is one whose first round is scheduled but has not locked — a calendar '
  'published weeks ahead has fixed no field');

update public.bonus_competition_windows
   set locks_at = null where competition_id = md5('rjn-lms')::uuid;

select is(
  predictor_internal.competition_is_running(md5('rjn-lms')::uuid),
  false,
  'nor one whose window carries no lock instant at all');

update public.bonus_competition_windows
   set locks_at = now() + interval '3 days' where competition_id = md5('rjn-lms')::uuid;

-- ---------------------------------------------------------------------------
-- THE BUG THE PREVIEW FOUND. Nothing has locked, so leaving and rejoining is
-- the position of a player who never joined.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('rjn-user-1')::uuid, 'role', 'authenticated')::text, true);

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-lms')::uuid),
  'a player joins Last Man Standing before it has started');

select lives_ok(
  format('select public.leave_competition_game(%L::uuid)', md5('rjn-lms')::uuid),
  'and may leave, having scored nothing');

select is(
  (select status from public.game_memberships
    where game_competition_id = md5('rjn-lms')::uuid
      and user_id = md5('rjn-user-1')::uuid),
  'left',
  'the membership records that they left rather than being deleted');

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = md5('rjn-lms')::uuid
      and user_id = md5('rjn-user-1')::uuid),
  0,
  'and the entrant row is gone, so no Last Man Standing state can be inherited '
  'on the way back in');

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-lms')::uuid),
  'AND THEY CAN REJOIN — nothing has locked, no club has been burned, and the '
  'depletion asymmetry the rolling-entry rejection exists for does not exist');

select is(
  (select status from public.game_memberships
    where game_competition_id = md5('rjn-lms')::uuid
      and user_id = md5('rjn-user-1')::uuid),
  'active',
  'they are actively entered again');

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = md5('rjn-lms')::uuid
      and user_id = md5('rjn-user-1')::uuid),
  1,
  'with a fresh entrant row');

-- ---------------------------------------------------------------------------
-- THE RULE THAT MUST SURVIVE. Once a round has locked, the field is fixed.
-- ---------------------------------------------------------------------------

select lives_ok(
  format('select public.leave_competition_game(%L::uuid)', md5('rjn-lms')::uuid),
  'they leave once more, still before any lock');

update public.bonus_competition_windows
   set opens_at = now() - interval '2 days',
       locks_at = now() - interval '1 day'
 where competition_id = md5('rjn-lms')::uuid;

select is(
  predictor_internal.competition_is_running(md5('rjn-lms')::uuid),
  true,
  'the first round has now locked, so the competition is running');

select throws_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-lms')::uuid),
  '55000',
  'This game cannot be rejoined once it has started',
  'and rejoining is REFUSED — ADR 0013 fixes the field once the first round '
  'locks, and a player arriving now would hold every club while survivors have '
  'burned theirs');

select is(
  (select status from public.game_memberships
    where game_competition_id = md5('rjn-lms')::uuid
      and user_id = md5('rjn-user-1')::uuid),
  'left',
  'and they are genuinely still out, not merely told so');

-- ---------------------------------------------------------------------------
-- The refusals that sit above this one, unchanged.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('rjn-user-2')::uuid, 'role', 'authenticated')::text, true);

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-cup')::uuid),
  'a second player joins the Championship');

select throws_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-cup')::uuid),
  '23505',
  'You have already entered this game',
  'joining twice is still refused, which this contract does not touch');

-- `game_memberships_state_shape` requires the instant that goes with the
-- status, so both move together.
update public.game_memberships
   set status = 'disqualified', disqualified_at = now()
 where game_competition_id = md5('rjn-cup')::uuid
   and user_id = md5('rjn-user-2')::uuid;

select throws_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-cup')::uuid),
  '55000',
  'A disqualified game entry cannot be rejoined',
  'and a disqualified entry is still refused — that refusal sits above the one '
  'this contract changed and must not have moved');

-- ---------------------------------------------------------------------------
-- The control: a game whose capability allows rejoining is unaffected in
-- BOTH states, which is what makes this contract's blast radius one game.
-- ---------------------------------------------------------------------------

update public.game_memberships
   set status = 'left', left_at = now(), disqualified_at = null
 where game_competition_id = md5('rjn-cup')::uuid
   and user_id = md5('rjn-user-2')::uuid;

insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
values (md5('rjn-cup')::uuid, 1, 'Matchday 1', now() - interval '2 days', now() - interval '1 day');

select is(
  predictor_internal.competition_is_running(md5('rjn-cup')::uuid),
  true,
  'the Championship is running too');

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('rjn-cup')::uuid),
  'and it can still be rejoined while running, because its own game definition '
  'allows it — this contract narrows when a refusal applies, never which games '
  'refuse');

select * from finish();
rollback;
