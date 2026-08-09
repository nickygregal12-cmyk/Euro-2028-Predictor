-- Contract 142: SportMonks state 22 is the second half.
--
-- ---------------------------------------------------------------------------
-- MEASURED, NOT LOOKED UP
-- ---------------------------------------------------------------------------
--
-- Contract 135 seeded the status vocabulary only with tokens it could justify,
-- and recorded every unrecognised one instead of guessing. Contract 138 made
-- that record readable. Within an hour of both reaching Development the queue
-- answered a real question: SportMonks token `22`, seen seven times, blocking
-- twelve fixtures.
--
-- What it means was then measured from the retained payloads rather than from
-- provider documentation, and the evidence is unambiguous — the same fixture
-- carries token 22 with a DIFFERENT score at different times:
--
--   Dundee v Aberdeen          14:00 kickoff   1-0 at 15:05   2-0 at 15:45
--   St. Mirren v St. Johnstone 14:00 kickoff   0-0 at 15:25   1-0 at 15:55
--
-- A score cannot change after full time. Token 22 is therefore an IN-PLAY
-- state — SportMonks separates the halves, and contract 135 mapped `2` (first
-- half) while `22` (second half) went unmapped.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FIXES, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- It fixes the live projection. A fixture observed only during its second half
-- was recorded with kind `unknown`, so a surface could not show the score that
-- was actually on the pitch.
--
-- It writes NO result and changes no settlement. `in_play` is not `final`, and
-- the twelve fixtures were never at risk of being settled wrongly — they were
-- correctly refused. Every one of them still settles the ordinary way, when
-- SportMonks reports state 5.
--
-- The near miss is worth recording plainly: had contract 135 guessed that an
-- unmeasured token meant `final`, Dundee v Aberdeen would have been written as
-- 1-0 at 15:05 — a wrong official result, with points awarded on it, later
-- "corrected" to 2-0 by the provider. The fail-closed vocabulary is the reason
-- that did not happen, and this contract is what it was designed to make cheap.

begin;

insert into predictor_internal.provider_status_kinds
  (provider, provider_status, kind, note)
values
  ('sportmonks', '22', 'in_play',
   'second half; measured from retained payloads where the score changed '
   'between observations carrying this token')
on conflict (provider, provider_status) do nothing;

do $$
begin
  if predictor_internal.provider_status_kind('sportmonks', '22') <> 'in_play' then
    raise exception 'SportMonks state 22 must resolve as in play';
  end if;

  -- The guard that matters: this contract must not have made anything final.
  if (select count(*) from predictor_internal.provider_status_kinds
       where provider = 'sportmonks' and kind = 'final') <> 1 then
    raise exception 'SportMonks must still have exactly one measured final status';
  end if;
end;
$$;

commit;
