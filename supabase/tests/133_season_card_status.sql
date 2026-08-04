-- Contract 81: where each matchweek card stands, and what the lock did to it.
--
-- These are structural claims, so they are read from the catalogue rather than
-- probed with rows: the tables carry composite foreign keys to `entries` and
-- `competition_rounds` plus the contract-65 season-scope trigger, so an insert
-- built from `gen_random_uuid()` fails on a foreign key long before reaching
-- the CHECK under test. Contract 79's pgTAP records the same reasoning.
--
-- Accept/refuse behaviour was proven directly against a scratch PostgreSQL 16
-- with the real DDL and satisfied foreign keys — 19 probes: `no_submission`
-- refused, `provisional` accepted, a second card for one matchweek refused,
-- `confirmed` without a timestamp refused, `provisional` WITH one refused, a
-- card crossing seasons refused; and on the ledger, a submitted row accepted, a
-- second outcome at the same lock refused, an outcome at a MOVED lock accepted,
-- an unbanked row claiming a submission refused, a submission without its
-- timestamp or provenance refused, a refusal with no reason refused, a
-- whitespace-only reason refused, a real reason accepted, an unknown outcome
-- refused, and UPDATE and DELETE both blocked.

begin;
select plan(12);

select has_table('public', 'season_matchweek_cards', 'the card table exists');
select has_table(
  'public', 'season_matchweek_submission_outcomes', 'the outcome ledger exists');

-- ---------------------------------------------------------------------------
-- The rolling-entry invariant: absence is no-submission, so it must not be a
-- storable status. This is the assertion the whole design rests on.
-- ---------------------------------------------------------------------------

-- Stated as the EXACT constraint text rather than as "no row mentions
-- no_submission". A count of matching constraints is 0 when the table does not
-- exist at all, so the negative form passes on an unmigrated database and
-- protects nothing — contract 79's pgTAP shipped four assertions with that
-- defect and they were removed. Comparing the definition makes the assertion
-- fail with a NULL mismatch instead.
select is(
  (select pg_catalog.pg_get_constraintdef(c.oid)
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
     join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'season_matchweek_cards'
      and c.contype = 'c'
      and c.conname = 'season_matchweek_cards_status_check'),
  'CHECK ((status = ANY (ARRAY[''provisional''::text, ''confirmed''::text])))',
  'the two engaged statuses are the only ones storable — absence is no-submission'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
     join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'season_matchweek_cards'
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%no_submission%'),
  0,
  'and no other constraint smuggles the value back in'
);

-- ---------------------------------------------------------------------------
-- One card per entry per matchweek; one outcome per lock instant.
-- ---------------------------------------------------------------------------

select col_is_unique(
  'public', 'season_matchweek_cards',
  array['tournament_id', 'entry_id', 'competition_round_id'],
  'a card is one row per entry per matchweek, not an event log'
);

select col_is_unique(
  'public', 'season_matchweek_submission_outcomes',
  array['entry_id', 'competition_round_id', 'locks_at'],
  'the lock instant is part of the key, so a rescheduled matchweek reprocesses'
);

-- ---------------------------------------------------------------------------
-- Each outcome carries its own evidence and nothing else.
-- ---------------------------------------------------------------------------

select ok(
  (select bool_or(pg_catalog.pg_get_constraintdef(c.oid) like '%submitted_at IS NOT NULL%')
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'season_matchweek_submission_outcomes' and c.contype = 'c'),
  'a submitted outcome must carry the timestamp it claims'
);

-- The explicit NOT NULL is what keeps this branch two-valued. A CHECK treats
-- NULL as satisfied, so a branch ending in `char_length(btrim(<null>)) between
-- 1 and 500` evaluates to NULL and the row is admitted — a refusal that never
-- says why. The tournament ledger this mirrors has that shape, and a scratch
-- PostgreSQL 16 confirmed it accepts an 'invalid' outcome carrying no failure
-- message. That table is production-hosted and not this contract's to change.
select ok(
  (select bool_or(pg_catalog.pg_get_constraintdef(c.oid) like '%refusal_reason IS NOT NULL%')
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'season_matchweek_submission_outcomes' and c.contype = 'c'),
  'a refused outcome must say why'
);

select ok(
  (select bool_or(pg_catalog.pg_get_constraintdef(c.oid)
                    like '%btrim(refusal_reason)%')
     from pg_catalog.pg_constraint c
     join pg_catalog.pg_class t on t.oid = c.conrelid
    where t.relname = 'season_matchweek_submission_outcomes' and c.contype = 'c'),
  'and must say something, not whitespace'
);

-- ---------------------------------------------------------------------------
-- The ledger is a record, not a working copy. Without this a refusal becomes a
-- submission with no trace, and contract 82 reads the rewrite as truth.
-- ---------------------------------------------------------------------------

select has_trigger(
  'public', 'season_matchweek_submission_outcomes',
  'block_season_matchweek_outcome_mutation',
  'recorded outcomes are append-only, as the tournament ledger''s are'
);

-- ---------------------------------------------------------------------------
-- Neither table is reachable from a browser role.
-- ---------------------------------------------------------------------------

select table_privs_are(
  'public', 'season_matchweek_cards', 'authenticated', array[]::text[],
  'the card table is not readable by authenticated'
);

select table_privs_are(
  'public', 'season_matchweek_submission_outcomes', 'anon', array[]::text[],
  'the outcome ledger is not readable anonymously'
);

select * from finish();
rollback;
