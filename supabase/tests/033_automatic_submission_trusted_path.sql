begin;

select plan(9);

-- The trusted-refresh boundary in `enforce_entry_lock_generic`, and the
-- ordinary-user lock either side of it.
--
-- An earlier draft of the Stage C1 redefinition made this function
-- `security definer` and tested `session_user = 'postgres'`. Both were wrong,
-- and together they broke automatic submission at every deadline:
--
--   * PostgREST connects as `authenticator` and then `set role`s, so
--     `session_user` is `authenticator` for browser AND service-role traffic
--     alike. It is never `postgres`, so the exemption was permanently dead and
--     the processor's own group-position refresh was rejected as a late user
--     edit — the complete entry recorded `invalid` /
--     "Predictions are locked — the tournament has started".
--   * Had the predicate stayed `current_user` while the function was
--     `security definer`, `current_user` would always have been `postgres`
--     inside the trigger. `set_config` is executable by `authenticated`, so
--     any signed-in user could have set the flag and written positions after
--     the lock.
--
-- The shipped shape is `security invoker` + `current_user`, matching contract
-- 64. These assertions pin both halves so neither can regress alone.

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-00000000e001',
  'trusted-path@example.test', 'authenticated', 'authenticated',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.tournaments (id, name, year, starts_on, ends_on, lock_at) values (
  '00000000-0000-0000-0000-00000000e101',
  'Trusted Path Boundary', 2028, '2028-06-09', '2028-07-09',
  now() + interval '1 day'
);

insert into public.groups (id, tournament_id, letter) values (
  '00000000-0000-0000-0000-00000000e201',
  '00000000-0000-0000-0000-00000000e101',
  'E'
);

insert into public.teams (id, tournament_id, name) values
  ('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-00000000e101', 'Boundary One'),
  ('00000000-0000-0000-0000-00000000e302', '00000000-0000-0000-0000-00000000e101', 'Boundary Two');

insert into public.group_teams (group_id, team_id, slot) values
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000e301', 1),
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000e302', 2);

insert into public.entries (id, user_id, tournament_id) values (
  '00000000-0000-0000-0000-00000000e501',
  '00000000-0000-0000-0000-00000000e001',
  '00000000-0000-0000-0000-00000000e101'
);

-- 1. The function must not be security definer. As `security invoker`,
--    `current_user` is the real caller, which is what makes the predicate a
--    trust boundary rather than a constant.
select is(
  (select prosecdef from pg_proc where proname = 'enforce_entry_lock_generic'),
  false,
  'enforce_entry_lock_generic runs as security invoker so current_user is the real caller'
);

-- 2. It must pin search_path regardless (design-system/database discipline).
select ok(
  (select proconfig::text from pg_proc where proname = 'enforce_entry_lock_generic')
    like '%search_path=%',
  'enforce_entry_lock_generic pins search_path'
);

-- 3. The trusted predicate is current_user, never session_user. session_user is
--    `authenticator` for every PostgREST request and can never be postgres.
select ok(
  (select prosrc from pg_proc where proname = 'enforce_entry_lock_generic')
    like '%current_user = ''postgres''%',
  'the trusted-refresh predicate tests current_user'
);

select ok(
  (select prosrc from pg_proc where proname = 'enforce_entry_lock_generic')
    not like '%session_user%',
  'the trusted-refresh predicate does not test session_user, which is never postgres under PostgREST'
);

-- 4. Ordinary write before the lock succeeds.
select lives_ok(
  $sql$
    insert into public.predicted_group_positions (entry_id, group_id, team_id, position)
    values (
      '00000000-0000-0000-0000-00000000e501',
      '00000000-0000-0000-0000-00000000e201',
      '00000000-0000-0000-0000-00000000e301',
      1
    )
  $sql$,
  'a position write before the entry lock succeeds'
);

update public.tournaments
set lock_at = now()
where id = '00000000-0000-0000-0000-00000000e101';

-- 5. Ordinary write exactly at the lock fails — the boundary is inclusive.
select throws_ok(
  $sql$
    insert into public.predicted_group_positions (entry_id, group_id, team_id, position)
    values (
      '00000000-0000-0000-0000-00000000e501',
      '00000000-0000-0000-0000-00000000e201',
      '00000000-0000-0000-0000-00000000e302',
      2
    )
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'a position write at the exact entry lock is rejected'
);

update public.tournaments
set lock_at = now() - interval '1 hour'
where id = '00000000-0000-0000-0000-00000000e101';

-- 6. Ordinary write after the lock fails.
select throws_ok(
  $sql$
    insert into public.predicted_group_positions (entry_id, group_id, team_id, position)
    values (
      '00000000-0000-0000-0000-00000000e501',
      '00000000-0000-0000-0000-00000000e201',
      '00000000-0000-0000-0000-00000000e302',
      2
    )
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'a position write after the entry lock is rejected'
);

-- 7. Setting the flag is not itself a privilege. `set_config` is public, so the
--    flag must confer nothing on its own — only the combination of the flag and
--    an actual postgres current_user is trusted. This is the assertion that
--    stops "service role" from meaning "ignore scoring locks".
set local role service_role;
select set_config('predictor.auto_submission_refresh', 'on', true);

select throws_ok(
  $sql$
    insert into public.predicted_group_positions (entry_id, group_id, team_id, position)
    values (
      '00000000-0000-0000-0000-00000000e501',
      '00000000-0000-0000-0000-00000000e201',
      '00000000-0000-0000-0000-00000000e302',
      2
    )
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'service_role holding the trusted flag is still rejected after the lock'
);

reset role;

-- 8. The trusted path itself works: postgres, which is what every
--    security-definer function in the automatic-submission chain runs as, may
--    complete the refresh after the deadline.
select set_config('predictor.auto_submission_refresh', 'on', true);

select lives_ok(
  $sql$
    insert into public.predicted_group_positions (entry_id, group_id, team_id, position)
    values (
      '00000000-0000-0000-0000-00000000e501',
      '00000000-0000-0000-0000-00000000e201',
      '00000000-0000-0000-0000-00000000e302',
      2
    )
  $sql$,
  'the trusted processor path may refresh positions after the deadline'
);

select * from finish();
rollback;
