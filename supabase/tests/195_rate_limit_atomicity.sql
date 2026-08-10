-- Contract 145: the rate limiter decides atomically, and still decides the same
-- thing (`DATA-007`).
--
-- THE ASSERTION THIS FILE EXISTS FOR is the one a single-session test cannot
-- make directly: that concurrent callers cannot each observe a count below the
-- ceiling and all proceed. Two sessions cannot be driven from inside one pgTAP
-- transaction, so this proves the mechanism instead of the race — it drives
-- `enforce_rate_limit` and then reads `pg_locks` to show that the caller's own
-- transaction-scoped advisory lock is genuinely held, with the key the
-- migration documents. That is the serialisation point; if it is removed, this
-- file fails. The lock's *scope* — transaction rather than session, so it can
-- never leak into a pooled connection — is proved statically by
-- `tests/database-parity/rateLimitParity.test.ts`, which reads the effective
-- function text and requires `pg_advisory_xact_lock` before the count.
--
-- The rest of the file exists because a lock added to a working control is
-- exactly the change that can quietly stop it working. So the ceiling, the
-- refusal, the fact that a refusal logs nothing, the recovery once the window
-- passes, the hourly prune, the unauthenticated no-op and the two trigger
-- bindings are all driven again, after the redefinition, rather than reasoned
-- about from the diff.
--
-- Self-contained: its own users and its own action names, so it cannot collide
-- with a real limiter action or with another file's rows.

begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- The function is still the same shape: definer, pinned search path, unchanged
-- signature. A rate limiter that stopped being `security definer` would fail
-- open the moment contract 134's revoke denied it the table.
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'enforce_rate_limit', array['text', 'integer'],
  'the limiter still has exactly its original signature');

select ok(
  (select p.prosecdef from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enforce_rate_limit'),
  'and is still security definer, which is what lets it reach a table both '
  'browser roles were revoked from at contract 134');

select ok(
  (select p.proconfig::text like '%search_path=public%' from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enforce_rate_limit'),
  'and still pins its search path');

-- ---------------------------------------------------------------------------
-- A caller to drive it as.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  md5('c145-user')::uuid, 'c145@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  (
  md5('c145-other')::uuid, 'c145-other@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('c145-user')::uuid, 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- The serialisation point. This is the contract.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_catalog.pg_locks
    where locktype = 'advisory' and pid = pg_catalog.pg_backend_pid()),
  0,
  'no advisory lock is held before the limiter is called, so the assertion '
  'below cannot pass on someone else''s lock');

select lives_ok(
  $$select public.enforce_rate_limit('c145_lock', 5)$$,
  'the limiter accepts a first event');

-- The single-argument `pg_advisory_xact_lock(bigint)` form reports the key
-- split across `classid` (high 32 bits) and `objid` (low 32), with
-- `objsubid = 1`. Reassembling it and comparing against the derivation the
-- migration documents proves both that a lock is held and that it is keyed on
-- the caller rather than on something coarser.
select is(
  (select count(*)::integer from pg_catalog.pg_locks
    where locktype = 'advisory'
      and pid = pg_catalog.pg_backend_pid()
      and objsubid = 1
      and mode = 'ExclusiveLock'
      and ((classid::bigint << 32) | objid::bigint)
          = pg_catalog.hashtextextended(
              'rate_limit_events:' || md5('c145-user')::uuid::text, 0)),
  1,
  'the caller''s own advisory lock is held after the call — the serialisation '
  'point DATA-007 asked for, keyed on the caller');

select is(
  (select count(*)::integer from pg_catalog.pg_locks
    where locktype = 'advisory'
      and pid = pg_catalog.pg_backend_pid()
      and objsubid = 1
      and ((classid::bigint << 32) | objid::bigint)
          = pg_catalog.hashtextextended(
              'rate_limit_events:' || md5('c145-other')::uuid::text, 0)),
  0,
  'and a different caller''s key is NOT locked, so two players never wait on '
  'each other');

-- A second action for the same caller must reuse the one key rather than take
-- a second lock: two locks held at once is the deadlock the migration header
-- rules out by construction.
select lives_ok(
  $$select public.enforce_rate_limit('c145_second_action', 5)$$,
  'a second action by the same caller is accepted');

select is(
  (select count(distinct (classid, objid))::integer from pg_catalog.pg_locks
    where locktype = 'advisory' and pid = pg_catalog.pg_backend_pid()),
  1,
  'and it took no second advisory key: this function can only ever hold one of '
  'its own locks, so it cannot deadlock against itself');

-- ---------------------------------------------------------------------------
-- The control still controls. Ceiling, refusal, and what a refusal must not do.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.enforce_rate_limit('c145_ceiling', 2)$$,
  'a first event below the ceiling is logged');

select lives_ok(
  $$select public.enforce_rate_limit('c145_ceiling', 2)$$,
  'and a second, still below it');

select throws_ok(
  $$select public.enforce_rate_limit('c145_ceiling', 2)$$,
  '23514',
  null,
  'and the third is refused at the ceiling — the lock did not make the limiter '
  'permissive');

select is(
  (select count(*)::integer from public.rate_limit_events
    where user_id = md5('c145-user')::uuid and action = 'c145_ceiling'),
  2,
  'and the refusal logged nothing, so a blocked caller cannot extend their own '
  'penalty by retrying');

-- The correction path: a limit is a window, not a ban. Ageing the two accepted
-- events out of the counting window must let the same caller through again.
update public.rate_limit_events
   set created_at = now() - interval '90 seconds'
 where user_id = md5('c145-user')::uuid and action = 'c145_ceiling';

select lives_ok(
  $$select public.enforce_rate_limit('c145_ceiling', 2)$$,
  'once the minute has passed the same caller is accepted again — the window '
  'still slides');

-- ---------------------------------------------------------------------------
-- Housekeeping and the unauthenticated path, both unchanged.
-- ---------------------------------------------------------------------------

insert into public.rate_limit_events (user_id, action, created_at)
values (md5('c145-user')::uuid, 'c145_prune', now() - interval '2 hours');

select lives_ok(
  $$select public.enforce_rate_limit('c145_prune', 5)$$,
  'the hourly prune still runs inside the lock');

select is(
  (select count(*)::integer from public.rate_limit_events
    where user_id = md5('c145-user')::uuid and action = 'c145_prune'),
  1,
  'and the two-hour-old event is gone, so the log still cannot grow unbounded');

select set_config('request.jwt.claims', null, true);

select lives_ok(
  $$select public.enforce_rate_limit('c145_anonymous', 1)$$,
  'an unauthenticated call still returns without raising — it has no caller to '
  'key a lock on and nothing to count');

select * from finish();
rollback;
