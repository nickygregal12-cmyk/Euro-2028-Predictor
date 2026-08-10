-- Contract 145 — the rate limiter decides atomically (risk register `DATA-007`)
--
-- Follow-up migration; append-only. Redefines exactly one function and moves
-- nothing else.
--
-- THE DEFECT. `20260720210000_rate_limits.sql` enforces the ceiling by counting
-- and then inserting:
--
--     select count(*) into v_count from rate_limit_events where ... ;
--     if v_count >= p_max_per_min then raise ... end if;
--     insert into rate_limit_events ... ;
--
-- with nothing between the read and the write. Under the read-committed
-- isolation the Data API uses, N concurrent transactions for one caller each
-- take their own snapshot, each sees a count below the ceiling because none of
-- the others has committed yet, and all N proceed. The ceiling is therefore not
-- a ceiling under exactly the condition it exists for: a scripted client firing
-- requests in parallel rather than in sequence. A human clicking is serialised
-- by their own latency and never sees this; an abuser is not, and does not.
--
-- Both limiters are affected and the second is the one that matters. The
-- prediction-save limit (60/min) is self-scoped — row-level security confines a
-- caller to their own entry — so overshooting it wastes the platform's capacity
-- and nobody else's. The league-membership limit (5/min) is the control that
-- makes invite-code probing expensive (`SEC-001`, `ACQ-R10`), and a limit that
-- can be overshot by running the attempts in parallel is the wrong control for
-- an attacker who was always going to run them in parallel.
--
-- THE FIX is one line, and it is the fix the platform already uses for exactly
-- this shape: `predictor_internal.enforce_public_user_limit` and
-- `enforce_total_league_limit` (`20260727191942_operating_cap_enforcement.sql`)
-- serialise their site-wide counters on a transaction-scoped advisory lock, so
-- that "a transaction that wins the final slot commits before the next waiter
-- counts". This gives the per-caller counters the same guarantee. The waiter
-- acquires the lock only once the holder's transaction has ended, and under
-- read committed its subsequent `count(*)` takes a fresh snapshot that includes
-- the holder's committed event. Overshoot is then impossible rather than
-- unlikely.
--
-- WHY ONE KEY PER CALLER RATHER THAN PER (CALLER, ACTION). Per-action keys
-- would allow one transaction to hold two of these locks, and two transactions
-- acquiring the same two keys in opposite orders is a deadlock. Nothing in the
-- repository writes `match_predictions` and `league_members` in one transaction
-- today, but "nothing does today" is a weaker guarantee than "this function can
-- only ever hold one of its own locks", and the cost of the stronger one is
-- that a single caller's league join serialises against that same caller's own
-- prediction save. That pair is not a real concurrent workload. Different
-- callers never contend: the key is derived from the caller's id.
--
-- WHAT THIS DOES NOT CLOSE, stated so the register is not overread. `DATA-007`
-- also asks for invalid operations to consume limit (an unmatched invite code
-- fails before any `league_members` insert, so it consumes none), for the
-- expensive read RPCs to be bounded at all, for edge/IP controls beside the
-- per-user database limit, and for alerting. Each is its own change with its
-- own evidence, and the first of them overlaps `SEC-001`. This migration closes
-- the atomicity half only, and the register row says so.
--
-- Under repeatable-read or serializable isolation a waiter's snapshot predates
-- the holder's commit whatever this function does, so the guarantee is stated
-- for read committed — which is what PostgREST uses and what every caller of
-- these triggers runs under.
--
-- No relation, policy, trigger, threshold, grant or rule moves. The thresholds
-- stay at their call sites in the original migration, so `rateLimitParity`
-- continues to compare the same two sides.
--
-- Idempotent.

begin;

create or replace function enforce_rate_limit(p_action text, p_max_per_min int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return; -- no authenticated user (shouldn't happen through the app); skip
  end if;

  -- DATA-007. Taken before the prune, the count and the insert, so this
  -- caller's limit decisions happen one at a time. Transaction-scoped, so it is
  -- released by commit or rollback and never leaks into a pooled connection.
  -- One key per caller, never per action: see the header for why this function
  -- must be incapable of holding two of its own locks at once.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('rate_limit_events:' || v_uid::text, 0)
  );

  delete from rate_limit_events
  where user_id = v_uid and action = p_action and created_at < now() - interval '1 hour';

  select count(*) into v_count
  from rate_limit_events
  where user_id = v_uid and action = p_action and created_at > now() - interval '1 minute';

  if v_count >= p_max_per_min then
    raise exception 'You''re doing that too fast — please wait a moment and try again.'
      using errcode = 'check_violation';
  end if;

  insert into rate_limit_events (user_id, action) values (v_uid, p_action);
end;
$$;

-- `create or replace` preserves the existing access-control list, so this
-- re-states the original migration's boundary rather than restoring it. It is
-- here so that a reader of this file can see the privilege the function holds
-- without having to find the migration that took it away.
revoke all on function enforce_rate_limit(text, int) from public;

commit;
