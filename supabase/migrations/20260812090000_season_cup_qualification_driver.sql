-- Contract 187 — `CUP-002`: a season Predictor Championship can qualify, seed
-- and bracket.
--
-- Authorised by [ADR 0028](../../docs/adr/0028-owner-decisions-unblocking-product-work.md)
-- §§ 6–8, which removed the owner blocker from `CUP-001` to `CUP-004`. `CUP-001`
-- landed as contract 184; this is what it unblocked.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED IN THE INSTALLED CATALOGUE
-- ---------------------------------------------------------------------------
--
-- `public.admin_finalise_predictor_cup_groups` is the platform's only
-- qualification, seeding and bracket authority, and it is tournament-shaped in
-- four expressions and one read:
--
--   1. `win.sequence between 1 and 3`               — the settle gate
--   2. `win.sequence between 4 and 3 + v_needed`    — knockout windows exist
--   3. `win.sequence = 4` (playoff window)
--   4. `win.sequence = 4` (first knockout window)
--   5. `predictor_internal.cup_final_group_tables`, four times — the table whose
--      four ADR 0014 §5.2 keys are measured over `sequence between 1 and 3`
--
-- For the Euro tournament not one of those is a defect. Sequences 1 to 3 ARE
-- the whole group stage and sequence 4 IS the first knockout window, published
-- and fixed. For a season group stage running to thirty-eight matchdays every
-- one of them is wrong, and wrong quietly: the settle gate passes as soon as the
-- first three matchweeks settle, and qualification would then run against a
-- table measured over three of thirty-eight.
--
-- ---------------------------------------------------------------------------
-- WHY THIS GENERALISES IN PLACE RATHER THAN ADDING BESIDE
-- ---------------------------------------------------------------------------
--
-- Contract 169 added `cup_season_group_tables` BESIDE the tournament's table
-- rather than widening it, and this contract deliberately does the opposite. The
-- difference is what would have to be copied.
--
-- Contract 169 duplicated one `order by`. Duplicating THIS function means
-- duplicating § 6.1's two-thirds target, § 6.3's six-key cross-group wildcard
-- order, § 7.1's three seeding bands with the same six keys again, § 7.2's
-- bracket/bye/playoff arithmetic and § 7.3's same-group avoidance pass — around
-- a hundred and fifty lines of ADR 0014, in a second copy free to drift from the
-- first. That is the drift contracts 96, 124, 169 and 182 each exist because of.
-- One rule, one expression.
--
-- **So the tournament's behaviour must be provably unchanged, and it is, by
-- construction rather than by testing every path:**
--
--   * `predictor_internal.cup_group_stage_span` returns exactly 3 for a
--     tournament, so expressions 1 to 4 evaluate to the identical constants they
--     hold today;
--   * `predictor_internal.cup_initial_group_tables` — contract 169's dispatcher,
--     already delivered and already hosted — returns
--     `cup_final_group_tables`'s own rows for a tournament, and
--     `cup_is_league_season` fails CLOSED to the tournament table on an unknown
--     competition;
--   * `predictor_internal.ensure_season_cup_knockout_windows` returns
--     immediately for a tournament, whose knockout windows are published rather
--     than generated.
--
-- `233`'s and `110`'s tournament assertions run unchanged against the patched
-- function, and `235_season_cup_qualification_driver.sql` asserts the three
-- neutrality properties directly.
--
-- ---------------------------------------------------------------------------
-- THE PATCH MECHANISM, AND THE TRAP IT AVOIDS
-- ---------------------------------------------------------------------------
--
-- **No migration holds this function's current text.** Contract 47 wrote it;
-- contract 60 then rewrote it in place by reading `pg_get_functiondef`,
-- string-replacing its `pg_temp` block and re-executing; contract 184 patched it
-- again the same way. The live definition exists nowhere on disk, and contract
-- 184's first draft restated it from contract 47 — 97 lines short, reverting
-- contract 60 entirely, failing suites 110, 114 and 153.
--
-- So this patches the INSTALLED definition in contract 60's idiom, fails closed
-- on every anchor, and proves the round trip: reversing all six replacements
-- must reproduce what was read, byte for byte. That is what bounds the change
-- without enumerating what did not move.
-- `tests/database-parity/seasonCupQualificationDriverParity.test.ts` guards the
-- mechanism, as `cupGroupQualificationParity.test.ts` guards contract 184's.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DELIBERATELY DOES NOT DO
-- ---------------------------------------------------------------------------
--
--   * It does not settle a knockout tie. `admin_settle_predictor_cup_round`,
--     `cup_window_scores` and `cup_window_settled` were generalised to
--     competition-season scope by contracts 75 to 77 and 98; there was simply no
--     knockout stage to settle, and now there is one.
--   * It does not reach `settle_season_cup_tie`. ADR 0028 § 7 and contract 182
--     permit `CUP-002` to, and it has no need: nothing here derives a group
--     table. `assert_single_group_stage_authority()` is re-run below on the
--     catalogue this migration builds.
--   * It reads no prediction and writes no score. Qualification is a
--     consequence of the table, and the table is contract 169's.
--   * It is not `CUP-003` (the Penalty Number and bracket READ) or `CUP-004`
--     (walkover and withdrawal). Both need the bracket this creates and neither
--     is claimed here.

