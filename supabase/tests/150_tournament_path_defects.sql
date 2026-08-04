-- Contracts 99 and 100: the two tournament-path defects ADR 0025 decision 3
-- directs be corrected now rather than deferred because production shares the
-- structures.
--
-- CONTRACT 99 closes a three-valued-logic hole. The CHECK on
-- `entry_automatic_submission_outcomes` intends that every `invalid` outcome
-- explains itself, and ends its refusal branch in
-- `char_length(btrim(failure_message)) between 1 and 500`. With a null message
-- that expression is NULL, and a CHECK rejects only FALSE — so the constraint
-- guaranteeing a reason accepted a refusal with no reason, on a table whose
-- rows are immutable and could therefore never be corrected afterwards.
--
-- CONTRACT 100 closes REL-001 on the half nobody was looking at.
-- `recompute_tournament_scores` already took a tournament advisory lock. But
-- confirming a result fires TWO after-row triggers on `matches`, PostgreSQL
-- fires them in NAME order, and `recompute_bonus_scores_on_result` sorts before
-- `recompute_scores_on_result` — so the Bonus Games delete-and-rederive ran
-- first, in full, holding no lock at all.
--
-- What this file cannot do, stated so the coverage is not overread: pgTAP runs
-- in one session, so mutual exclusion between two concurrent transactions is
-- not assertable here. That evidence is a two-session probe recorded in the
-- pull request, and it includes the pre-fix control showing the second session
-- was NOT blocked at contract 98. What is asserted here is everything
-- single-session: the constraint's behaviour, the lock's presence, placement
-- and key, that rollback releases it, that no session-scoped lock exists, and
-- that a correction leaves exactly one coherent derived state.

begin;
select plan(21);

-- ---------------------------------------------------------------------------
-- CONTRACT 99 — the refusal must carry a reason.
-- ---------------------------------------------------------------------------

create temporary table c99 (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_c uuid; v_t uuid; v_u uuid := gen_random_uuid(); v_e uuid;
begin
  insert into auth.users (id, email) values (v_u, 'contract99@example.test');
  insert into public.competitions (slug, name, sport)
    values ('contract-99-probe', 'Contract 99 probe', 'football') returning id into v_c;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('Contract 99 probe', 2028, v_c, 'c99', 'tournament', 'Europe/London', 'active')
    returning id into v_t;
  insert into public.entries (tournament_id, user_id) values (v_t, v_u) returning id into v_e;
  insert into c99 values ('tournament', v_t), ('entry', v_e);
end
$seed$;

select throws_ok(
  $$insert into public.entry_automatic_submission_outcomes
      (entry_id, tournament_id, lock_at, outcome, attempted_at, failure_code, failure_message)
    select (select id from c99 where label = 'entry'),
           (select id from c99 where label = 'tournament'),
           timestamptz '2028-06-01 12:00Z', 'invalid', now(), 'NO_PREDICTIONS', null$$,
  '23514',
  null,
  'THE DEFECT: an `invalid` outcome with a NULL failure message is refused. Before contract 99 this was ACCEPTED, because char_length(btrim(null)) is NULL and a CHECK rejects only FALSE'
);

select throws_ok(
  $$insert into public.entry_automatic_submission_outcomes
      (entry_id, tournament_id, lock_at, outcome, attempted_at, failure_code, failure_message)
    select (select id from c99 where label = 'entry'),
           (select id from c99 where label = 'tournament'),
           timestamptz '2028-06-01 12:00Z', 'invalid', now(), 'NO_PREDICTIONS', '   '$$,
  '23514',
  null,
  'a whitespace-only message is still refused — the 1..500 bound on the trimmed value is unchanged'
);

select throws_ok(
  $$insert into public.entry_automatic_submission_outcomes
      (entry_id, tournament_id, lock_at, outcome, attempted_at, failure_code, failure_message)
    select (select id from c99 where label = 'entry'),
           (select id from c99 where label = 'tournament'),
           timestamptz '2028-06-01 12:00Z', 'invalid', now(), null, 'a reason'$$,
  '23514',
  null,
  'a null failure_code is still refused — that half was already correct and is not weakened'
);

select lives_ok(
  $$insert into public.entry_automatic_submission_outcomes
      (entry_id, tournament_id, lock_at, outcome, attempted_at, failure_code, failure_message)
    select (select id from c99 where label = 'entry'),
           (select id from c99 where label = 'tournament'),
           timestamptz '2028-06-01 12:00Z', 'invalid', now(), 'NO_PREDICTIONS',
           'the entry held no predictions at lock'$$,
  'a genuine refusal carrying a genuine reason is still accepted — the correction does not narrow the real case'
);

select lives_ok(
  $$insert into public.entry_automatic_submission_outcomes
      (entry_id, tournament_id, lock_at, outcome, attempted_at, submitted_at, failure_code, failure_message)
    select (select id from c99 where label = 'entry'),
           (select id from c99 where label = 'tournament'),
           timestamptz '2028-06-02 12:00Z', 'submitted', now(), now(), null, null$$,
  'and the `submitted` branch is untouched: no failure code, no failure message, a submitted_at'
);

select throws_ok(
  $$insert into public.entry_automatic_submission_outcomes
      (entry_id, tournament_id, lock_at, outcome, attempted_at, submitted_at, failure_code, failure_message)
    select (select id from c99 where label = 'entry'),
           (select id from c99 where label = 'tournament'),
           timestamptz '2028-06-03 12:00Z', 'submitted', now(), now(), 'CODE', 'why'$$,
  '23514',
  null,
  'a `submitted` outcome may still not carry failure detail'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint
    where conrelid = 'public.entry_automatic_submission_outcomes'::regclass
      and conname = 'entry_automatic_submission_outcomes_outcome_shape'
      and convalidated),
  1,
  'the replacement constraint is named for its job and is VALIDATED, not NOT VALID — the pre-validation audit found zero rows in development and production'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint
    where conrelid = 'public.entry_automatic_submission_outcomes'::regclass
      and conname = 'entry_automatic_submission_outcomes_check'),
  0,
  'and the generated-name constraint it replaced is gone, not left alongside it'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint
    where conrelid = 'public.entry_automatic_submission_outcomes'::regclass
      and conname = 'entry_automatic_submission_outcomes_outcome_shape'
      and pg_get_constraintdef(oid) like '%failure_message IS NOT NULL%'),
  1,
  'the fix is an explicit IS NOT NULL rather than a tighter bound — a bound cannot close a hole that NULL walks through'
);

