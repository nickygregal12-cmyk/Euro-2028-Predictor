-- Contract 67: give the league-season games the lock scope the engine can act on.
--
-- Contract 66 seeded `main_predictor` and `last_man_standing` with
-- `lock_scope = 'round'`. The shared lock engine in
-- `src/domain/competition/game.ts` treats 'round' and 'matchweek' as different
-- things, and only 'matchweek' drives a league season:
--
--   expectedLockScopeCount():
--     case 'matchweek' -> one lock per matchweek, for a league_season
--     case 'round'     -> null, "No current game locks by knockout round
--                         through this engine"
--
-- A null there reaches `context.ts`, which treats it as failed validation and
-- substitutes FAIL_CLOSED_LOCK_POLICY — "no data ever unlocks under it". So the
-- moment anything reads `lock_scope` and hands it to the engine, the domestic
-- Main Predictor and Last Man Standing would be permanently locked: every
-- matchweek closed, forever, with no error to explain it.
--
-- Nothing reads `lock_scope` yet, so nothing is broken today, and the failure
-- direction was the safe one. But season persistence is precisely the work that
-- makes it live, so the two authorities are reconciled before anything is built
-- on top of them.
--
-- The SQL side moves rather than the TypeScript side because the engine's
-- distinction is deliberate and worth keeping: 'round' means a knockout round,
-- and returning null for it is correct — no game locks that way through this
-- engine. Collapsing 'round' and 'matchweek' into synonyms would erase a
-- distinction the season Cup and knockout formats still need.
--
-- Data effect: none. Two catalogue rows change one text column. No entry,
-- membership, prediction, score or standing is touched, and no lock scope rows
-- exist yet to reinterpret.

-- ---------------------------------------------------------------------------
-- Widen the permitted scopes, then move the two league-season games onto
-- 'matchweek'. The constraint is widened first so the update cannot transiently
-- violate it.
-- ---------------------------------------------------------------------------

alter table public.game_definitions
  drop constraint game_definitions_lock_scope_allowed;

alter table public.game_definitions
  add constraint game_definitions_lock_scope_allowed
    check (lock_scope in ('entry', 'round', 'matchweek', 'match'));

update public.game_definitions
   set lock_scope = 'matchweek'
 where game_key in ('main_predictor', 'last_man_standing');

-- ---------------------------------------------------------------------------
-- Prove the intended state actually holds, in the same transaction that set it.
--
-- An `update ... where game_key in (...)` silently affects zero rows if a key
-- is ever renamed, which would leave the catalogue on the fail-closed scope
-- while this migration reported success.
-- ---------------------------------------------------------------------------

do $$
declare
  v_wrong integer;
begin
  select count(*)
    into v_wrong
    from public.game_definitions
   where game_key in ('main_predictor', 'last_man_standing')
     and lock_scope is distinct from 'matchweek';

  if v_wrong <> 0 then
    raise exception
      'Expected main_predictor and last_man_standing on the matchweek lock scope, % row(s) are not',
      v_wrong;
  end if;

  -- Both league-season games must exist; a missing row is the rename case.
  if (
    select count(*)
      from public.game_definitions
     where game_key in ('main_predictor', 'last_man_standing')
  ) <> 2 then
    raise exception 'Expected exactly two league-season game definitions';
  end if;

  -- The tournament games keep the scopes contract 66 gave them. This migration
  -- is not a licence to restate the whole catalogue.
  if (
    select lock_scope
      from public.game_definitions
     where game_key = 'original_predictor'
  ) is distinct from 'entry' then
    raise exception 'original_predictor must remain on the entry lock scope';
  end if;

  if (
    select lock_scope
      from public.game_definitions
     where game_key = 'ko_predictor'
  ) is distinct from 'match' then
    raise exception 'ko_predictor must remain on the match lock scope';
  end if;
end;
$$;
