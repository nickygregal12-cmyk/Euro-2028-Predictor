-- Contract 196 — a player is told what happened to them in a game.
--
-- ---------------------------------------------------------------------------
-- TWO FINDINGS, BOTH MEASURED ON THE INSTALLED CATALOGUE AT CONTRACT 195
-- ---------------------------------------------------------------------------
--
-- **`game_consequence` is the last deadline-free action type with no
-- generator.** Contract 195 closed `cup_penalty_number_due` and recorded what
-- was left: `game_consequence` and `league_invitation`, both declared by
-- `player_action_items_type_allowed` since contract 162 and never produced.
-- This contract writes the first of them. The second stays unwritten for the
-- reason `MIG-UI-14` gives — an invite code is a standing capability rather
-- than an event, so there is nothing to key an idempotent item on without a new
-- relation, and that is a design decision rather than a generator.
--
-- **`bonus_competition_entrants.updated_at` is maintained by four of the seven
-- outcome writes and not by three.** Counted over every function that updates
-- that table:
--
--     admin_disqualify_competition_game_entry       1 write   updated_at: yes
--     predictor_internal.recompute_lms_for_...      1 write   updated_at: yes
--     predictor_internal.settle_season_lms_...      2 writes  updated_at: yes
--     admin_finalise_predictor_cup_groups           1 write   updated_at: NO
--     admin_settle_predictor_cup_round              2 writes  updated_at: NO
--
-- So the column that dates an entrant's outcome means what it says for Last Man
-- Standing and for disqualification, and means nothing for the Championship: a
-- player knocked out of a Championship tie carries an `updated_at` from
-- whenever their row was last touched for some other reason.
--
-- That is a defect on its own terms — a stored date that is right for some rows
-- and stale for others is worse than no date, because nothing reading it can
-- tell which it has. It is also the whole reason this generator was not
-- writable before: WHEN a consequence happened has to come from somewhere, and
-- inventing a second event relation beside a column that already exists would
-- be the duplicate authority this repository keeps refusing to create.
--
-- ---------------------------------------------------------------------------
-- THE REPAIR IS A DATE, NOT A RULE
-- ---------------------------------------------------------------------------
--
-- Both Championship authorities are patched to set `updated_at = now()` on the
-- outcome writes they already perform. No outcome changes, no row is selected
-- differently, and no qualification, seeding, bye, playoff-pairing or Penalty
-- Number rule is touched — ADR 0022 forbids that and one function serves the
-- tournament as well as the season. The patches are anchored on the `set`
-- clauses themselves and refuse if either has moved.
--
-- Both are patched IN PLACE from `pg_get_functiondef`, because both have been
-- rewritten in place before: contract 102 made them split-safe and contract 194
-- added the eligibility branch, and neither of those lives in any migration
-- file. The block asserts afterwards that both survived.
--
-- ---------------------------------------------------------------------------
-- WHAT COUNTS AS A CONSEQUENCE, AND WHAT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- `outcome` is constrained to ('active', 'qualified', 'survived', 'eliminated',
-- 'champion'). Three of those are told:
--
--   * `eliminated` — you are out of this competition.
--   * `champion`   — you won it.
--   * `qualified`  — you reached its knockout stage.
--
-- `active` is the starting state and is not news. `survived` is deliberately
-- excluded: it is written for every surviving entrant of every Last Man
-- Standing round, so telling it would post an item per player per week, and it
-- is already the answer the player gets from the pick they made. An inbox that
-- reports every non-event is an inbox nobody reads.
--
-- The item carries WHY where the platform knows: an entrant whose membership
-- says `disqualified` was removed rather than beaten, and that is a materially
-- different sentence to show a player. It is read from `game_memberships`, the
-- same authority contract 194 reads, rather than stored twice.
--
-- ---------------------------------------------------------------------------
-- IT IS NEWS, SO IT BEHAVES LIKE CONTRACT 173'S RECAP
-- ---------------------------------------------------------------------------
--
-- Priority 5, the lowest the constraint permits, for contract 173's reason:
-- nothing that merely happened may outrank something that must be done. No
-- `deadline_at`, which is also what keeps it out of the reminder scheduler. It
-- expires seven days after the consequence, and the same seven days bound the
-- selection, so enabling this generator never posts a backlog of every
-- elimination in the platform's history.
--
-- ---------------------------------------------------------------------------
-- AND THE SWEEP LEARNS THAT AN OUTCOME CAN BE REVERSED
-- ---------------------------------------------------------------------------
--
-- `recompute_lms_for_tournament` exists precisely so a rescored result can move
-- an entrant's outcome, and it can move it BACK: an entrant recorded as
-- `eliminated` may become `survived` again. A recap of an elimination that
-- has since been reversed is not merely stale, it is wrong, and it would sit in
-- the inbox for up to seven days saying so.
--
-- The sweep therefore gains a fourth re-read, in the same spirit as its other
-- three: the stored outcome in the item's context is a COPY, the entrant row is
-- the fact, and an item whose copy no longer matches is closed. Contract 162
-- built the sweep around exactly this argument for a lock that moves.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no table, adds no grant a browser can reach and schedules no job.
-- It changes no outcome, decides no tie, and tells a player only about
-- THEMSELVES: no other entrant's identity, placing or state is in the payload.