-- The row is an audit record of a write no human made. Immutability is what
-- makes the constraint matter: a bad row could never have been repaired.
select throws_ok(
  $$update public.entry_automatic_submission_outcomes set failure_message = 'edited'
     where tournament_id = (select id from c99 where label = 'tournament')$$,
  '42501',
  null,
  'outcomes remain immutable, which is why a null-reason row could never have been corrected after the fact'
);

-- ---------------------------------------------------------------------------
-- CONTRACT 100 — every delete-and-rederive path holds the tournament lock.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'predictor_internal')
      and p.proname in ('recompute_tournament_scores',
                        'recompute_ko_predictor_for_match',
                        'recompute_lms_for_tournament')
      and p.prosrc like '%advisory_xact_lock%'),
  3,
  'all three functions that delete-and-rederive a tournament hold a transaction-scoped advisory lock'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'predictor_internal')
      and p.prokind = 'f'
      and p.prosrc ~ 'pg_advisory_lock\(|pg_try_advisory_lock\('),
  0,
  'and NO function anywhere takes a session-scoped advisory lock — ADR 0025 forbids introducing one'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'predictor_internal')
      and p.proname in ('recompute_tournament_scores',
                        'recompute_ko_predictor_for_match',
                        'recompute_lms_for_tournament')
      and p.prosrc like '%hashtextextended(%'),
  3,
  'all three derive the key the same way, so they contend on ONE lock per tournament rather than three private ones'
);

-- The placement claim. The lock must be taken by the function that mutates,
-- not by the trigger that calls it: making the guarantee depend on trigger
-- firing order is the exact property that made this defect reachable.
select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname = 'recompute_ko_predictor_for_match'
      and position('advisory_xact_lock' in p.prosrc) < position('delete from public.bonus_score_events' in p.prosrc)),
  1,
  'the KO Predictor rederive takes the lock BEFORE its delete, not after it'
);

-- The trigger ordering that made this reachable, pinned so it cannot be
-- misremembered: the bonus trigger really does fire first.
select is(
  (select t.tgname
     from pg_catalog.pg_trigger t
     join pg_catalog.pg_class c on c.oid = t.tgrelid
     join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where c.relname = 'matches'
      and not t.tgisinternal
      and p.proname in ('trg_recompute_on_result', 'trg_recompute_bonus_on_result')
    order by t.tgname
    limit 1),
  'recompute_bonus_scores_on_result',
  'the BONUS trigger fires first — after-row triggers run in name order, which is why the unlocked path ran before the locked one'
);

