-- Euro 2028 Predictor — fix the result-recompute trigger's firing on re-writes
--
-- Follow-up to 20260720130000_add_scoring.sql; append-only.
--
-- Bug: recompute_scores_on_result fires on UPDATE OF home_score/away_score, but
-- trg_recompute_on_result early-returned when the new score values were NOT
-- DISTINCT FROM the old ones. That "same value → skip" optimisation broke the
-- dev seed's write path: the seed produces deterministic results, so on a re-run
-- it re-writes the SAME scores after wiping and recreating every entry — the
-- trigger fired but skipped the recompute, leaving the fresh entries unscored
-- (score_events stayed empty until a manual recompute_all_scores()).
--
-- Fix: recompute whenever a score column is written. The trigger's `UPDATE OF
-- home_score, away_score` clause already scopes firing to score writes, and
-- recompute_tournament_scores is delete-and-rederive (idempotent), so an
-- occasional redundant recompute is harmless — correctness beats the micro-opt.
--
-- Also grant EXECUTE on the recompute functions to service_role, so trusted
-- server-side tooling (the dev seed) can invoke an explicit recompute as
-- belt-and-braces. (Client roles still cannot — no grant to authenticated/anon.)

begin;

create or replace function trg_recompute_on_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recompute on every score write. We deliberately do NOT skip "same value"
  -- writes: the dev seed re-writes identical results after recreating all
  -- entries, and skipping would leave those entries unscored. Delete-and-rederive
  -- is idempotent, so a redundant recompute only costs a little work.
  perform recompute_tournament_scores(new.tournament_id);
  return new;
end;
$$;

grant execute on function recompute_tournament_scores(uuid) to service_role;
grant execute on function recompute_all_scores() to service_role;

commit;
