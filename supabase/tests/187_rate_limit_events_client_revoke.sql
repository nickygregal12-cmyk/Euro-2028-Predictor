-- Contract 134: `rate_limit_events` holds no browser privilege, and the limiter
-- still works.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the two `DB-005` asked for and the one
-- it did not. The exact access-control list, so a future default-privilege grant
-- is a failure rather than a surprise. The default-deny *behaviour*, driven as
-- the browser roles rather than read out of `pg_class` — because before this
-- contract a browser `select` on this table returned zero rows through
-- row-level security and afterwards it is refused outright, and only one of
-- those two states survives someone disabling RLS.
--
-- The third is the one that matters more than either: the limiter itself. A
-- revoke on a table read and written by a `security definer` function is
-- exactly the change that looks free and silently disarms a control, so this
-- file drives `enforce_rate_limit` to its ceiling AFTER the revoke, and drives
-- its hourly prune too, rather than asserting from the function's text that
-- definer rights make it fine.
--
-- Self-contained: its own users and its own action names, so it cannot collide
-- with a real limiter action or with another file's rows.

begin;

select plan(22);

-- The repository's established idiom for asserting a privilege refusal under a
-- switched role (`030_entry_boundary_integrity.sql`): capture the SQLSTATE and
-- compare it, rather than relying on pgTAP's own exception handling while the
-- current role is not the one that owns the test's temporary state.
create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- ---------------------------------------------------------------------------
-- The boundary: exact privileges on the table and on its identity sequence.
-- ---------------------------------------------------------------------------

select has_table(
  'public', 'rate_limit_events',
  'the rate-limit event log exists');

select ok(
  (select relrowsecurity
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'rate_limit_events'),
  'row-level security is still enabled — this contract adds a second control '
  'and removes neither');

select table_privs_are(
  'public', 'rate_limit_events', 'authenticated', array[]::text[],
  'a signed-in browser role holds no privilege at all on the event log');

select table_privs_are(
  'public', 'rate_limit_events', 'anon', array[]::text[],
  'nor does an anonymous one');

select ok(
  not has_sequence_privilege(
    'authenticated', pg_get_serial_sequence('public.rate_limit_events', 'id'), 'usage')
  and not has_sequence_privilege(
    'authenticated', pg_get_serial_sequence('public.rate_limit_events', 'id'), 'select')
  and not has_sequence_privilege(
    'authenticated', pg_get_serial_sequence('public.rate_limit_events', 'id'), 'update'),
  'the identity sequence is out of reach of a signed-in browser role');

select ok(
  not has_sequence_privilege(
    'anon', pg_get_serial_sequence('public.rate_limit_events', 'id'), 'usage')
  and not has_sequence_privilege(
    'anon', pg_get_serial_sequence('public.rate_limit_events', 'id'), 'select')
  and not has_sequence_privilege(
    'anon', pg_get_serial_sequence('public.rate_limit_events', 'id'), 'update'),
  'and of an anonymous one');

select function_privs_are(
  'public', 'enforce_rate_limit', array['text', 'integer'],
  'authenticated', array[]::text[],
  'the enforcement function itself remains uncallable by a browser role, so the '
  'log has no browser-reachable writer either');

-- ---------------------------------------------------------------------------
-- The behaviour, driven as the browser roles. Every one of these returned an
-- empty result or a silent zero-row effect before this contract, because
-- row-level security was the only control; each is now refused by privilege.
-- ---------------------------------------------------------------------------

set local role authenticated;

select is(
  pg_temp.capture_sqlstate($sql$select count(*) from public.rate_limit_events$sql$),
  '42501',
  'a signed-in browser role is refused reading the event log');

select is(
  pg_temp.capture_sqlstate($sql$insert into public.rate_limit_events (user_id, action)
      values (gen_random_uuid(), 'forged')$sql$),
  '42501',
  'refused forging an event');

select is(
  pg_temp.capture_sqlstate($sql$update public.rate_limit_events set action = 'forged'$sql$),
  '42501',
  'refused rewriting one');

select is(
  pg_temp.capture_sqlstate($sql$delete from public.rate_limit_events$sql$),
  '42501',
  'refused deleting its own history to reset a limit');

select is(
  pg_temp.capture_sqlstate($sql$truncate public.rate_limit_events$sql$),
  '42501',
  'and refused emptying the whole log, which the default grants permitted');

reset role;

set local role anon;

select is(
  pg_temp.capture_sqlstate($sql$select count(*) from public.rate_limit_events$sql$),
  '42501',
  'an anonymous role is refused reading the event log');

reset role;

-- ---------------------------------------------------------------------------
-- The limiter still works. This is the half a privileges-only change can break
-- without any test noticing, so it is driven rather than reasoned about.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  md5('c134-user')::uuid, 'c134@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('c134-user')::uuid, 'role', 'authenticated')::text, true);

select lives_ok(
  $$select public.enforce_rate_limit('c134_ceiling', 2)$$,
  'the definer function still logs a first event through the revoked table');

select lives_ok(
  $$select public.enforce_rate_limit('c134_ceiling', 2)$$,
  'and a second, below the ceiling');

select throws_ok(
  $$select public.enforce_rate_limit('c134_ceiling', 2)$$,
  '23514',
  null,
  'and the ceiling still refuses the third — the control is intact, not merely '
  'unbroken-looking');

select is(
  (select count(*)::integer from public.rate_limit_events
    where user_id = md5('c134-user')::uuid and action = 'c134_ceiling'),
  2,
  'exactly the two accepted events were written, so the refusal logged nothing');

-- The hourly prune is a DELETE by the same definer function. A revoke that took
-- its delete away would leave the log growing without bound and nothing else
-- would fail.
insert into public.rate_limit_events (user_id, action, created_at)
values (md5('c134-user')::uuid, 'c134_prune', now() - interval '2 hours');

select lives_ok(
  $$select public.enforce_rate_limit('c134_prune', 5)$$,
  'the definer function still prunes stale events');

select is(
  (select count(*)::integer from public.rate_limit_events
    where user_id = md5('c134-user')::uuid and action = 'c134_prune'),
  1,
  'the two-hour-old event was pruned and only the fresh one remains');

-- ---------------------------------------------------------------------------
-- What this contract deliberately did not change.
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('service_role', 'public.rate_limit_events', 'select'),
  'service_role is deliberately untouched: it is not a browser role, DB-005 '
  'does not name it, and narrowing the server key needs its own evidence');

select ok(
  (select count(*)::integer from pg_catalog.pg_trigger
    where tgrelid = 'public.match_predictions'::regclass
      and tgname = 'rate_limit_prediction_save'
      and not tgisinternal) = 1,
  'the prediction-save limiter trigger is still bound');

select ok(
  (select count(*)::integer from pg_catalog.pg_trigger
    where tgrelid = 'public.league_members'::regclass
      and tgname = 'rate_limit_league_membership'
      and not tgisinternal) = 1,
  'the league-membership limiter trigger is still bound');

select * from finish();
rollback;