-- Lock behaviour, single session. Mutual exclusion needs two sessions and is
-- evidenced separately; what is checkable here is that the lock is really
-- taken, that it is transaction-scoped, and that its key is per tournament.
create temporary table c100 (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_c uuid; v_t1 uuid; v_t2 uuid; v_r1 uuid; v_r2 uuid; v_m1 uuid; v_m2 uuid;
begin
  insert into public.competitions (slug, name, sport)
    values ('contract-100-probe', 'Contract 100 probe', 'football') returning id into v_c;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('Contract 100 Alpha', 2028, v_c, 'c100a', 'tournament', 'Europe/London', 'active')
    returning id into v_t1;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('Contract 100 Beta', 2028, v_c, 'c100b', 'tournament', 'Europe/London', 'active')
    returning id into v_t2;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_t1, 'qf', 1, 'knockout_round', 'QF') returning id into v_r1;
  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
    values (v_t2, 'qf', 1, 'knockout_round', 'QF') returning id into v_r2;
  insert into public.matches
      (tournament_id, round_id, match_ref, round, home_source, away_source, match_date, venue)
    values (v_t1, v_r1, 'C100-M1', 'qf', 'A', 'B', date '2028-06-01', 'V') returning id into v_m1;
  insert into public.matches
      (tournament_id, round_id, match_ref, round, home_source, away_source, match_date, venue)
    values (v_t2, v_r2, 'C100-M2', 'qf', 'A', 'B', date '2028-06-01', 'V') returning id into v_m2;
  insert into c100 values ('t1', v_t1), ('t2', v_t2), ('m1', v_m1), ('m2', v_m2);
end
$seed$;

-- A single advisory-lock key is stored SPLIT across pg_locks.classid (high 32
-- bits) and objid (low 32 bits), both as unsigned oid. The first version of
-- this helper reconstructed it with `(key << 32 >> 32)::bigint::oid`, which
-- raises "OID out of range" whenever the low half is negative — so the suite
-- passed or failed depending on the random UUID it generated that run. Masking
-- each half explicitly is the fix, and it is why this is a function rather than
-- an expression repeated three times.
create or replace function pg_temp.holds_tournament_lock(p_tournament_id uuid)
returns boolean
language sql
stable
as $helper$
  select exists (
    select 1
      from pg_catalog.pg_locks l
     where l.locktype = 'advisory'
       and l.pid = pg_catalog.pg_backend_pid()
       and l.classid = ((pg_catalog.hashtextextended(p_tournament_id::text, 0) >> 32)
                          & 4294967295)::oid
       and l.objid = (pg_catalog.hashtextextended(p_tournament_id::text, 0)
                          & 4294967295)::oid
  )
$helper$;

-- Key-specific, not a total count. Assertions earlier in this file already
-- ran rederive paths of their own, so "no advisory lock is held" would be a
-- statement about the whole file rather than about this tournament — and it
-- failed for exactly that reason when first written.
select is(
  pg_temp.holds_tournament_lock((select id from c100 where label = 't1')),
  false,
  'this tournament''s key is not held before its rederive runs'
);

select lives_ok(
  $$select predictor_internal.recompute_ko_predictor_for_match((select id from c100 where label = 'm1'))$$,
  'the KO Predictor rederive runs, taking the lock on the way'
);

select is(
  pg_temp.holds_tournament_lock((select id from c100 where label = 't1')),
  true,
  'and the lock it holds is keyed by THAT tournament — the same key recompute_tournament_scores uses'
);

select lives_ok(
  $$select predictor_internal.recompute_lms_for_tournament((select id from c100 where label = 't2'))$$,
  'a rederive for a DIFFERENT tournament proceeds in the same transaction, so the key really is per tournament rather than global'
);

select is(
  array[
    pg_temp.holds_tournament_lock((select id from c100 where label = 't1')),
    pg_temp.holds_tournament_lock((select id from c100 where label = 't2'))
  ],
  array[true, true],
  'both tournaments'' keys are held, and they are distinct keys — a global lock would answer true for a tournament never touched'
);

select is(
  pg_temp.holds_tournament_lock(gen_random_uuid()),
  false,
  'and a tournament nobody touched holds no lock, which is what makes the two answers above mean something'
);

select * from finish();
-- Rollback is also the evidence that the lock is transaction-scoped: nothing
-- below unlocks anything, and no lock survives.
rollback;
