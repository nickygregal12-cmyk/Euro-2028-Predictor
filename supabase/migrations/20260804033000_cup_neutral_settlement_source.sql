-- Contract 76: the last tournament coupling in the shared Cup machinery.
--
-- Contract 75 split `cup_window_scores`. Tracing the call graph afterwards
-- showed the remaining work was smaller than it looked, because that split
-- CASCADED — `cup_final_group_tables` reaches the tournament only through
-- `cup_window_scores`, so making that neutral made the group table neutral too,
-- with no pass of its own. Checking all four remaining `cup_*` functions for
-- tournament-shaped references (`tournament_id`, `public.matches`,
-- `match_predictions`, `bonus_knockout_predictions`, the 90-minute columns,
-- `round = 'group'`) leaves exactly one:
--
--   cup_final_group_tables  0 — neutral via cup_window_scores (contract 75)
--   cup_seed_group          0 — reads only `bonus_cup_members`, already scoped
--                               by competition
--   cup_bracket_order       0 — pure arithmetic over a bracket size
--   cup_window_settled      1 — `join public.matches` on `result_state`
--
-- So this is the last one, and it takes the same shape as contract 75: the
-- tournament-specific question moves into its own function and the shared
-- decision consumes the answer.
--
-- THE QUESTION BEING MADE NEUTRAL is "has every fixture in this window
-- finished?". The tournament answers it with
-- `result_state in ('confirmed', 'corrected')` — its administrative result
-- lifecycle, where a corrected result is still a settled one. A season answers
-- it from `season_fixtures.status = 'played'`. Those are different vocabularies
-- for the same question, which is exactly what belongs behind a seam.
--
-- WHAT DOES NOT CHANGE. `cup_window_settled` keeps its name, its signature and
-- its ten callers. The lock/settle timing rules stay with it, because they are
-- properties of the Bonus Games window rather than of any competition: a window
-- is settled only once `locks_at` has passed, only once `settles_at` has passed
-- when one is set, and never when it has no fixtures at all. A window row that
-- does not exist still returns null rather than false — callers distinguish
-- "not settled" from "no such window", and collapsing the two would silently
-- settle a window that was never created.
--
-- Note the polarity: the extracted function reports UNSETTLED, so the caller
-- reads `not ...unsettled(...)`. That keeps it a direct substitution for the
-- `not exists (...)` it replaces, rather than inverting a condition in the
-- middle of a four-way conjunction, which is where a sign error would hide.
--
-- Evidence: a differential harness ran the old and new implementations side by
-- side over 400 randomised scenarios — random fixture counts including zero,
-- random result states, null and non-null `locks_at`/`settles_at`, and a
-- missing window row — with zero mismatches, 49 of them exercising the null
-- return. Treating a corrected result as unsettled in the new source made 76 of
-- 100 scenarios diverge, so the harness was not passing vacuously.

-- ---------------------------------------------------------------------------
-- The tournament's answer to "is anything in this window still outstanding?".
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_tournament_window_unsettled(
  p_window_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id
      and m.result_state not in ('confirmed', 'corrected')
  )
$$;

revoke all on function predictor_internal.cup_tournament_window_unsettled(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The shared decision. Window timing only; no competition relation below.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_window_settled(
  p_window_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    win.locks_at is not null and now() >= win.locks_at
    and (win.settles_at is null or now() >= win.settles_at)
    and exists (
      select 1 from public.bonus_window_fixtures f where f.window_id = win.id
    )
    and not predictor_internal.cup_tournament_window_unsettled(win.id)
  from public.bonus_competition_windows win
  where win.id = p_window_id
$$;

revoke all on function predictor_internal.cup_window_settled(uuid)
  from public, anon, authenticated;
