-- Euro 2028 Predictor — last-seen snapshot for Home's catch-up line
--
-- Follow-up migration; append-only.
--
-- Home's catch-up line ("Since you were last here: +N pts") needs to know the
-- user's state at their previous visit. We snapshot it on `profiles`:
--   * last_seen_at     — when they last opened Home
--   * last_seen_points  — their total points at that moment
--
-- Points delta = current total − last_seen_points. (This is deliberately a
-- stored snapshot, not "score_events since a timestamp": the recompute is
-- delete-and-rederive, so every score_event shares the last recompute's
-- created_at — a timestamp filter would be all-or-nothing. A snapshot is
-- robust.) The rank delta ("up N places") waits for rank_history (Phase 2/3
-- boundary roadmap item) and is not built here.
--
-- No new RLS: the existing "own profile" policy already lets a user read and
-- update their own row, which is all Home needs. Both columns are nullable — a
-- first visit has no snapshot, so the catch-up line stays hidden.
--
-- Idempotent (add column if not exists).

begin;

alter table profiles add column if not exists last_seen_at    timestamptz;
alter table profiles add column if not exists last_seen_points int;

commit;
