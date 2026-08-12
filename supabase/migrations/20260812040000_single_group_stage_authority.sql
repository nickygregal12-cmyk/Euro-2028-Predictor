-- ---------------------------------------------------------------------------
-- Contract 182 — one season Championship group-stage authority, and a guard
-- that fires.
--
-- `CUP-005`, decided by [ADR 0028](../../docs/adr/0028-owner-decisions-unblocking-product-work.md)
-- § 7 on 12 August 2026: `predictor_internal.cup_season_group_tables` — the
-- derived path a browser already reads — is the sole season Championship
-- group-standings authority. The unused per-tie stored-outcome interpretation
-- must be "retired, narrowed or otherwise prevented from becoming a second
-- expression of the same rule", and "no driver should begin writing
-- group-stage winner rows merely because `settle_season_cup_tie` exists".
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED, ON THE INSTALLED CATALOGUE RATHER THAN ON THE MIGRATIONS
-- ---------------------------------------------------------------------------
--
-- Against a database rebuilt from every committed migration:
--
--   * `predictor_internal.settle_season_cup_tie` is named by **NOTHING**. Not
--     one function in `public` or `predictor_internal` mentions it. Its only
--     references anywhere are `126_season_cup_rules.sql`, which tests it
--     directly, and a comment in the launch migration.
--   * `predictor_internal.cup_season_group_tables` is named by
--     `predictor_internal.cup_initial_group_tables`, contract 169's dispatcher,
--     which is what the browser reads reach.
--   * five functions write `public.bonus_cup_members`, and none of them names
--     the tie function.
--
-- **So the two cannot disagree today, for the strongest possible reason: only
-- one of them is reachable.** The register's phrasing — "which of the two
-- implementations is the authority" — describes a risk that is real and
-- entirely in the future.
--
-- ---------------------------------------------------------------------------
-- WHY THE FUNCTION IS NOT DROPPED
-- ---------------------------------------------------------------------------
--
-- Dropping it is the obvious reading of "retired" and it is the wrong move for
-- three measured reasons.
--
--   1. **It is not actually the group stage's rule.** It settles ONE head-to-
--      head tie from two entrants' point cards — ADR 0014 § 4.3 and § 4.4 —
--      which is also what a KNOCKOUT tie is. `cup_season_group_tables` derives
--      a group TABLE. They overlap; they are not the same question, and
--      deleting the tie rule would remove something the knockout path
--      (`CUP-002`) is likely to need.
--   2. **It carries a live parity control that has caught a real defect.** It
--      has a TypeScript counterpart, `src/domain/season/cupTieSettlement.ts`,
--      and contract 96 built the differential suite between them and found
--      they disagreed on **40 of 1200** randomised ties — including a rule
--      that depended on JavaScript key insertion order and so could never have
--      had a SQL counterpart. Dropping the SQL side deletes that control.
--   3. **Dropping is destructive** and would force this out of the additive
--      fast lane to remove something nothing calls.
--
-- So it is narrowed by DECLARATION plus a GUARD, rather than by deletion.
--
-- ---------------------------------------------------------------------------
-- THE GUARD, AND THE PART THAT MATTERS
-- ---------------------------------------------------------------------------
--
-- A comment is not a control. The guard refuses the specific future ADR 0028
-- names: a function that reaches `settle_season_cup_tie` **and** writes the
-- group-stage relations. That conjunction is deliberate and is narrower than
-- "nothing may call the tie function" — the knockout driver `CUP-002` will
-- legitimately want to call it, and a guard that forbade that would be removed
-- by whoever writes it, which is how guards die.
--
-- **A guard that has never been shown to fire is indistinguishable from one
-- that cannot.** `231_single_group_stage_authority.sql` therefore installs a
-- function that names both and requires the guard to raise, then rolls it back.
-- The suite also asserts the POSITIVE control — that
-- `cup_initial_group_tables` still names `cup_season_group_tables` — because
-- otherwise a rename would make every assertion here pass by both sides being
-- absent.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It changes no rule, no scoring value, no table and no grant. It does not
-- touch `cup_final_group_tables`, the TOURNAMENT's table, whose
-- `sequence between 1 and 3` bound contract 169 deliberately left in place.
-- It settles nothing, qualifies nobody and creates no driver: `CUP-002` — the
-- season qualification, seeding and bracket driver — is untouched and still
-- unbuilt, and `admin_finalise_predictor_cup_groups` still gates on exactly
-- three settled windows, so a season group stage still cannot qualify anyone.
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- 1. Declare the authority on the functions themselves.
-- ===========================================================================

