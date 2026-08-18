-- Contract 198 — `CUP-006`: the Championship reserves the knockout it implies.
--
-- ---------------------------------------------------------------------------
-- THE OWNER DECISION THIS IMPLEMENTS, 18 AUGUST 2026
-- ---------------------------------------------------------------------------
--
-- `CUP-006` asked whether `select_season_cup_format` must RESERVE calendar for
-- the knockout it implies rather than reporting whatever happens to be left
-- over. It was recorded as blocked because the answer changes what shape a
-- competition takes, which is ADR 0014's decision and not a migration's.
--
-- The owner has now taken it, and in two parts:
--
--   * **A knockout is what happens when the field is too big for one league.**
--     A single group IS a league and finishes as one. The league is NEVER
--     shortened to make room for a bracket; a knockout is added only when the
--     rounds left after the full league happen to be enough for the qualifier
--     count, and otherwise the table decides it.
--
--   * **For a multi-group competition the knockout calendar is reserved by
--     ARITHMETIC, working backwards.** The rounds the bracket needs are taken
--     off the end and the group stage gets what remains.
--
-- The owner was shown, and accepted, the consequence of the first part: whether
-- a single group ends in a knockout depends on how the league rounds happen to
-- divide the calendar, so neighbouring field sizes end differently. Over 38
-- matchweeks 18 entrants reach a knockout and 19 do not; 11 do and 12 do not;
-- 13 reaches one with 14 rounds to spare while 6 and 8 never can.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT IS THE OPPOSITE WAY ROUND FROM ITS WRITE-UP
-- ---------------------------------------------------------------------------
--
-- Measured on the installed selector:
--
--   * `single_group` — the format that should NOT have a knockout — invents one
--     unconditionally. Every leftover round becomes a `seeded_playoff_window`
--     whether or not it could hold the bracket the qualifier count implies. For
--     ten entrants over thirty-eight matchweeks it reports a two-round playoff
--     window for seven qualifiers, who need three.
--
--   * `groups` — the format that MUST have a knockout, because the field cannot
--     be one league — reserves nothing at all. It returns `groupCount` and
--     `groupSizes` and carries no tail field of any kind.
--
-- So the shortfall surfaced at qualification time, months after the group stage
-- was played, as `ensure_season_cup_knockout_windows` failing closed. That is
-- the right failure at the wrong moment, and it is what this contract moves to
-- launch.
--
-- ---------------------------------------------------------------------------
-- ONE AUTHORITY FOR KNOCKOUT DEPTH, NOT TWO
-- ---------------------------------------------------------------------------
--
-- Reserving at launch needs the same arithmetic qualification already runs, and
-- writing it twice is how the two come to disagree. Counted on the installed
-- `admin_finalise_predictor_cup_groups`:
--
--     v_p      largest power of two <= v_q, by loop
--     v_ties   v_q - v_p
--     v_rounds count of n in 1..30 where 2^n <= v_p          (= log2 v_p)
--     v_needed v_rounds + case when v_ties > 0 then 1 else 0 end
--
-- `cup_knockout_rounds` is that expression, extracted, and the qualification
-- function is PATCHED IN PLACE to call it. Both the launcher that reserves and
-- the gate that creates the windows now read one answer.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT CHANGED
-- ---------------------------------------------------------------------------
--
-- No qualification, seeding, bye, playoff-pairing or Penalty Number rule moves;
-- ADR 0022 forbids that and one function serves the tournament as well. The
-- group cap of twenty, the minimum field of four and the minimum of two
-- meetings are all unchanged, and the migration asserts so. The split is
-- untouched: it still balances an odd meeting count and still finishes the
-- league. No competition is affected on any hosted environment, because none
-- has been launched.

begin;

-- ---------------------------------------------------------------------------
-- 1. The one authority for how deep a bracket is.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_knockout_rounds(
  p_qualifiers integer
)
returns integer
language sql
immutable
set search_path = ''
as $rounds$
  -- The largest power of two at or below the qualifier count is the bracket
  -- proper; anything above it is resolved by ONE preliminary playoff round, in
  -- which the surplus entrants pair off and the rest take byes. That is
  -- `admin_finalise_predictor_cup_groups`'s arithmetic, extracted rather than
  -- restated, and it is expressed with integer generate_series rather than
  -- log() so the value cannot depend on floating-point rounding.
  select case
    when coalesce(p_qualifiers, 0) < 2 then 0
    else (
      select count(*)::integer
        from pg_catalog.generate_series(1, 30) as n
       where (1 << n) <= largest.power
    ) + case when p_qualifiers > largest.power then 1 else 0 end
  end
  from (
    select coalesce(
      (select max(1 << n)
         from pg_catalog.generate_series(0, 30) as n
        where (1 << n) <= greatest(coalesce(p_qualifiers, 0), 1)),
      1) as power
  ) largest;