begin;

-- ===========================================================================
-- 1. Where the group stage ends, for either kind of competition
-- ===========================================================================
--
-- Contract 186 stores the season's span. This is the one place anything asks
-- the question, so the four expressions being replaced cannot come to spell it
-- differently.
--
-- It RAISES for a season with no launch record rather than falling back to
-- three. Three would be a silently wrong answer that qualifies the wrong
-- entrants off a three-matchweek table; a refusal names the competition.

create or replace function predictor_internal.cup_group_stage_span(
  p_competition_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $span$
declare
  v_span integer;
begin
  if not predictor_internal.cup_is_league_season(p_competition_id) then
    -- The tournament Championship's published three group matchdays, fixed
    -- since contract 47 and unchanged by this contract. Returning the literal
    -- here is what makes the four patched expressions evaluate to exactly the
    -- constants they hold today.
    return 3;
  end if;

  v_span := predictor_internal.cup_group_stage_last_sequence(p_competition_id);

  if v_span is null then
    raise exception
      'Competition % holds no launch record, so where its group stage ends is not known and qualification cannot be gated on it',
      p_competition_id
      using errcode = '55000';
  end if;

  return v_span;
end;
$span$;

comment on function predictor_internal.cup_group_stage_span(uuid) is
  'Contract 187 / CUP-002. The last group-stage window sequence: 3 for the '
  'tournament Championship, whose group stage is published and fixed, and '
  'contract 186''s recorded span for a league season. Refuses a season with no '
  'launch record rather than answering three.';

revoke all on function predictor_internal.cup_group_stage_span(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. The knockout windows a season has none of
-- ===========================================================================
--
-- A tournament's knockout windows are published with the competition. A season
-- has only the group-stage windows its launch generated, and how many knockout
-- rounds it needs is not knowable until the field has been qualified — the gate
-- computes it. So the gate is where they are created, and an operator cannot be
-- asked to configure them in advance.
--
-- `generate_season_cup_windows` is unchanged and needs to be: it has appended
-- from `max(sequence)` since contract 110, which is exactly this. What matters
-- is the boundary it is given — the last GROUP window's lock instant, not
-- `now()`. Passed `now()`, its own idempotency guard sees the group windows
-- still locking in the future on an unsettled competition and returns zero,
-- creating nothing and reporting success.

create or replace function predictor_internal.ensure_season_cup_knockout_windows(
  p_competition_id uuid,
  p_needed integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $windows$
declare
  v_span integer;
  v_boundary timestamptz;
  v_existing integer;
begin
  -- A tournament publishes its own. Returning zero rather than raising, because
  -- the gate calls this on every competition and a tournament reaching it is
  -- the ordinary case, not an error.
  if not predictor_internal.cup_is_league_season(p_competition_id) then
    return 0;
  end if;

  if p_needed is null or p_needed < 1 then
    return 0;
  end if;

  v_span := predictor_internal.cup_group_stage_span(p_competition_id);

  select count(*)::integer into v_existing
    from public.bonus_competition_windows win
    where win.competition_id = p_competition_id
      and win.sequence between v_span + 1 and v_span + p_needed;

  -- Idempotent, and cheaply: a re-run of the gate must not append a second set.
  if v_existing >= p_needed then
    return 0;
  end if;

  select win.locks_at into v_boundary
    from public.bonus_competition_windows win
    where win.competition_id = p_competition_id
      and win.sequence = v_span;

  if v_boundary is null then
    raise exception
      'Competition % has no window at sequence %, so its knockout rounds have nothing to be scheduled after',
      p_competition_id, v_span
      using errcode = '55000';
  end if;

  return predictor_internal.generate_season_cup_windows(
    p_competition_id, v_boundary, p_needed);
end;
$windows$;

comment on function predictor_internal.ensure_season_cup_knockout_windows(uuid, integer) is
  'Contract 187 / CUP-002. Appends a league season Championship''s knockout '
  'windows after its last group window, through contract 110''s unchanged '
  'appender. A no-op for the tournament, whose knockout windows are published. '
  'Idempotent, so re-running the qualification gate appends nothing.';

revoke all on function predictor_internal.ensure_season_cup_knockout_windows(uuid, integer)
  from public, anon, authenticated, service_role;

commit;

begin;

-- ===========================================================================
-- 3. The patch
-- ===========================================================================

do $patch$
declare
  v_before text;
  v_after text;
  v_roundtrip text;

  -- (a) The declaration. `v_group_span` is resolved once, so six expressions
  -- cannot each resolve it slightly differently.
  v_old_declare constant text := E'  v_swap integer;\nbegin\n';
  v_new_declare constant text :=
    E'  v_swap integer;\n  -- Contract 187 begin\n  v_group_span integer;\n  -- Contract 187 end\nbegin\n';

  -- (b) The settle gate, with its message. The message moves because "All three
  -- Cup group windows" is false for a thirty-eight matchday group stage, and a
  -- refusal that misstates what it is waiting for is worse than a number.
  v_old_settle constant text :=
    E'  select count(*) into v_unsettled\n'
    '    from public.bonus_competition_windows win\n'
    '    where win.competition_id = p_competition_id\n'
    '      and win.sequence between 1 and 3\n'
    '      and not predictor_internal.cup_window_settled(win.id);\n'
    '\n'
    '  if v_unsettled > 0 then\n'
    '    raise exception ''All three Cup group windows must settle before qualification (% pending)'',\n'
    '      v_unsettled\n'
    '      using errcode = ''55000'';\n'
    '  end if;\n';
  v_new_settle constant text :=
    E'  -- Contract 187 begin\n'
    '  v_group_span := predictor_internal.cup_group_stage_span(p_competition_id);\n'
    '  -- Contract 187 end\n'
    '\n'
    '  select count(*) into v_unsettled\n'
    '    from public.bonus_competition_windows win\n'
    '    where win.competition_id = p_competition_id\n'
    '      and win.sequence between 1 and v_group_span\n'
    '      and not predictor_internal.cup_window_settled(win.id);\n'
    '\n'
    '  if v_unsettled > 0 then\n'
    '    raise exception ''All % Cup group windows must settle before qualification (% pending)'',\n'
    '      v_group_span, v_unsettled\n'
    '      using errcode = ''55000'';\n'
    '  end if;\n';

  -- (c) The knockout windows are created for a season before their existence is
  -- checked, because how many are needed is not knowable until here.
  v_old_needed constant text :=
    E'  v_needed := v_rounds + case when v_ties > 0 then 1 else 0 end;\n';
  v_new_needed constant text :=
    E'  v_needed := v_rounds + case when v_ties > 0 then 1 else 0 end;\n'
    '  -- Contract 187 begin\n'
    '  perform predictor_internal.ensure_season_cup_knockout_windows(p_competition_id, v_needed);\n'
    '  -- Contract 187 end\n';

  -- (d) The existence check and its message.
  v_old_exists constant text :=
    E'      and win.sequence between 4 and 3 + v_needed\n'
    '  ) <> v_needed then\n'
    '    raise exception ''The Cup needs % knockout windows (sequences 4-%) configured before qualification'',\n'
    '      v_needed, 3 + v_needed\n';
  v_new_exists constant text :=
    E'      and win.sequence between v_group_span + 1 and v_group_span + v_needed\n'
    '  ) <> v_needed then\n'
    '    raise exception ''The Cup needs % knockout windows (sequences %-%) configured before qualification'',\n'
    '      v_needed, v_group_span + 1, v_group_span + v_needed\n';

  -- (e) Both first-knockout-window lookups. Textually identical, replaced
  -- together, and the count is asserted on both sides so "replaced both" is
  -- measured rather than assumed.
  v_old_first constant text :=
    E'      where win.competition_id = p_competition_id and win.sequence = 4;\n';
  v_new_first constant text :=
    E'      where win.competition_id = p_competition_id and win.sequence = v_group_span + 1;\n';

  -- (f) The table. Contract 169's dispatcher, which returns the tournament's own
  -- rows for a tournament and contract 169's season table for a season. Four
  -- call sites, all four moved: a gate that qualified off one table and seeded
  -- off another would be the worst outcome available.
  v_old_table constant text := 'predictor_internal.cup_final_group_tables(p_competition_id)';
  v_new_table constant text := 'predictor_internal.cup_initial_group_tables(p_competition_id)';
begin
  select pg_catalog.pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_before;

  -- Fail closed on every anchor. A function that is not the one this contract
  -- was written against must stop the migration, not be guessed at.
  if position(v_old_declare in v_before) = 0 then
    raise exception 'CUP-002: the declaration block anchor is absent from the installed driver';
  end if;

  if position(v_old_settle in v_before) = 0 then
    raise exception 'CUP-002: the group-stage settle gate is not in the installed driver';
  end if;

  if position(v_old_needed in v_before) = 0 then
    raise exception 'CUP-002: the knockout round-count expression is not in the installed driver';
  end if;

  if position(v_old_exists in v_before) = 0 then
    raise exception 'CUP-002: the knockout window existence check is not in the installed driver';
  end if;

  -- Counted rather than merely found: there are two identical lookups and
  -- replacing one would leave the playoff and the first knockout round reading
  -- different windows.
  if (pg_catalog.length(v_before)
        - pg_catalog.length(pg_catalog.replace(v_before, v_old_first, '')))
     / pg_catalog.length(v_old_first) <> 2 then
    raise exception
      'CUP-002: expected exactly two first-knockout-window lookups in the installed driver';
  end if;

  if (pg_catalog.length(v_before)
        - pg_catalog.length(pg_catalog.replace(v_before, v_old_table, '')))
     / pg_catalog.length(v_old_table) <> 4 then
    raise exception
      'CUP-002: expected exactly four group-table reads in the installed driver';
  end if;

  if position('cup_group_stage_span' in v_before) > 0 then
    raise exception 'CUP-002 is already applied to the qualification driver'
      using errcode = '23505';
  end if;

  v_after := pg_catalog.replace(v_before, v_old_declare, v_new_declare);
  v_after := pg_catalog.replace(v_after, v_old_settle, v_new_settle);
  v_after := pg_catalog.replace(v_after, v_old_needed, v_new_needed);
  v_after := pg_catalog.replace(v_after, v_old_exists, v_new_exists);
  v_after := pg_catalog.replace(v_after, v_old_first, v_new_first);
  v_after := pg_catalog.replace(v_after, v_old_table, v_new_table);

  -- THE ROUND TRIP. Reversing all six replacements must reproduce exactly what
  -- was read. Stronger than a line diff: it proves nothing else moved without
  -- having to enumerate what did not.
  v_roundtrip := pg_catalog.replace(v_after, v_new_table, v_old_table);
  v_roundtrip := pg_catalog.replace(v_roundtrip, v_new_first, v_old_first);
  v_roundtrip := pg_catalog.replace(v_roundtrip, v_new_exists, v_old_exists);
  v_roundtrip := pg_catalog.replace(v_roundtrip, v_new_needed, v_old_needed);
  v_roundtrip := pg_catalog.replace(v_roundtrip, v_new_settle, v_old_settle);
  v_roundtrip := pg_catalog.replace(v_roundtrip, v_new_declare, v_old_declare);

  if v_roundtrip is distinct from v_before then
    raise exception
      'CUP-002: patching the qualification driver changed something other than the six expressions it names';
  end if;

  -- And the tournament shape must genuinely be gone afterwards.
  if position('sequence between 1 and 3' in v_after) > 0
     or position('sequence between 4 and 3 + v_needed' in v_after) > 0
     or position('win.sequence = 4;' in v_after) > 0 then
    raise exception
      'CUP-002: a hard-coded tournament window sequence survives in the qualification driver';
  end if;

  if position('cup_final_group_tables' in v_after) > 0 then
    raise exception
      'CUP-002: the driver still reads the tournament table directly rather than through the dispatcher';
  end if;

  execute v_after;
end;
$patch$;

-- ---------------------------------------------------------------------------
-- Contract 60's lint property and contract 184's rule reads must both survive.
-- Reverting either is exactly what contract 184's first draft did.
-- ---------------------------------------------------------------------------

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
      'CUP-002: contract 60 removed the temporary-table block from this function '
      'for hosted lint, and this contract must not reinstate it';
  end if;

  if position('cup_group_automatic_places' in v_definition) = 0
     or position('cup_group_qualifying_limit' in v_definition) = 0 then
    raise exception
      'CUP-002: contract 184''s arithmetic qualification rule is no longer read '
      'by the driver';
  end if;

  -- The driver stays service_role-only. Its season caller is the granted one.
  if has_function_privilege('anon', 'public.admin_finalise_predictor_cup_groups(uuid)', 'execute')
     or has_function_privilege('authenticated',
          'public.admin_finalise_predictor_cup_groups(uuid)', 'execute') then
    raise exception
      'CUP-002: the qualification driver must not become browser-reachable; the '
      'administrator entry point is what carries the gate';
  end if;
end;
$$;

commit;

begin;

-- ===========================================================================
-- 3b. The draw the season launchers never recorded
-- ===========================================================================
--
-- Found by driving the gate rather than by reading it, and it fires BEFORE any
-- of the six expressions above:
--
--     if v_competition.draw_completed_at is null then
--       raise exception 'The Cup group stage has not been drawn'
--
-- `public.admin_draw_predictor_cup` — the TOURNAMENT's draw — sets
-- `draw_completed_at = now()` at the end of its own work. Measured across every
-- migration and the installed catalogue, the two SEASON launchers set it
-- nowhere: `launch_season_cup` and `launch_season_cup_groups` create the groups,
-- the members, the windows and the whole fixture list and leave the column null.
--
-- So a season Championship that had been drawn, played and settled would have
-- been refused qualification on the grounds that it had never been drawn — and
-- generalising the four span expressions without this would have produced a
-- driver that still could not finish a single season competition. The launchers
-- ARE the draw, and now they say so.
--
-- `coalesce`, so a relaunch — already refused, but the write must be safe if the
-- refusal ever changes — cannot move the instant a competition was drawn at.
--
-- It refuses a Championship configured with `draw_required = false` rather than
-- writing anyway: `bonus_competitions_draw_shape` forbids the pair, so writing
-- would raise a check violation naming a constraint instead of the problem. Both
-- season Championships on hosted Development carry `draw_required = true`, as
-- does every competition `create_private_season_cup` creates, so this refuses
-- nothing that exists.

do $draw$
declare
  v_target text;
  v_original text;
  v_patched text;
  v_anchor text;
  v_addition constant text :=
    E'  -- Contract 187 begin\n'
    '  if not v_competition.draw_required then\n'
    '    raise exception\n'
    '      ''Competition % is configured as needing no draw, so the draw this launcher just made cannot be recorded'',\n'
    '      p_competition_id\n'
    '      using errcode = ''23514'';\n'
    '  end if;\n'
    '\n'
    '  update public.bonus_competitions competition\n'
    '     set draw_completed_at = coalesce(competition.draw_completed_at, now()),\n'
    '         updated_at = now()\n'
    '   where competition.id = p_competition_id;\n'
    '  -- Contract 187 end\n'
    '\n';
begin
  foreach v_target in array array[
    'predictor_internal.launch_season_cup(uuid)',
    'predictor_internal.launch_season_cup_groups(uuid)'
  ] loop
    v_original := pg_catalog.pg_get_functiondef(v_target::regprocedure);

    v_anchor :=
      '  -- Contract 186 begin' || chr(10) ||
      '  insert into public.bonus_cup_launches (';

    if pg_catalog.strpos(v_original, v_anchor) = 0 then
      raise exception
        'CUP-002: contract 186''s launch-record block is not in %, so this contract''s prerequisite is not applied',
        v_target
        using errcode = '23514';
    end if;

    if pg_catalog.strpos(v_original, 'draw_completed_at') > 0 then
      raise exception 'CUP-002 is already applied to %', v_target
        using errcode = '23505';
    end if;

    -- Both launchers select `visibility_kind` into `v_competition` from
    -- `public.bonus_competitions`; neither selects `draw_required`. Reading the
    -- record field the addition needs would be a lie, so it is read fresh.
    v_patched := pg_catalog.replace(
      v_original,
      v_anchor,
      pg_catalog.replace(
        v_addition,
        'not v_competition.draw_required',
        'not exists (select 1 from public.bonus_competitions competition'
          || ' where competition.id = p_competition_id and competition.draw_required)'
      ) || v_anchor);

    if pg_catalog.replace(
         v_patched,
         pg_catalog.replace(
           v_addition,
           'not v_competition.draw_required',
           'not exists (select 1 from public.bonus_competitions competition'
             || ' where competition.id = p_competition_id and competition.draw_required)'),
         '') is distinct from v_original then
      raise exception
        'CUP-002: recording the draw on % changed something else and will not be applied',
        v_target
        using errcode = '23514';
    end if;

    execute v_patched;
  end loop;
end;
$draw$;

commit;

begin;

-- ===========================================================================
-- 4. The caller
-- ===========================================================================
--
-- Written in the same contract as the driver it reaches, and deliberately.
-- `admin_finalise_predictor_cup_groups` is granted to `service_role` and to
-- nothing else — measured on the installed catalogue, not read off a migration —
-- so generalising it without a caller would be the thirteenth instance of the
-- authority-with-no-caller defect behind contracts 116, 118, 120, 122, 124, 128,
-- 129, 161 to 165, 172 and 179.
--
-- `require_competition_admin`, contract 127's gate, and not `require_result_admin`:
-- an account trusted to correct a scoreline has not thereby been trusted to
-- decide who reaches a Championship knockout.
--
-- It refuses a competition that is not a league season BY NAME rather than
-- passing it through. The generalised driver would handle a tournament perfectly
-- well, but the tournament Championship's qualification is an operational path
-- with its own evidence, and quietly acquiring a second front door to it is not
-- something this contract is for.

create or replace function public.admin_finalise_season_cup_groups(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $admin$
declare
  v_result jsonb;
  v_competition record;
begin
  perform predictor_internal.require_competition_admin();

  -- A transaction-scoped advisory lock keyed on the competition, contract 145's
  -- idiom: two administrators pressing the button together must not both pass
  -- the already-finalised check and both create a bracket. The driver's own
  -- `for update` on the competition row is taken after several reads, and the
  -- knockout-window creation this contract added happens outside it.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_competition_id::text, 0));

  select competition.id, competition.game_key, season.kind as tournament_kind
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
   where competition.id = p_competition_id;

  if not found then
    raise exception 'Competition % does not exist', p_competition_id
      using errcode = '23503';
  end if;

  if v_competition.game_key <> 'predictor_cup' then
    raise exception
      'Competition % is a % and has no Championship group stage to finalise',
      p_competition_id, v_competition.game_key
      using errcode = '23514';
  end if;

  if v_competition.tournament_kind is distinct from 'league_season' then
    raise exception
      'Competition % belongs to a % rather than a league season; the tournament Championship is finalised through its own operational path',
      p_competition_id, coalesce(v_competition.tournament_kind, 'competition of unknown kind')
      using errcode = '23514';
  end if;

  v_result := public.admin_finalise_predictor_cup_groups(p_competition_id);

  return v_result;
end;
$admin$;

comment on function public.admin_finalise_season_cup_groups(uuid) is
  'Contract 187 / CUP-002. Qualifies, seeds and brackets a league season '
  'Predictor Championship through the one qualification authority, gated on '
  'competition administration. Refuses a tournament Championship by name: the '
  'rule generalises, the operational path does not.';

revoke all on function public.admin_finalise_season_cup_groups(uuid) from public, anon;
grant execute on function public.admin_finalise_season_cup_groups(uuid) to authenticated;

-- ===========================================================================
-- 5. Prove it, on the catalogue this migration just built
-- ===========================================================================

do $$
declare
  v_driver text := pg_catalog.pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure);
  v_admin text := pg_catalog.pg_get_functiondef(
    'public.admin_finalise_season_cup_groups(uuid)'::regprocedure);
begin
  -- CUP-005 still holds on the state this migration installs. ADR 0028 § 7
  -- permits this driver to reach the tie rule; it does not, so the guard has
  -- nothing to find and the assertion is a control rather than a formality.
  perform predictor_internal.assert_single_group_stage_authority();

  if v_driver ~ 'settle_season_cup_tie' then
    raise exception
      'CUP-002 does not settle ties, and contract 182''s guard must not be '
      'weakened by a driver that quietly started to';
  end if;

  -- The gate is on the caller and the caller only.
  if v_admin !~ 'require_competition_admin' then
    raise exception 'Finalising a Championship must be gated on competition administration';
  end if;

  if v_admin !~ 'pg_advisory_xact_lock' then
    raise exception 'Two administrators finalising together must not both create a bracket';
  end if;

  if has_function_privilege('anon', 'public.admin_finalise_season_cup_groups(uuid)', 'execute') then
    raise exception 'Finalising must not be reachable anonymously';
  end if;

  -- The span resolver is the single decision point, and the driver uses it.
  if v_driver !~ 'cup_group_stage_span' then
    raise exception 'The driver does not resolve the group-stage span';
  end if;

  if v_driver !~ 'ensure_season_cup_knockout_windows' then
    raise exception 'The driver does not create the knockout windows a season has none of';
  end if;

  -- Contract 110's appender is reached unchanged rather than reimplemented.
  if pg_catalog.pg_get_functiondef(
       'predictor_internal.ensure_season_cup_knockout_windows(uuid,integer)'::regprocedure)
     !~ 'generate_season_cup_windows' then
    raise exception
      'Knockout windows must be appended through contract 110''s generator, not '
      'by a second window writer';
  end if;
end;
$$;

commit;
