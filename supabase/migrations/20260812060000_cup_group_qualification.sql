-- ---------------------------------------------------------------------------
-- Contract 184 — a season Championship group of any permitted size can qualify
-- somebody.
--
-- `CUP-001`, authorised by [ADR 0028](../../docs/adr/0028-owner-decisions-unblocking-product-work.md)
-- § 6 on 12 August 2026: the implementation session may define "a consistent and
-- fair automatic-qualification plus wildcard table for every group size from 5
-- through 20", reconciling ADR 0014's field sizes with the wildcard and seeding
-- rules. The ADR deliberately did not invent the numbers, and it required them
-- to be written into the Championship rule authority and reviewed by tests
-- before code treats them as gameplay truth. **They are in
-- `docs/predictor-cup-rules.md` § 6.2, and this migration reads that rule
-- rather than being it.**
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED IN THE COMMITTED TEXT
-- ---------------------------------------------------------------------------
--
-- `public.admin_finalise_predictor_cup_groups` already implements § 6.1's
-- target, § 6.3's cross-group wildcard order and § 7.1's seeding bands, and all
-- three GENERALISE correctly — § 6.3 already divides table points by
-- `group_size - 1`, which is the per-game normalisation a group of twenty needs.
--
-- Exactly two expressions do not:
--
--   * `when gate.group_rank = 2 and gate.group_size = 4 then 'runner_up'`
--   * `where (gate.group_size = 4 and gate.group_rank = 3)
--        or (gate.group_size = 3 and gate.group_rank = 2)`
--
-- So in a group of 5 to 20 — which `bonus_cup_groups_size_allowed` permits and
-- contract 166's multi-group draw actually creates — **only the group winner
-- qualifies automatically and nobody at all is wildcard-eligible.** A hundred
-- entrant Championship drawn as five groups of twenty would qualify five
-- players against a § 6.1 target of sixty-seven, and the shortfall would appear
-- as an undersized bracket rather than as an error.
--
-- ---------------------------------------------------------------------------
-- THE RULE, AND WHY IT IS ARITHMETIC RATHER THAN A TABLE
-- ---------------------------------------------------------------------------
--
--   automatic places  = floor(N / 2)      the top half, rounded down
--   qualifying limit  = ceil(2N / 3)      § 6.1's two-thirds line, per group
--   wildcard pool     = the ranks between them
--
-- **It reproduces the tournament's own two rows exactly**, and that is the
-- whole justification for choosing this shape over any other: `floor(3/2) = 1`
-- and `floor(4/2) = 2` are § 6.2's automatic places, `ceil(6/3) = 2` and
-- `ceil(8/3) = 3` are its wildcard ranks. It is an EXTENSION of the accepted
-- rule rather than a replacement, so the tournament path cannot change
-- behaviour — asserted, rather than argued, in `233_cup_group_qualification.sql`
-- for both sizes.
--
-- Two properties make it safe at every size, and both are asserted for 3 to 20
-- rather than reasoned about once:
--
--   * `floor(N/2) <= ceil(2N/3)`, so automatic places never overshoot the
--     two-thirds line and the target is always reachable;
--   * `ceil(2N/3) < N` for every N >= 3, so at every permitted size at least
--     one entrant cannot qualify — which is what makes it a group stage.
--
-- A group of 1 or 2 is arithmetically degenerate (`ceil(2N/3) = N`, nobody
-- eliminated) and is left that way deliberately rather than special-cased:
-- `bonus_cup_groups_size_allowed` admits 3 to 20 for an initial group stage,
-- and a split half of two never reaches qualification because
-- `bonus_cup_members_split_metadata_empty` forbids a split member from carrying
-- `qualified_as` at all.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- **It does not make a season group stage finishable.**
-- `admin_finalise_predictor_cup_groups` still gates on `win.sequence between 1
-- and 3` being settled — the tournament's three matchdays — and a season group
-- stage runs to thirty-eight. That gate is `CUP-002`'s to move, together with
-- creating the knockout windows a season has none of, and moving it here would
-- let a season finalise qualification a third of the way through its own group
-- stage. **This contract makes the qualification RULE correct at every size;
-- `CUP-002` is what lets it run.**
--
-- It creates no driver, writes no bracket, adds no relation and grants nothing
-- new. It moves no scoring value: the tie-break order, the § 6.1 target and the
-- § 7.1 bands are untouched, and the three `qualified_as` labels are unchanged
-- because `bonus_cup_members_qualified_as_check` admits exactly those three.
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- 1. The rule, as two pure functions.
-- ===========================================================================
--
-- `immutable` because they are arithmetic on one integer: the planner may fold
-- them, and a rule that could return different answers for the same group size
-- in one statement would be worse than no rule.

