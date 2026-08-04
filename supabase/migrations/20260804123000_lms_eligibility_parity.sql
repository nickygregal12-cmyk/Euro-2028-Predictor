-- Contract 84: which clubs a Last Man Standing entrant may pick, and which one
-- they get if they pick nothing.
--
-- Authority: ADR 0013 as amended by ADR 0020, ported from
-- `src/domain/season/lmsEligibility.ts`. Contract 71 gave `resolve_lms_pick` a
-- SQL counterpart but not these two, which is why the settlement job cannot be
-- written yet: ADR 0013 requires an entrant who missed a selection to be
-- AUTO-ASSIGNED DETERMINISTICALLY, never eliminated, having explicitly rejected
-- no-pick elimination as "too punitive across thirty-eight weekly deadlines".
-- A server job written without this would eliminate for silence — the one
-- reading the authority ruled out. So the parity lands first.
--
-- ---------------------------------------------------------------------------
-- WHY `collate "C"` IS LOAD-BEARING, NOT STYLE
-- ---------------------------------------------------------------------------
--
-- `resolveLmsEligibility` orders eligible clubs by name using JavaScript
-- code-unit comparison, and `autoAssignLmsTeam` takes eligible[0]. PostgreSQL's
-- bare `order by name` uses the database collation. On PostgreSQL 16 the two
-- disagree:
--
--   C collation : A.F.C. Ajax | AFC Bournemouth | ATH MADRID | Aston Villa | afc wimbledon
--   ICU en-US   : A.F.C. Ajax | AFC Bournemouth | afc wimbledon | Aston Villa | ATH MADRID
--
-- C matches JavaScript exactly; ICU does not. Because auto-assignment takes the
-- FIRST element, the wrong collation does not reorder a list — it hands a
-- DIFFERENT CLUB to a player who missed their pick, and in Last Man Standing
-- that is the difference between surviving the round and being eliminated,
-- decided by the database's locale rather than by the rule. The domain module
-- anticipated this: its order is "chosen over locale collation so TypeScript
-- and the future SQL parity implement the same deterministic order regardless
-- of environment locale."
--
-- The hazard is specific to HUMAN TEXT. For lowercase hex identifiers C and ICU
-- agree, checked across 4000 samples, which is why the `doubleFixtureTeamIds`
-- ordering below is safe either way and still pinned for consistency.
--
-- ---------------------------------------------------------------------------
-- THE RULES, AND THE ORDER THEY ARE CHECKED IN
-- ---------------------------------------------------------------------------
--
-- Refusals are reported in caller order, teams before fixtures before the used
-- list, because the FIRST fault is the one a caller can act on. Within a
-- fixture, self-play is tested BEFORE unknown-team, so a fixture pairing one
-- unknown club with itself reports `team_against_itself` — matching TypeScript,
-- where the same ordering holds.
--
-- THE MANDATORY RESET is the rule most worth protecting: a player whose used
-- list already covers every club playing once this round RESETS rather than
-- being eliminated on availability grounds. Availability never eliminates. It
-- fires only when some club plays once and every one of them is used — never on
-- an empty round, which instead leaves eligibility empty so the caller fails
-- closed rather than picking something arbitrary.
--
-- A club playing TWICE in one designated round is ineligible that round however
-- fresh the used list, and a postponed pick's club stays consumed — nothing here
-- returns a club to the pool except the mandatory reset.

begin;

