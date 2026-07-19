-- Euro 2028 Predictor — add the joker flag to match_predictions (scoring §1)
--
-- Follow-up to 20260719120000_init_v0_1.sql (which has already been applied).
-- A joker doubles a single group match's points (exact 5→10, correct 3→6,
-- wrong 0→0) and nothing else. One joker per match is already guaranteed by
-- match_predictions' unique (entry_id, match_id). The other two joker rules are
-- NOT expressible as simple column constraints and MUST be enforced in a
-- server-side function (Postgres function / RLS), never trusted to the client:
--   * max 5 jokers per entry (a cross-row aggregate: count(joker) per entry ≤ 5);
--   * the kickoff-commitment lock — a joker may only be set/moved while its
--     match has not kicked off, and freezes at that match's kickoff (this is
--     time-based and distinct from the opening-match score lock).
--
-- Idempotent (if not exists), so re-running is harmless.

alter table match_predictions
  add column if not exists joker boolean not null default false;