comment on function predictor_internal.cup_season_group_tables(uuid) is
  'Contract 169; contract 182 / CUP-005. THE sole season Predictor Championship '
  'group-stage standings authority, per ADR 0028 section 7. Measures ADR 0014 '
  'section 5.2''s keys over the season''s own matchdays rather than the '
  'tournament''s first three. Nothing else may express the group-stage result '
  'rule, and predictor_internal.assert_single_group_stage_authority() refuses '
  'an installation where something does.';

comment on function predictor_internal.settle_season_cup_tie(jsonb, jsonb, jsonb) is
  'Contract 74; narrowed by contract 182 / CUP-005. Settles ONE head-to-head '
  'tie from two point cards. It is explicitly NOT the season group-stage '
  'authority -- ADR 0028 section 7 names cup_season_group_tables -- and no '
  'driver may begin writing group-stage rows because this exists. It is kept '
  'rather than dropped because it is the knockout tie rule CUP-002 will need, '
  'and because it carries the differential parity control against '
  'src/domain/season/cupTieSettlement.ts that contract 96 built after finding '
  'the two disagreed on 40 of 1200 randomised ties.';

-- ===========================================================================
-- 2. The guard.
-- ===========================================================================
--
-- Reads the INSTALLED catalogue rather than the migration text, which is the
-- claim a source assertion inside one migration cannot make: it sees functions
-- installed by migrations that do not exist yet.

create or replace function predictor_internal.assert_single_group_stage_authority()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $guard$
declare
  v_offenders text;
begin
  select string_agg(offender.signature, ', ' order by offender.signature)
    into v_offenders
    from (
      select n.nspname || '.' || p.proname as signature
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'predictor_internal')
         and p.proname <> 'assert_single_group_stage_authority'
         -- Reaches the per-tie rule ...
         and p.prosrc like '%settle_season_cup_tie%'
         -- ... AND writes the group stage. Either alone is legitimate; the
         -- CONJUNCTION is the second authority ADR 0028 section 7 forbids.
         and (p.prosrc ~* 'insert[[:space:]]+into[[:space:]]+public\.bonus_cup_members'
           or p.prosrc ~* 'update[[:space:]]+public\.bonus_cup_members'
           or p.prosrc ~* 'insert[[:space:]]+into[[:space:]]+public\.bonus_cup_groups'
           or p.prosrc ~* 'update[[:space:]]+public\.bonus_cup_groups')
    ) offender;

  if v_offenders is not null then
    raise exception
      'CUP-005: % reaches settle_season_cup_tie and writes the group stage. '
      'ADR 0028 section 7 names predictor_internal.cup_season_group_tables as the '
      'sole season group-stage authority; a second expression of that rule must '
      'not exist.', v_offenders
      using errcode = '23514';
  end if;
end;
$guard$;

comment on function predictor_internal.assert_single_group_stage_authority() is
  'Contract 182 / CUP-005. Refuses any installed function that both reaches '
  'settle_season_cup_tie and writes the group-stage relations. Deliberately a '
  'conjunction: the knockout driver CUP-002 may legitimately call the tie rule, '
  'and a guard that forbade that outright would be deleted by whoever writes it.';

revoke all on function predictor_internal.assert_single_group_stage_authority()
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. Prove it here, on the catalogue this migration just finished building.
-- ===========================================================================

do $$
declare
  v_tie_callers integer;
  v_dispatcher_names_authority boolean;
begin
  -- The guard must pass on the state we are installing into. If it does not,
  -- the repository already holds the defect and this migration must not claim
  -- to have prevented it.
  perform predictor_internal.assert_single_group_stage_authority();

  -- The measured facts the header states, asserted rather than asserted-in-prose.
  select count(*)::integer into v_tie_callers
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'predictor_internal')
     and p.proname <> 'settle_season_cup_tie'
     and p.proname <> 'assert_single_group_stage_authority'
     and p.prosrc like '%settle_season_cup_tie%';

  if v_tie_callers <> 0 then
    raise exception
      'CUP-005 baseline moved: settle_season_cup_tie now has % caller(s). '
      'That may be legitimate (CUP-002''s knockout driver), but the header of '
      'this migration says it has none, so the header is now wrong.',
      v_tie_callers;
  end if;

  -- THE POSITIVE CONTROL. Without it, renaming either function would make
  -- every assertion above pass by both sides being absent.
  select p.prosrc like '%cup_season_group_tables%'
    into v_dispatcher_names_authority
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'predictor_internal'
     and p.proname = 'cup_initial_group_tables'
   limit 1;

  if not coalesce(v_dispatcher_names_authority, false) then
    raise exception
      'CUP-005: cup_initial_group_tables no longer reaches cup_season_group_tables, '
      'so the authority ADR 0028 section 7 names is not the one being read';
  end if;
end;
$$;

commit;