$rounds$;

comment on function predictor_internal.cup_knockout_rounds(integer) is
  'Contract 198 / CUP-006. Rounds a knockout bracket needs for a qualifier '
  'count: log2 of the largest power of two at or below it, plus one '
  'preliminary playoff round when there is a surplus. Extracted from '
  'admin_finalise_predictor_cup_groups so the launcher that RESERVES the '
  'calendar and the gate that CREATES the windows read one answer.';

revoke all on function predictor_internal.cup_knockout_rounds(integer)
  from public, anon, authenticated, service_role;

-- It must agree with the arithmetic it was extracted from, over every qualifier
-- count a competition can produce. Twenty groups of twenty is ADR 0014's
-- ceiling, so fourteen qualifiers per group is 280 at the very most.
do $$
declare
  v_q integer;
  v_p integer;
  v_ties integer;
  v_rounds integer;
  v_expected integer;
begin
  for v_q in 1..300 loop
    v_p := 1;
    while v_p * 2 <= v_q loop
      v_p := v_p * 2;
    end loop;
    v_ties := v_q - v_p;
    v_rounds := (select count(*) from pg_catalog.generate_series(1, 30) n where (1 << n) <= v_p);
    v_expected := v_rounds + case when v_ties > 0 then 1 else 0 end;

    if predictor_internal.cup_knockout_rounds(v_q) <> v_expected then
      raise exception
        'cup_knockout_rounds(%) is % but the qualification arithmetic says %',
        v_q, predictor_internal.cup_knockout_rounds(v_q), v_expected;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Qualification reads the extracted authority rather than its own copy.
--
-- Patched IN PLACE from `pg_get_functiondef`. This function has been rewritten
-- in place three times already — contract 102 made it split-safe, contract 187
-- added the window creation and contract 196 dated its outcome write — and
-- none of that lives in any migration file, which is contract 194's lesson.
-- ---------------------------------------------------------------------------

do $qualify$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_definition;

  -- Safe to re-apply.
  if position('cup_knockout_rounds' in v_definition) > 0 then
    return;
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  v_needed := v_rounds + case when v_ties > 0 then 1 else 0 end;',
    '  -- Contract 198: one authority for bracket depth, shared with the launcher.' || chr(10) ||
    '  v_needed := predictor_internal.cup_knockout_rounds(v_q);'
  );
  if v_definition = v_original then
    raise exception 'Expected Cup knockout-depth arithmetic was not found';
  end if;

  -- Everything the earlier in-place patches put here must survive.
  if position('stage <> ''group''' in v_definition) > 0
    or position('stage in (''playoff'', ''knockout'')' in v_definition) = 0 then
    raise exception 'Cup group finalisation lost contract 102 split-safety';
  end if;
  if position('phase_kind = ''initial''' in v_definition) = 0 then
    raise exception 'Cup group finalisation lost contract 102 initial-roster pinning';
  end if;
  if position('ensure_season_cup_knockout_windows' in v_definition) = 0 then
    raise exception 'Cup group finalisation lost contract 187 window creation';
  end if;
  if position('updated_at = now()' in v_definition) = 0 then
    raise exception 'Cup group finalisation lost contract 196 outcome dating';
  end if;

  execute v_definition;
end;
$qualify$;