create or replace function predictor_internal.cup_group_automatic_places(
  p_group_size integer
)
returns integer
language sql
immutable
set search_path = ''
as $auto$
  -- The top half, rounded down. `greatest(1, ...)` only bites at sizes 1 and 2,
  -- which an initial group stage cannot hold; without it a group of 1 would
  -- qualify nobody, and a group winner always qualifies.
  select greatest(1, (coalesce(p_group_size, 0) / 2))::integer;
$auto$;

comment on function predictor_internal.cup_group_automatic_places(integer) is
  'Contract 184 / CUP-001. docs/predictor-cup-rules.md section 6.2: the number '
  'of automatic qualifying places in a group of N, floor(N/2). Reproduces the '
  'tournament''s own values at N=3 (1) and N=4 (2).';

create or replace function predictor_internal.cup_group_qualifying_limit(
  p_group_size integer
)
returns integer
language sql
immutable
set search_path = ''
as $limit$
  -- Section 6.1's two-thirds line taken per group and rounded UP, which is what
  -- makes the pool always big enough to reach the target. Integer arithmetic
  -- rather than ceil() on a float, so the value cannot depend on rounding mode.
  select least(
           greatest(1, ((2 * coalesce(p_group_size, 0)) + 2) / 3),
           greatest(1, coalesce(p_group_size, 0))
         )::integer;
$limit$;

comment on function predictor_internal.cup_group_qualifying_limit(integer) is
  'Contract 184 / CUP-001. docs/predictor-cup-rules.md section 6.2: the lowest '
  'rank in a group of N that may still qualify, ceil(2N/3). Ranks above the '
  'automatic places and up to this limit are the wildcard pool. Reproduces the '
  'tournament''s own values at N=3 (2) and N=4 (3).';

revoke all on function predictor_internal.cup_group_automatic_places(integer)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_group_qualifying_limit(integer)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. The rule proves itself before anything reads it.
-- ===========================================================================
--
-- Driven over every size the schema permits, at install time, because a rule
-- that is wrong at one size in the middle of the range is exactly what a
-- hand-written table produces and exactly what nobody checks.

do $$
declare
  n integer;
  v_auto integer;
  v_limit integer;
begin
  for n in 3..20 loop
    v_auto := predictor_internal.cup_group_automatic_places(n);
    v_limit := predictor_internal.cup_group_qualifying_limit(n);

    if v_auto <> n / 2 then
      raise exception 'CUP-001: automatic places for a group of % must be floor(N/2)', n;
    end if;

    if v_auto > v_limit then
      raise exception
        'CUP-001: a group of % would qualify % automatically past a limit of %, '
        'so automatic places would overshoot the section 6.1 target', n, v_auto, v_limit;
    end if;

    if v_limit >= n then
      raise exception
        'CUP-001: a group of % would eliminate nobody, which is not a group stage', n;
    end if;

    if v_auto < 1 then
      raise exception 'CUP-001: a group winner must always qualify (size %)', n;
    end if;
  end loop;

  -- THE ASSERTION THAT MATTERS MOST: the tournament's accepted rows are
  -- reproduced, so this is an extension rather than a replacement and the
  -- tournament path cannot have changed behaviour.
  if predictor_internal.cup_group_automatic_places(3) <> 1
     or predictor_internal.cup_group_qualifying_limit(3) <> 2
     or predictor_internal.cup_group_automatic_places(4) <> 2
     or predictor_internal.cup_group_qualifying_limit(4) <> 3 then
    raise exception
      'CUP-001: the general rule must reproduce section 6.2''s original 3- and '
      '4-player rows exactly, or it is a replacement rather than an extension';
  end if;
end;
$$;

