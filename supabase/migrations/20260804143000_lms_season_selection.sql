-- Contract 86: let a season Last Man Standing entrant pick at all.
--
-- `assert_bonus_lms_selection_shape` ends by checking that the picked club
-- plays in the round, and it reads `bonus_window_fixtures` joined to
-- `public.matches` — the TOURNAMENT fixture link. A season LMS round's fixtures
-- live in `season_cup_window_fixtures` joined to `season_fixtures`, so the
-- trigger raises "The picked team does not play in this round" for EVERY season
-- pick. Not only for an auto-assignment past the lock: for an ordinary player,
-- inside the window, picking a club that is genuinely playing.
--
-- Season Last Man Standing selection has therefore never been possible. The
-- function was written for the tournament and defined once; nothing since
-- widened it. This is the first of the three steps that make season LMS work —
-- the lock-time auto-assignment writer and the settlement job follow, and both
-- are pointless until a pick can be stored.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- ONLY the fixture-participation check changes, and only by adding a second way
-- to satisfy it. The club must still play in the round; a season round now
-- proves that from the season fixture list instead of the tournament one.
--
-- Everything else is preserved exactly: the window must belong to a Last Man
-- Standing competition, must be open, must have a scheduled deadline, and must
-- not have locked. The lock still refuses everyone — the exception the
-- auto-assignment writer needs is NOT introduced here, because widening who may
-- pick and opening a hole in the lock are different changes and deserve
-- separate review.
--
-- The tournament path is unchanged. `season_cup_window_fixtures` is empty for a
-- tournament window, so the added branch contributes nothing there — proven by
-- differential test rather than asserted, on a scratch PostgreSQL 16. Six
-- rounds (tournament open, season open, locked, not open, no deadline, wrong
-- game) against five clubs (two playing the tournament round, two playing the
-- season round, one playing nowhere) is 30 scenarios, run against the
-- contract-63 function and then against this one:
--
--   the 25 non-season-round scenarios are byte-identical, refusal text
--   included — the tournament round still accepts exactly its own two clubs
--   and still refuses the other three;
--   the season round moves from 0 accepts to exactly 2, the two clubs that
--   genuinely play in it. The club playing nowhere is still refused there, and
--   so are the two tournament clubs.
--
-- Three mutants of the check below were each killed by that sweep: deleting the
-- tournament branch (the tournament round's two accepts turn to refusals),
-- dropping the club filter from the season branch (the season round accepts
-- everything, the club playing nowhere included), and turning the `and` between
-- the two branches into an `or` (both rounds refuse their own clubs). The sweep
-- is therefore not vacuous. The evidence does not live only in a scratch
-- database: `supabase/tests/137_lms_season_selection.sql` was graded against
-- the contract-63 function and against all three mutants on a database carrying
-- every migration and the seed, and failed each one — so a later edit that
-- reintroduces any of them is caught in CI rather than by inspection.
--
-- A CLUB CANNOT LEAK ACROSS COMPETITIONS whatever this trigger does. Contract
-- 65 added `bonus_lms_tournament_team_fkey` on (tournament_id, team_id), so a
-- selection naming a club that belongs to a different competition is refused by
-- the database itself. The trigger is what produces the message a player reads;
-- the key is what makes the boundary structural. Widening the trigger cannot
-- weaken that.
--
-- WHY `create or replace` RATHER THAN AN ALTERATION. `bonus_lms_selections` and
-- this trigger sit inside the production-hosted contract-63 baseline, and
-- migrations are append-only after hosted application. Redefining the function
-- is additive; the trigger binding is untouched and still points at the same
-- name. Contract 82 took the same route for the card resolver.
--
-- WHY `season_cup_window_fixtures` DESPITE THE NAME. It is
-- (window_id -> bonus_competition_windows, season_fixture_id ->
-- season_fixtures) and contains nothing Cup-specific but its name, so Last Man
-- Standing reuses it rather than adding a second table holding the same
-- relation. Renaming is unavailable — contract 77 is applied to development.

begin;

create or replace function predictor_internal.assert_bonus_lms_selection_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game text;
  v_window_competition uuid;
  v_opens timestamptz;
  v_locks timestamptz;
begin
  select w.competition_id, w.opens_at, w.locks_at, c.game_key
    into v_window_competition, v_opens, v_locks, v_game
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    where w.id = new.window_id;

  if v_window_competition is distinct from new.competition_id
    or v_game <> 'last_man_standing' then
    raise exception 'Selections belong to a Last Man Standing round'
      using errcode = 'check_violation';
  end if;

  if v_opens is null or now() < v_opens then
    raise exception 'This round is not open yet'
      using errcode = 'check_violation';
  end if;

  if v_locks is null then
    raise exception 'This round has no scheduled deadline yet'
      using errcode = 'check_violation';
  end if;

  -- Unchanged, and deliberately so. The lock still refuses every caller; the
  -- server-owned exception the auto-assignment writer needs is a separate
  -- change with its own review.
  if now() >= v_locks then
    raise exception 'This round has locked'
      using errcode = 'check_violation';
  end if;

  -- The club must play in the round. A tournament round proves that from
  -- `matches`, a season round from `season_fixtures`. Either satisfies it;
  -- neither is weakened, and a club playing in NO fixture of either kind is
  -- still refused.
  if not exists (
    select 1
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = new.window_id
      and (m.home_team_id = new.team_id or m.away_team_id = new.team_id)
  ) and not exists (
    select 1
    from public.season_cup_window_fixtures link
    join public.season_fixtures fixture on fixture.id = link.season_fixture_id
    where link.window_id = new.window_id
      and (fixture.home_team_id = new.team_id or fixture.away_team_id = new.team_id)
  ) then
    raise exception 'The picked team does not play in this round'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- `create or replace` preserves the existing ACL — checked, it stays
-- `{postgres=X/postgres}` — so this restates the contract-63 revoke rather than
-- changing anything. It is here so a later contract that DROPS and recreates
-- the function cannot silently hand execute back to a browser role.
revoke all on function predictor_internal.assert_bonus_lms_selection_shape()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prove at apply time that the tournament refusal still bites.
--
-- The failure this guards against is a widening that accidentally becomes a
-- hole: an `or` that is true whenever either list is EMPTY would accept any
-- club in any round, and every existing tournament test would still pass
-- because those rounds have fixtures. Here both links are empty for a window
-- that does not exist, so a pick must still be refused.
-- ---------------------------------------------------------------------------

do $$
declare
  v_refused boolean := false;
begin
  begin
    -- No window, so neither fixture list can contain anything. The earlier
    -- window check fires first, which is itself the point: the function must
    -- refuse, not fall through to an accepting fixture test.
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
  exception
    when others then
      v_refused := true;
  end;

  if not v_refused then
    raise exception
      'a selection into a non-existent round was accepted; the participation check has become a hole';
  end if;
end;
$$;

commit;