begin;

-- ===========================================================================
-- 1. The repair: the Championship dates its outcome writes like everything else
-- ===========================================================================

do $dates$
declare
  v_definition text;
  v_original text;
begin
  -- --- admin_settle_predictor_cup_round: eliminated, and champion ----------
  select pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
  ) into v_definition;

  -- Each write is guarded SEPARATELY. A single guard covering both would, if one
  -- were ever reverted on its own, re-apply the other and produce
  -- `updated_at = now(), updated_at = now()` -- which PostgreSQL refuses as
  -- "multiple assignments to same column". Found by mutating one of them.
  v_original := v_definition;
  if position('set outcome = ''eliminated'', updated_at = now()' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '      set outcome = ''eliminated''',
      '      set outcome = ''eliminated'', updated_at = now()'
    );
  end if;
  if position('set outcome = ''champion'', updated_at = now()' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '      set outcome = ''champion''',
      '      set outcome = ''champion'', updated_at = now()'
    );
  end if;

  if v_definition <> v_original then
    if position('set outcome = ''eliminated'', updated_at = now()' in v_definition) = 0
      or position('set outcome = ''champion'', updated_at = now()' in v_definition) = 0 then
      raise exception 'Expected Championship outcome writes were not found';
    end if;

    -- Contract 102 and contract 194 must both survive. Neither lives in a
    -- migration file, so this is the only place either can be checked.
    if position('stage <> ''group''' in v_definition) > 0
      or position('stage in (''playoff'', ''knockout'')' in v_definition) = 0 then
      raise exception 'Cup round settlement lost contract 102 split-safety';
    end if;
    if position('cup_entrant_eligibility' in v_definition) = 0 then
      raise exception 'Cup round settlement lost contract 194 eligibility';
    end if;

    execute v_definition;
  end if;

  -- --- admin_finalise_predictor_cup_groups: qualified, and eliminated ------
  select pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_definition;

  if position('then ''eliminated'' else ''qualified'' end, updated_at = now()' in v_definition) = 0 then
    v_original := v_definition;
    v_definition := replace(
      v_definition,
      '      then ''eliminated'' else ''qualified'' end',
      '      then ''eliminated'' else ''qualified'' end, updated_at = now()'
    );
    if v_definition = v_original then
      raise exception 'Expected Championship qualification outcome write was not found';
    end if;

    if position('stage <> ''group''' in v_definition) > 0
      or position('stage in (''playoff'', ''knockout'')' in v_definition) = 0 then
      raise exception 'Cup group finalisation lost contract 102 split-safety';
    end if;
    if position('phase_kind = ''initial''' in v_definition) = 0 then
      raise exception 'Cup group finalisation lost contract 102 initial-roster pinning';
    end if;

    execute v_definition;
  end if;
end;
$dates$;

-- ===========================================================================
-- 2. The generator
-- ===========================================================================