-- ===========================================================================
-- 3. The driver reads the rule.
-- ===========================================================================
--
-- PATCHED IN PLACE FROM THE INSTALLED DEFINITION, WHICH IS CONTRACT 60'S OWN
-- IDIOM AND IS USED HERE FOR THE REASON CONTRACT 60 ESTABLISHED IT.
--
-- **No migration holds this function's current text.** Contract 47 wrote it;
-- contract 60 then rewrote it by reading `pg_get_functiondef`, string-replacing
-- its `pg_temp` block and re-executing the result, because hosted lint could
-- not resolve a temporary relation. So the live definition is contract 47's
-- text transformed by contract 60's replacements, and it exists nowhere on
-- disk.
--
-- **The first draft of this contract copied contract 47's migration text
-- instead, and that was wrong in two ways at once**: it was 97 lines short of
-- the real function, and — worse, because it would have installed silently —
-- it would have REVERTED contract 60 entirely, reinstating the `pg_temp` block
-- that hosted lint rejects and restoring the grants contract 60 changed.
-- `114_predictor_cup_lint_safe_qualification.sql` caught it: seven of its eight
-- assertions failed at once. Copying the wrong baseline is not a subtler
-- mistake than copying a baseline wrongly; it is the same mistake with a
-- larger blast radius.
--
-- Patching the INSTALLED definition cannot make either error. It also cannot
-- silently drop a grant, because `create or replace function` preserves them.
--
-- THE ROUND TRIP IS THE PROOF. After the two replacements, reversing them must
-- reproduce the original definition byte for byte. That is stronger than a
-- line-by-line diff of two files: it proves that the ONLY regions that changed
-- are the two this contract names, without needing to enumerate what did not.

do $patch$
declare
  v_before text;
  v_after text;
  v_roundtrip text;
  v_old_automatic constant text :=
    E'          when gate.group_rank = 2 and gate.group_size = 4 then ''runner_up''\n';
  v_new_automatic constant text :=
    E'          when gate.group_rank <= predictor_internal.cup_group_automatic_places(gate.group_size) then ''runner_up''\n';
  v_old_wildcard constant text :=
    E'      where (gate.group_size = 4 and gate.group_rank = 3)\n        or (gate.group_size = 3 and gate.group_rank = 2)\n';
  v_new_wildcard constant text :=
    E'      where gate.group_rank > predictor_internal.cup_group_automatic_places(gate.group_size)\n        and gate.group_rank <= predictor_internal.cup_group_qualifying_limit(gate.group_size)\n';
begin
  select pg_catalog.pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_before;

  -- Fail closed. If either expression is not present exactly once, the
  -- function is not the one this contract was written against and guessing
  -- would be worse than stopping.
  if position(v_old_automatic in v_before) = 0 then
    raise exception
      'CUP-001: the automatic-qualification expression this contract replaces '
      'is not in the installed definition of admin_finalise_predictor_cup_groups';
  end if;

  if position(v_old_wildcard in v_before) = 0 then
    raise exception
      'CUP-001: the wildcard-eligibility expression this contract replaces is '
      'not in the installed definition of admin_finalise_predictor_cup_groups';
  end if;

  v_after := replace(v_before, v_old_automatic, v_new_automatic);
  v_after := replace(v_after, v_old_wildcard, v_new_wildcard);

  -- THE ROUND TRIP. Reversing both replacements must give back exactly what we
  -- read, or something other than these two expressions moved.
  v_roundtrip := replace(v_after, v_new_wildcard, v_old_wildcard);
  v_roundtrip := replace(v_roundtrip, v_new_automatic, v_old_automatic);

  if v_roundtrip is distinct from v_before then
    raise exception
      'CUP-001: patching the qualification driver changed something other than '
      'the two expressions it names';
  end if;

  -- And the hard-coded sizes must genuinely be gone afterwards.
  if position('gate.group_size = 4' in v_after) > 0
     or position('gate.group_size = 3' in v_after) > 0 then
    raise exception
      'CUP-001: a hard-coded group size survives in the qualification driver';
  end if;

  execute v_after;
end;
$patch$;

-- Contract 60's own lint property must survive this patch: the driver reads
-- the authoritative table function directly and holds no temporary relation.
-- Reverting that was exactly what the first draft of this contract did.
do $$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_definition;

  if position('pg_temp.cup_gate_tables' in v_definition) > 0
     or position('create temporary table' in v_definition) > 0 then
    raise exception
      'CUP-001: contract 60 removed the temporary-table block from this '
      'function for hosted lint, and this contract must not reinstate it';
  end if;

  if position('cup_group_automatic_places' in v_definition) = 0
     or position('cup_group_qualifying_limit' in v_definition) = 0 then
    raise exception 'CUP-001: the driver does not read the rule functions';
  end if;
end;
$$;

commit;