create or replace function predictor_internal.resolve_lms_eligibility(
  p_fixtures jsonb,
  p_teams jsonb,
  p_used_team_ids jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_team jsonb;
  v_fixture jsonb;
  v_id text;
  v_home text;
  v_away text;
  v_used text;
  v_team_ids text[] := array[]::text[];
  v_fixture_ids text[] := array[]::text[];
  v_appear_id text[] := array[]::text[];
  v_appear_n integer[] := array[]::integer[];
  v_pos integer;
begin
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array'
     or p_teams is null or jsonb_typeof(p_teams) <> 'array'
     or p_used_team_ids is null or jsonb_typeof(p_used_team_ids) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  -- Teams first, in caller order, so the first fault is the one reported.
  for v_team in
    select value from jsonb_array_elements(p_teams) with ordinality as t(value, position)
    order by t.position
  loop
    v_id := v_team->>'teamId';
    if coalesce(btrim(v_id), '') = '' or coalesce(btrim(v_team->>'name'), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
    if v_id = any (v_team_ids) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
    v_team_ids := v_team_ids || v_id;
  end loop;

  for v_fixture in
    select value from jsonb_array_elements(p_fixtures) with ordinality as t(value, position)
    order by t.position
  loop
    v_id := v_fixture->>'fixtureId';
    if coalesce(btrim(v_id), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
    if v_id = any (v_fixture_ids) then
      return jsonb_build_object('ok', false, 'reason', 'duplicate_fixture');
    end if;
    v_fixture_ids := v_fixture_ids || v_id;

    v_home := v_fixture->>'homeTeamId';
    v_away := v_fixture->>'awayTeamId';

    -- Self-play BEFORE unknown-team: a fixture pairing one unknown club with
    -- itself reports team_against_itself, matching the TypeScript order.
    if v_home is not distinct from v_away then
      return jsonb_build_object('ok', false, 'reason', 'team_against_itself');
    end if;

    foreach v_used in array array[v_home, v_away] loop
      if v_used is null or not (v_used = any (v_team_ids)) then
        return jsonb_build_object('ok', false, 'reason', 'unknown_team');
      end if;
      v_pos := array_position(v_appear_id, v_used);
      if v_pos is null then
        v_appear_id := v_appear_id || v_used;
        v_appear_n := v_appear_n || 1;
      else
        v_appear_n[v_pos] := v_appear_n[v_pos] + 1;
      end if;
    end loop;
  end loop;

  for v_used in
    select value #>> '{}' from jsonb_array_elements(p_used_team_ids) with ordinality as t(value, position)
    order by t.position
  loop
    if v_used is null or not (v_used = any (v_team_ids)) then
      return jsonb_build_object('ok', false, 'reason', 'unknown_team');
    end if;
  end loop;

  return (
    with appear as (
      select unnest(v_appear_id) as team_id, unnest(v_appear_n) as n
    ),
    playing_once as (
      select
        a.team_id,
        btrim(t.value->>'name') as name,
        -- First appearance in the fixture list. JavaScript's sort is stable, so
        -- clubs sharing a name keep the order they were first seen in; without
        -- this tie-break the two languages diverge on duplicate club names.
        array_position(v_appear_id, a.team_id) as first_seen
      from appear a
      join jsonb_array_elements(p_teams) t on t.value->>'teamId' = a.team_id
      where a.n = 1
    ),
    used as (
      select value #>> '{}' as team_id from jsonb_array_elements(p_used_team_ids)
    ),
    unused as (
      select * from playing_once where team_id not in (select team_id from used)
    ),
    reset as (
      -- Availability never eliminates. Note `playing_once > 0`: an empty round
      -- must NOT reset, it must leave eligibility empty so the caller fails
      -- closed instead of picking something arbitrary.
      select (select count(*) from unused) = 0
         and (select count(*) from playing_once) > 0 as fired
    ),
    eligible as (
      select * from unused where not (select fired from reset)
      union all
      select * from playing_once where (select fired from reset)
    )
    select jsonb_build_object(
      'ok', true,
      -- `collate "C"` is the rule, not the formatting. See the header.
      'eligibleTeamIds', coalesce(
        (select jsonb_agg(team_id order by name collate "C", first_seen) from eligible),
        '[]'::jsonb),
      'usedListReset', (select fired from reset),
      -- Ordered by ID, not by name — a different key from the list above, and
      -- conflating them is the easy mistake.
      'doubleFixtureTeamIds', coalesce(
        (select jsonb_agg(team_id order by team_id collate "C") from appear where n > 1),
        '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function predictor_internal.resolve_lms_eligibility(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The auto-assignment for a missed selection.
--
-- Null only when the round offers no eligible club at all, or the input
-- refuses. Callers MUST fail closed on null and never invent a pick — assigning
-- an arbitrary club would be worse than the elimination ADR 0013 rejected,
-- because it would look deliberate.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.auto_assign_lms_team(
  p_fixtures jsonb,
  p_teams jsonb,
  p_used_team_ids jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when (r->>'ok')::boolean is not true then null
    when jsonb_array_length(r->'eligibleTeamIds') = 0 then null
    else r->'eligibleTeamIds'->>0
  end
  from predictor_internal.resolve_lms_eligibility(p_fixtures, p_teams, p_used_team_ids) r;
$$;

revoke all on function predictor_internal.auto_assign_lms_team(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prove the collation at apply time rather than trusting the body above.
--
-- This is the one property that fails SILENTLY and changes who survives. A
-- future edit dropping `collate "C"` leaves valid SQL that returns a plausible
-- club — just not the one the rule names. These two clubs order differently
-- under C and under ICU, so the assertion cannot pass under the wrong one.
-- ---------------------------------------------------------------------------

do $$
declare
  v_fixtures constant jsonb := '[
    {"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb;
  v_teams constant jsonb := '[
    {"teamId":"t1","name":"ATH MADRID"},
    {"teamId":"t2","name":"afc wimbledon"}]'::jsonb;
  v_assigned text;
begin
  v_assigned := predictor_internal.auto_assign_lms_team(v_fixtures, v_teams, '[]'::jsonb);

  -- Code-point order puts uppercase first, so ATH MADRID (t1) wins. ICU would
  -- fold case and pick afc wimbledon (t2).
  if v_assigned is distinct from 't1' then
    raise exception
      'auto-assignment picked %, not t1 — the club ordering is not code-point; check collate "C"',
      coalesce(v_assigned, 'null');
  end if;
end;
$$;

commit;