create or replace function predictor_internal.generate_game_consequence_actions(
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $consequence$
declare
  v_written integer := 0;
begin
  with recent as (
    select
      entrant.user_id,
      entrant.competition_id,
      competition.tournament_id,
      competition.game_key,
      entrant.outcome,
      entrant.updated_at as occurred_at,
      -- WHY, where the platform knows it. Removed is not the same sentence as
      -- beaten, and `game_memberships` is the authority contract 194 reads.
      exists (
        select 1
          from public.game_memberships membership
         where membership.game_competition_id = entrant.competition_id
           and membership.user_id = entrant.user_id
           and membership.status = 'disqualified') as disqualified
      from public.bonus_competition_entrants entrant
      join public.bonus_competitions competition
        on competition.id = entrant.competition_id
     -- `active` is the starting state and `survived` is written every Last Man
     -- Standing round for every survivor. Neither is news.
     where entrant.outcome in ('eliminated', 'champion', 'qualified')
       and entrant.updated_at <= p_now
       -- The same seven days the item expires after, so enabling this generator
       -- never posts a backlog of every elimination in the platform's history.
       and entrant.updated_at > p_now - interval '7 days'
  )
  insert into public.player_action_items as item (
    user_id, action_key, action_type, priority, tournament_id, competition_id,
    deadline_at, expires_at, context, updated_at)
  select recent.user_id,
         'game_consequence:' || recent.competition_id::text
           || ':' || recent.outcome,
         'game_consequence',
         -- Contract 173's argument, unchanged: nothing that merely happened may
         -- outrank something that must be done.
         5,
         recent.tournament_id,
         recent.competition_id,
         -- NULL. Nothing is due, and this is what keeps it out of the reminder
         -- scheduler.
         null,
         recent.occurred_at + interval '7 days',
         jsonb_build_object(
           'outcome', recent.outcome,
           'game_key', recent.game_key,
           'occurred_at', recent.occurred_at,
           'disqualified', recent.disqualified),
         p_now
    from recent
  on conflict (user_id, action_key) do update
    set expires_at = excluded.expires_at,
        context = excluded.context,
        updated_at = excluded.updated_at
  -- Never resurrect, as contract 173 established: an item the sweep has closed
  -- or the player has completed stays closed.
  where item.invalidated_at is null
    and item.completed_at is null
    and (item.expires_at is distinct from excluded.expires_at
      or item.context is distinct from excluded.context);

  get diagnostics v_written = row_count;
  return v_written;
end;
$consequence$;

revoke all on function predictor_internal.generate_game_consequence_actions(timestamptz)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.generate_game_consequence_actions(timestamptz) is
  'Contract 196. One item per entrant per competition per terminal or '
  'qualifying outcome, dated from bonus_competition_entrants.updated_at, which '
  'this contract also repaired in the two Championship authorities that were '
  'not maintaining it. survived and active are deliberately not told. News '
  'rather than a deadline: priority 5, no deadline_at, expires after seven '
  'days. Idempotent on (user_id, action_key).';

-- ===========================================================================
-- 3. The sweep learns that an outcome can be reversed
-- ===========================================================================

do $sweep$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'predictor_internal.invalidate_expired_actions(timestamptz)'::regprocedure
  ) into v_definition;

  -- Safe to re-apply: the branch below ends with the tail it anchors on.
  if position('game_consequence' in v_definition) > 0 then
    return;
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '                  true))' || chr(10) ||
    '     );',
    '                  true))' || chr(10) ||
    '       -- CONTRACT 196. An outcome can be REVERSED.' || chr(10) ||
    '       -- `recompute_lms_for_tournament` exists so a rescored result can' || chr(10) ||
    '       -- move an entrant''s outcome, and it can move it back: an entrant' || chr(10) ||
    '       -- recorded as `eliminated` may become `survived` again. A recap of' || chr(10) ||
    '       -- an elimination that has since been reversed is not stale, it is' || chr(10) ||
    '       -- wrong, and it would sit in the inbox for up to seven days.' || chr(10) ||
    '       --' || chr(10) ||
    '       -- The context holds a COPY of the outcome; the entrant row is the' || chr(10) ||
    '       -- fact. Same argument as every other branch here.' || chr(10) ||
    '       or (item.action_type = ''game_consequence''' || chr(10) ||
    '           and not exists (' || chr(10) ||
    '             select 1' || chr(10) ||
    '               from public.bonus_competition_entrants entrant' || chr(10) ||
    '              where entrant.competition_id = item.competition_id' || chr(10) ||
    '                and entrant.user_id = item.user_id' || chr(10) ||
    '                and entrant.outcome = item.context ->> ''outcome''))' || chr(10) ||
    '     );'
  );
  if v_definition = v_original then
    raise exception 'Expected expiry-sweep tail was not found';
  end if;

  -- Every authority the sweep already had must survive.
  if position('window_row.id = (item.context ->> ''window_id'')::uuid' in v_definition) = 0
    or position('season_matchweek_lock_at(' in v_definition) = 0
    or position('cup_window_id' in v_definition) = 0 then
    raise exception 'The expiry sweep lost an authority it already had';
  end if;

  execute v_definition;
end;
$sweep$;

-- ===========================================================================
-- 4. The driver runs it
-- ===========================================================================