-- ---------------------------------------------------------------------------
-- 3. The format selector reserves what it implies.
--
-- Redefined wholesale rather than patched, and that is checked rather than
-- assumed: the installed body was diffed against this file's committed text
-- before the change and differed only in `pg_get_functiondef`'s header
-- normalisation, so nothing has ever been patched into it.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.select_season_cup_format(
  p_field_size integer,
  p_remaining_rounds integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_meetings integer;
  v_league_rounds integer;
  v_top integer;
  v_bottom integer;
  v_split integer;
  v_used integer;
  v_free integer;
  v_qualifiers integer;
  v_knockout integer;
  v_tail jsonb;
  v_largest integer;
  v_group_count integer;
  v_base integer;
  v_remainder integer;
  v_sizes jsonb;
  v_reserve integer := 0;
  v_pass integer;
begin
  if p_field_size is null or p_remaining_rounds is null
     or p_field_size < 2 or p_remaining_rounds < 1 then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  if p_field_size < 4 then
    return jsonb_build_object('kind', 'declined_head_to_head');
  end if;

  v_meetings := p_remaining_rounds / (p_field_size - 1);

  if p_field_size <= 20 and v_meetings >= 2 then
    -- An odd meeting count is balanced by a split. If the split does not fit
    -- the calendar, one meeting fewer is even and needs none. The count is at
    -- least two here, so the step down always lands on an even number and this
    -- resolves in one pass rather than looping.
    v_tail := jsonb_build_object('kind', 'none');

    if v_meetings % 2 = 1 then
      v_league_rounds := v_meetings * (p_field_size - 1);
      v_top := ceil(p_field_size::numeric / 2)::integer;
      v_bottom := p_field_size / 2;
      -- A k-entrant round-robin occupies k - 1 rounds when k is even, k when
      -- odd, because an odd half carries a bye.
      v_split := case when v_top % 2 = 0 then v_top - 1 else v_top end;

      if v_league_rounds + v_split <= p_remaining_rounds then
        v_tail := jsonb_build_object(
          'kind', 'split',
          'topHalfSize', v_top,
          'bottomHalfSize', v_bottom,
          'splitRounds', v_split);
        v_used := v_league_rounds + v_split;
      else
        v_meetings := v_meetings - 1;
      end if;
    end if;

    if v_used is null then
      v_league_rounds := v_meetings * (p_field_size - 1);
      v_used := v_league_rounds;
    end if;

    -- CONTRACT 198. The league is never shortened to make room. Whatever is
    -- left after it becomes a knockout only if it can hold the whole bracket
    -- the qualifier count implies; otherwise the table decides the competition
    -- and the rounds are simply unused, which ADR 0014 already permits -- "a
    -- Cup need not fill the season".
    v_free := p_remaining_rounds - v_used;
    v_qualifiers := predictor_internal.cup_group_qualifying_limit(p_field_size);
    v_knockout := predictor_internal.cup_knockout_rounds(v_qualifiers);

    if v_knockout > 0 and v_free >= v_knockout then
      return jsonb_build_object(
        'kind', 'single_group',
        'meetings', v_meetings,
        'leagueRounds', v_league_rounds,
        'tail', v_tail,
        'knockout', jsonb_build_object(
          'rounds', v_knockout, 'qualifiers', v_qualifiers),
        'leftoverRounds', v_free - v_knockout);
    end if;

    return jsonb_build_object(
      'kind', 'single_group',
      'meetings', v_meetings,
      'leagueRounds', v_league_rounds,
      'tail', v_tail,
      'knockout', null,
      'leftoverRounds', v_free);
  end if;

  -- CONTRACT 198. A multi-group field cannot be one league, so it MUST end in a
  -- knockout, and the calendar for it is taken off the end before the groups
  -- are sized. Reserving shrinks the groups, which changes how many qualify,
  -- which changes the depth -- so this settles to a fixed point rather than
  -- reserving once. It converges downwards in practice; a field that will not
  -- settle is one the calendar genuinely cannot hold, and is refused rather
  -- than approximated.
  for v_pass in 1..8 loop
    v_largest := least(20, ((p_remaining_rounds - v_reserve) / 2) + 1);
    if v_largest < 4 then
      return jsonb_build_object('kind', 'refused', 'reason', 'insufficient_rounds');
    end if;

    v_group_count := ceil(p_field_size::numeric / v_largest)::integer;
    v_base := p_field_size / v_group_count;
    v_remainder := p_field_size % v_group_count;

    -- The smallest group is always the base size, so this is the same check as
    -- "the last balanced group is below the minimum field".
    if v_base < 4 then
      return jsonb_build_object('kind', 'refused', 'reason', 'insufficient_rounds');
    end if;

    select jsonb_agg(
             case when slot <= v_remainder then v_base + 1 else v_base end
             order by slot)
      into v_sizes
      from pg_catalog.generate_series(1, v_group_count) as slot;

    select coalesce(sum(predictor_internal.cup_group_qualifying_limit(size::integer)), 0)::integer
      into v_qualifiers
      from jsonb_array_elements_text(v_sizes) as size;

    v_knockout := predictor_internal.cup_knockout_rounds(v_qualifiers);

    if v_knockout = v_reserve then
      return jsonb_build_object(
        'kind', 'groups',
        'groupCount', v_group_count,
        'groupSizes', v_sizes,
        'knockout', jsonb_build_object(
          'rounds', v_knockout, 'qualifiers', v_qualifiers));
    end if;

    v_reserve := v_knockout;
  end loop;

  return jsonb_build_object('kind', 'refused', 'reason', 'insufficient_rounds');
end;
$$;

revoke all on function predictor_internal.select_season_cup_format(integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Prove the shape and the invariant, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_row record;
  v_bad integer := 0;
  v_single integer := 0;
  v_with_knockout integer := 0;
  v_groups integer := 0;
begin
  -- THE INVARIANT THIS CONTRACT EXISTS FOR, swept rather than sampled: a
  -- reported knockout is always deep enough for the qualifiers it names, and
  -- the rounds a competition uses never exceed the calendar it was given.
  for v_row in
    select field, rounds,
           predictor_internal.select_season_cup_format(field, rounds) as fmt
      from pg_catalog.generate_series(4, 60) as field,
           pg_catalog.generate_series(1, 80) as rounds
  loop
    if v_row.fmt->>'kind' = 'single_group' then
      v_single := v_single + 1;

      if jsonb_typeof(v_row.fmt->'knockout') = 'object' then
        v_with_knockout := v_with_knockout + 1;

        if (v_row.fmt->'knockout'->>'rounds')::integer
             < predictor_internal.cup_knockout_rounds(
                 (v_row.fmt->'knockout'->>'qualifiers')::integer) then
          v_bad := v_bad + 1;
        end if;
      end if;

      -- The league is never shortened: what it uses plus any knockout plus the
      -- leftover is exactly the calendar.
      if (v_row.fmt->>'leagueRounds')::integer
           + coalesce((v_row.fmt->'tail'->>'splitRounds')::integer, 0)
           + coalesce((v_row.fmt->'knockout'->>'rounds')::integer, 0)
           + (v_row.fmt->>'leftoverRounds')::integer
         <> v_row.rounds then
        v_bad := v_bad + 1;
      end if;

    elsif v_row.fmt->>'kind' = 'groups' then
      v_groups := v_groups + 1;

      -- A multi-group competition ALWAYS reserves, and always enough.
      if jsonb_typeof(v_row.fmt->'knockout') <> 'object'
         or (v_row.fmt->'knockout'->>'rounds')::integer
              < predictor_internal.cup_knockout_rounds(
                  (v_row.fmt->'knockout'->>'qualifiers')::integer) then
        v_bad := v_bad + 1;
      end if;
    end if;
  end loop;

  if v_bad > 0 then
    raise exception '% format decisions break the knockout reservation invariant', v_bad;
  end if;

  -- The sweep must actually reach the branches it claims to check, or the
  -- invariant above is vacuous.
  if v_single = 0 or v_with_knockout = 0 or v_groups = 0 then
    raise exception
      'the format sweep reached single_group %, with a knockout %, groups % -- one branch was never exercised',
      v_single, v_with_knockout, v_groups;
  end if;

  -- ADR 0014's bounds are untouched by this contract.
  if (predictor_internal.select_season_cup_format(3, 38))->>'kind' <> 'declined_head_to_head' then
    raise exception 'the minimum field of four moved';
  end if;
  if (predictor_internal.select_season_cup_format(21, 38))->>'kind' <> 'groups' then
    raise exception 'the group cap of twenty moved';
  end if;
  if (predictor_internal.select_season_cup_format(20, 38))->>'kind' <> 'single_group' then
    raise exception 'twenty over thirty-eight must still be one group';
  end if;

  -- The split still balances an odd meeting count.
  if (predictor_internal.select_season_cup_format(8, 38))->'tail'->>'kind' <> 'split' then
    raise exception 'the split no longer balances an odd meeting count';
  end if;

  -- And the defect this contract exists for is gone: ten entrants over
  -- thirty-eight matchweeks have seven qualifiers needing three rounds, and
  -- only two are left, so there is no knockout at all.
  if jsonb_typeof((predictor_internal.select_season_cup_format(10, 38))->'knockout') <> 'null' then
    raise exception 'ten entrants over thirty-eight still report a knockout they cannot hold';
  end if;
end;
$$;

commit;
