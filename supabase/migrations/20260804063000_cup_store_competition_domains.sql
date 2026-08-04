-- Contract 79: take the tournament's format out of the shared Cup store.
--
-- C1b generalised the Bonus Games platform into a shared store, and contracts
-- 75–78 made the shared Cup FUNCTIONS competition-agnostic. The tables were
-- already competition-scoped — `bonus_cup_groups`, `bonus_cup_members`,
-- `bonus_cup_fixtures` and `bonus_competition_windows` all key on
-- `competition_id` and reach no tournament relation. What was left is narrower
-- than it looked: two CHECK constraints that encode the TOURNAMENT's format as
-- if it were the platform's.
--
--   bonus_cup_groups.size      check (size in (3, 4))
--   bonus_cup_fixtures.matchday check (matchday between 1 and 3)
--
-- A season group runs to twenty entrants (`CUP_GROUP_CAP`) over a league phase
-- of many rounds, so neither domain can hold. These are FORMAT rules, not
-- integrity rules, and that is the whole argument for widening them: the
-- tournament's correctness does not rest on them. `admin_draw_predictor_cup`
-- computes `v_size := case when g <= v_fours then 4 else 3 end` and writes
-- matchdays one to three itself. Widening the column domain cannot make the
-- tournament wrong, because the tournament never asks the column for
-- permission.
--
-- THE COMPENSATING CONTROL, because a relaxed constraint is still a relaxed
-- constraint: `tests/database-parity/cupStoreDomains.test.ts` pins that the
-- tournament draw still writes only sizes three and four and only matchdays one
-- to three, so the limit stays enforced where it belongs — in the code that
-- owns the tournament format — rather than being lost with the CHECK.
--
-- WHY THIS PASSES THE ADR 0024 FAST LANE. `check-migration-additive.mjs`
-- refuses `drop table/column/schema/type/function/trigger/policy`, `truncate`
-- and `delete from`. A CHECK relaxation is none of those and cannot lose a row:
-- every value that satisfied the old domain satisfies the new one, so the
-- widening is strictly permissive. Nothing is rewritten and no row is touched.
--
-- STAGE IS DELIBERATELY NOT WIDENED. `bonus_cup_fixtures.stage` is still
-- `('group', 'playoff', 'knockout')`, and a season split phase would want its
-- own value. Adding one alone would immediately produce fixtures that
-- `bonus_cup_fixtures_group_shape` rejects — that check requires a non-group
-- stage to carry neither `group_id` nor `matchday`, while split rounds need
-- both. Widening the enum without settling the split's shape would buy a
-- constraint violation rather than a feature, so it waits for the split-execution
-- slice that decides it.

-- ---------------------------------------------------------------------------
-- Group size: the platform's bound, not the tournament's.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_groups
  drop constraint if exists bonus_cup_groups_size_check;

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_size_allowed
  check (size between 3 and 20);

-- ---------------------------------------------------------------------------
-- Matchday: a round number in the competition's own league phase.
--
-- Left unbounded above because the bound is a format decision the format
-- selector owns: twenty entrants over three meetings is fifty-seven rounds, and
-- a number pinned here would be a second, weaker copy of that rule. Zero and
-- negatives stay refused, because a round number below one is never a format.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_fixtures
  drop constraint if exists bonus_cup_fixtures_matchday_check;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_matchday_positive
  check (matchday is null or matchday > 0);

-- ---------------------------------------------------------------------------
-- Prove the end state rather than assuming the drops matched.
--
-- `drop constraint if exists` is silent when the name is wrong, which would
-- leave the old domain in place and this migration reporting success while
-- changing nothing. Contract 67 established this pattern for the same reason.
-- ---------------------------------------------------------------------------

do $$
declare
  v_old_size_domain boolean;
  v_old_matchday_domain boolean;
begin
  select exists (
    select 1
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'bonus_cup_groups'
       and c.contype = 'c'
       and pg_catalog.pg_get_constraintdef(c.oid) like '%ARRAY[3, 4]%'
  ) into v_old_size_domain;

  select exists (
    select 1
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'bonus_cup_fixtures'
       and c.contype = 'c'
       and pg_catalog.pg_get_constraintdef(c.oid) like '%matchday >= 1%'
       and pg_catalog.pg_get_constraintdef(c.oid) like '%matchday <= 3%'
  ) into v_old_matchday_domain;

  if v_old_size_domain then
    raise exception 'the tournament-only group-size domain survived the widening';
  end if;
  if v_old_matchday_domain then
    raise exception 'the tournament-only matchday domain survived the widening';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
     where t.relname = 'bonus_cup_groups'
       and c.conname = 'bonus_cup_groups_size_allowed'
  ) then
    raise exception 'the widened group-size constraint is missing';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
     where t.relname = 'bonus_cup_fixtures'
       and c.conname = 'bonus_cup_fixtures_matchday_positive'
  ) then
    raise exception 'the widened matchday constraint is missing';
  end if;
end;
$$;