do $driver$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.process_player_action_items()'::regprocedure
  ) into v_definition;

  if position('generate_game_consequence_actions' in v_definition) > 0 then
    return;
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  v_cup integer;',
    '  v_cup integer;' || chr(10) ||
    '  v_consequence integer;'
  );
  if v_definition = v_original then
    raise exception 'Expected action driver declaration was not found';
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  v_cup := predictor_internal.generate_cup_penalty_number_actions(v_now);',
    '  v_cup := predictor_internal.generate_cup_penalty_number_actions(v_now);' || chr(10) ||
    '  v_consequence := predictor_internal.generate_game_consequence_actions(v_now);'
  );
  if v_definition = v_original then
    raise exception 'Expected action generator sequence was not found';
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    ''cup_penalty_number_actions_written'', v_cup,',
    '    ''cup_penalty_number_actions_written'', v_cup,' || chr(10) ||
    '    ''game_consequence_actions_written'', v_consequence,'
  );
  if v_definition = v_original then
    raise exception 'Expected action driver report shape was not found';
  end if;

  if position('generate_game_consequence_actions' in v_definition)
     > position('invalidate_expired_actions' in v_definition) then
    raise exception 'The expiry sweep must run after every generator';
  end if;

  execute v_definition;
end;
$driver$;

-- ===========================================================================
-- 5. Prove the shape, in the same transaction
-- ===========================================================================

do $$
declare
  v_settle text := pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure);
  v_finalise text := pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure);
  v_sweep text := pg_get_functiondef(
    'predictor_internal.invalidate_expired_actions(timestamptz)'::regprocedure);
  v_driver text := pg_get_functiondef(
    'public.process_player_action_items()'::regprocedure);
  v_stale integer;
  -- The generator without its own explanatory comments. The prose names the
  -- states it deliberately does not tell, so a guard over the whole body would
  -- match the explanation and refuse a correct function.
  v_code text := (
    select string_agg(source_line, chr(10))
      from regexp_split_to_table(pg_get_functiondef(
             'predictor_internal.generate_game_consequence_actions(timestamptz)'::regprocedure),
           chr(10)) as source_line
     where btrim(source_line) not like '--%');
begin
  -- EVERY outcome write now dates itself. Counted the same way the header
  -- counted it, so the finding and its repair are measured identically.
  select count(*) into v_stale
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_matches(
      pg_get_functiondef(p.oid), 'set outcome[^;]*', 'g') as m
   where p.prosrc ~ 'update public\.bonus_competition_entrants'
     and m[1] not like '%updated_at%';
  if v_stale <> 0 then
    raise exception '% outcome write(s) still do not date themselves', v_stale;
  end if;

  -- And the two rules those functions carry are still there.
  if position('stage in (''playoff'', ''knockout'')' in v_settle) = 0
    or position('stage in (''playoff'', ''knockout'')' in v_finalise) = 0 then
    raise exception 'The date repair lost contract 102 split-safety';
  end if;
  if position('cup_entrant_eligibility' in v_settle) = 0 then
    raise exception 'The date repair lost contract 194 eligibility';
  end if;

  -- The generator tells three outcomes and not the two that are not news.
  if position('''eliminated'', ''champion'', ''qualified''' in v_code) = 0 then
    raise exception 'The generator must tell exactly the three consequence outcomes';
  end if;
  if v_code ~ '''survived''' or v_code ~ '''active''' then
    raise exception 'A per-round survival is not a consequence';
  end if;

  -- News, not a deadline. A `deadline_at` would put it in the reminder
  -- scheduler, which sends about things that are due.
  if v_code !~ 'null,' then
    raise exception 'A consequence has no deadline';
  end if;

  -- It writes exactly one relation, and it is the inbox. In particular it must
  -- not be a second writer of the outcome it reports.
  if v_code ~ 'update public\.bonus_competition_entrants'
     or v_code ~ 'insert into public\.bonus_competition_entrants' then
    raise exception 'A generator may not write the outcome it reports';
  end if;

  -- The sweep closes a reversed outcome, and the driver runs the generator.
  if v_sweep !~ 'game_consequence' then
    raise exception 'The sweep must close a consequence whose outcome was reversed';
  end if;
  if v_driver !~ 'generate_game_consequence_actions' then
    raise exception 'The action driver must run the consequence generator';
  end if;

  -- Unreachable from any API role.
  if exists (
    select 1 from information_schema.role_routine_grants
     where routine_schema = 'predictor_internal'
       and routine_name = 'generate_game_consequence_actions'
       and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then
    raise exception 'The consequence generator must be unreachable from API roles';
  end if;
end;
$$;

commit;
