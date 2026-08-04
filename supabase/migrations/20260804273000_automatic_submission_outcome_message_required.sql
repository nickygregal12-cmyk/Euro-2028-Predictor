-- ---------------------------------------------------------------------------
-- Contract 99 — an `invalid` automatic-submission outcome must say why.
--
-- ADR 0025 decision 3. This is the three-valued-logic hole recorded at contract
-- 81 and left in place because the table is production-hosted; the owner's
-- decision on 4 August 2026 is to correct it now, with production promotion
-- separately controlled as it already is for every contract from 64 onward.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT
-- ---------------------------------------------------------------------------
--
-- `entry_automatic_submission_outcomes` records what the lock-time automatic
-- submission job did to each entry. It is immutable — a trigger refuses UPDATE
-- and DELETE outright — so it is the audit trail for a write no human made.
--
-- Its CHECK intends that a refusal explains itself. The refusal branch reads:
--
--     outcome = 'invalid'
--     and submitted_at is null
--     and failure_code is not null
--     and char_length(btrim(failure_message)) between 1 and 500
--
-- With `failure_message` NULL, `btrim(null)` is NULL, `char_length(null)` is
-- NULL, and `null between 1 and 500` is NULL. **A CHECK rejects only FALSE.**
-- NULL satisfies it. So the constraint that exists to guarantee every refusal
-- carries a reason accepts a refusal carrying no reason at all — and because
-- the row is immutable, such a row could never afterwards be corrected.
--
-- The `between` looks like it covers the null case. It is the reason nobody
-- reading this constraint noticed, and it is why the fix is an explicit
-- `is not null` rather than a tighter bound.
--
-- ---------------------------------------------------------------------------
-- THE PRE-VALIDATION AUDIT — a precondition, not a formality
-- ---------------------------------------------------------------------------
--
-- ADR 0025 requires an audit before the replacement is validated, because an
-- immutable audit row must never be silently rewritten to make a constraint
-- pass. If rows in the hole existed they were to be preserved as known
-- historical exceptions and remediated by an explicit decision.
--
-- The audit ran read-only on 4 August 2026 against both hosted projects:
--
--   development iouzoutneyjpugbbtdem : 0 rows, of any outcome
--   production  vkfnsqdyhvtwyqkisxhk : 0 rows, of any outcome
--
-- Neither project holds a single row, so no exception exists, nothing needs
-- preserving, and the corrected constraint goes in **fully validated** rather
-- than NOT VALID. If that ever stops being true before promotion, this
-- migration will fail loudly on the offending rows, which is the correct
-- outcome — it must not be softened to NOT VALID to get it through.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- The `submitted` branch is untouched. `failure_code`'s own `is not null` was
-- already correct and stays. The 1–500 bound is unchanged. No column, outcome
-- value, index, grant or trigger moves: ADR 0025 says this stays a narrow
-- correction and does not become a wider outcome-schema change.
--
-- The constraint is also **renamed**. It was declared inline, so PostgreSQL
-- generated `entry_automatic_submission_outcomes_check` — a name that says
-- nothing about what it guarantees, which is part of why a defect inside it
-- went unread for two contracts. The replacement is named for its job.
--
-- Dropping a constraint is a structural change, so the ADR 0024 rollout gate
-- will emit its `structural` line naming `drop constraint` rather than passing
-- this in silence. That is expected here, exactly as it was at contract 87.
-- ---------------------------------------------------------------------------

begin;

alter table public.entry_automatic_submission_outcomes
  drop constraint entry_automatic_submission_outcomes_check;

alter table public.entry_automatic_submission_outcomes
  add constraint entry_automatic_submission_outcomes_outcome_shape
  check (
    (
      outcome = 'submitted'
      and submitted_at is not null
      and failure_code is null
      and failure_message is null
    )
    or
    (
      outcome = 'invalid'
      and submitted_at is null
      and failure_code is not null
      -- The whole point of this contract. Without it `char_length(btrim(null))`
      -- is NULL, the branch evaluates to NULL, and the CHECK is satisfied.
      and failure_message is not null
      and char_length(btrim(failure_message)) between 1 and 500
    )
  );

commit;
