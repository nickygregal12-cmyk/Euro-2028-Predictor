-- Contract 195 — the action centre learns about the Championship tie.
--
-- ---------------------------------------------------------------------------
-- THE GAP, MEASURED ON THE INSTALLED CATALOGUE
-- ---------------------------------------------------------------------------
--
-- `player_action_items_type_allowed` has admitted `cup_penalty_number_due`
-- since contract 162 built the action centre. Counted over the installed
-- catalogue at contract 194, the generators are:
--
--     generate_lms_pick_actions                1
--     generate_matchweek_prediction_actions    1
--     generate_matchweek_settled_actions       1
--     cup_penalty_number_due                   0
--
-- The vocabulary was declared and never written. Contract 170 said why, and
-- said it honestly: "the Championship's own action is a fixture in a bracket
-- that does not exist yet for a season, so writing its generator now would be
-- writing against a shape nobody has decided."
--
-- That shape now exists. Contract 187 (`CUP-002`) gives a league season
-- qualification, seeding and knockout windows; contract 193 (`CUP-003`) gives
-- the entrant a browser-reachable read of the tie. So the reason for the
-- omission is gone, and the omission is the last thing standing between a
-- qualified entrant and being told their Penalty Number is due.
--
-- ---------------------------------------------------------------------------
-- EVERY CONDITION IS READ FROM THE WRITE AUTHORITY, NOT RESTATED
-- ---------------------------------------------------------------------------
--
-- `submit_cup_penalty_number` is the only thing that decides whether a Penalty
-- Number may be entered. This generator asks the same four questions it asks,
-- in the same order, from the same places:
--
--   * you hold a tie in this window -- `bonus_cup_fixtures`, home or away, with
--     `stage in ('playoff', 'knockout')`. That predicate is contract 102's, not
--     a fresh one: `stage <> 'group'` would sweep in a `split` fixture, which is
--     a group-phase table row and has no Penalty Number.
--   * the tie is not settled -- `winner_user_id is null`, the same refusal.
--   * the round's real fixtures are scheduled -- `cup_window_first_kickoff`
--     returns null and the write refuses, so a null is "not derivable" rather
--     than "no deadline", exactly as contract 170 treated an underivable
--     matchweek lock.
--   * it has not locked -- `now() >= v_first_kickoff` is the write's refusal, so
--     `locks_at > p_now` is the generator's inclusion.
--
-- The lane is read the same way. §8.3 fixes the lanes at round creation: the
-- home side (better seed) holds ODD, the away side EVEN, and
-- `submit_cup_penalty_number` rejects the wrong parity. The context carries the
-- lane so a surface can say "pick an odd number" without deriving it a second
-- time, which is the whole reason the lane is in the payload rather than the
-- rule.
--
-- ---------------------------------------------------------------------------
-- THE DEADLINE IS THE FIRST KICKOFF, AND THAT IS NOT THE WINDOW'S LOCK
-- ---------------------------------------------------------------------------
--
-- This is the one place where reusing the obvious authority would have been
-- wrong, and it is worth stating precisely because it is invisible from the
-- outside.
--
-- Contract 162's expiry sweep re-reads `bonus_competition_windows.locks_at`,
-- keyed on `context ->> 'window_id'`. A season Cup window's `locks_at` is
-- written by contract 161 as `season_matchweek_lock_at(tournament, round,
-- buffer)` — the first kickoff MINUS the game definition's buffer. The Penalty
-- Number, by contrast, locks AT the first kickoff.
--
-- So an item carrying `window_id` would be invalidated `buffer_minutes` before
-- the write authority stops accepting it, and the action centre would tell a
-- player their Penalty Number had closed while `submit_cup_penalty_number` was
-- still taking it. The item therefore carries `cup_window_id`, a DIFFERENT key,
-- and the sweep gains a third re-read that derives the first kickoff rather
-- than reading a lock that means something else. Two authorities, two keys.
--
-- ---------------------------------------------------------------------------
-- AN ENTRANT WHO MAY NOT CONTEST THE TIE IS NOT ASKED FOR A NUMBER
-- ---------------------------------------------------------------------------
--
-- Contract 194 established that a tie one side may not legally contest is
-- decided by walkover to the eligible opponent, without consulting points. A
-- Penalty Number from the ineligible side cannot affect that, so asking for one
-- would be asking for something that cannot help.
--
-- `cup_entrant_eligibility` is READ rather than restated, and it fails towards
-- the status quo for the same reason it does there: an absent membership row
-- reports `eligible`, so every entrant predating `game_memberships` still gets
-- their item. This suppresses an action; it decides no tie and writes no
-- eligibility.
--
-- ---------------------------------------------------------------------------
-- PRIORITY 1, AND THE HONEST VERSION OF WHY
-- ---------------------------------------------------------------------------
--
-- Contract 162 put a Last Man Standing pick at 1 because missing it eliminates,
-- and the matchweek card at 2 because missing it merely costs points.
--
-- A missed Penalty Number does not certainly eliminate: it decides the tie only
-- when the two sides are level on points AND level on scoreline error. But when
-- it does bite the consequence is terminal — the opponent takes the tie by
-- walkover and the player's Championship is over — and unlike a matchweek there
-- is no next week to recover in. It is ranked with the elimination class for
-- that reason, and not because its deadline is earlier: the matchweek lock is
-- the first kickoff minus a buffer, so it is in fact the earlier of the two.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no table, adds no grant a browser can reach, schedules no job, and
-- discloses nothing new: the item carries the player's OWN lane and tie
-- coordinates and never the opponent's identity, value, or whether they have
-- submitted — contract 193 withholds that last one deliberately and this must
-- not become the surface that leaks it. It writes no Penalty Number, moves no
-- lock and settles nothing.

begin;

-- ---------------------------------------------------------------------------
-- The generator.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.generate_cup_penalty_number_actions(
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $penalty$
declare
  v_written integer := 0;
begin
  with tie as (
    select
      fixture.competition_id,
      fixture.window_id,
      fixture.stage,
      fixture.round_size,
      fixture.bracket_slot,
      fixture.home_user_id,
      fixture.away_user_id,
      competition.tournament_id,
      window_row.label,
      -- The competition-neutral combiner contract 98 built, and the same one
      -- `submit_cup_penalty_number` reads. A tournament window and a season
      -- window derive their first kickoff from different relations; neither is
      -- re-derived here.
      predictor_internal.cup_window_first_kickoff(fixture.window_id) as locks_at
      from public.bonus_cup_fixtures fixture
      join public.bonus_competitions competition
        on competition.id = fixture.competition_id
       and competition.game_key = 'predictor_cup'
      join public.bonus_competition_windows window_row
        on window_row.id = fixture.window_id
     -- Contract 102's predicate. `stage <> 'group'` would sweep in a `split`
     -- fixture, which is a group-phase table row with no Penalty Number.
     where fixture.stage in ('playoff', 'knockout')
       and fixture.winner_user_id is null
       and competition.published
  ),
  side as (
    select tie.competition_id,
           tie.window_id,
           tie.stage,
           tie.round_size,
           tie.bracket_slot,
           tie.tournament_id,
           tie.label,
           tie.locks_at,
           entrant.user_id,
           entrant.lane
      from tie
      cross join lateral (
        -- §8.3: lanes are fixed at round creation. The home side is the better
        -- seed and holds ODD; the away side holds EVEN.
        values (tie.home_user_id, 'odd'), (tie.away_user_id, 'even')
      ) as entrant(user_id, lane)
     where entrant.user_id is not null
  ),
  actionable as (
    select side.*,
           exists (
             select 1
               from public.bonus_cup_penalty_numbers pn
              where pn.window_id = side.window_id
                and pn.user_id = side.user_id) as submitted
      from side
     where side.locks_at is not null
       and side.locks_at > p_now
       -- Contract 194. A side that may not contest the tie cannot be helped by
       -- a Penalty Number, so it is not asked for one. An absent membership row
       -- reports `eligible`, so this suppresses nothing that exists today.
       and predictor_internal.cup_entrant_eligibility(
             side.competition_id, side.user_id) = 'eligible'
  )
  insert into public.player_action_items as item (
    user_id, action_key, action_type, priority, tournament_id, competition_id,
    deadline_at, expires_at, completed_at, context, updated_at)
  select actionable.user_id,
         'cup_penalty_number_due:' || actionable.competition_id::text
           || ':' || actionable.window_id::text,
         'cup_penalty_number_due',
         -- With the elimination class. See the header: the consequence is
         -- terminal when it bites, and there is no next week.
         1,
         actionable.tournament_id,
         actionable.competition_id,
         actionable.locks_at,
         actionable.locks_at,
         case when actionable.submitted then p_now else null end,
         -- `cup_window_id`, NOT `window_id`. The sweep's existing re-read
         -- resolves `window_id` against `bonus_competition_windows.locks_at`,
         -- which for a season Cup round is the first kickoff minus the game's
         -- buffer — earlier than the instant this deadline actually is. A
         -- different authority gets a different key.
         jsonb_build_object(
           'cup_window_id', actionable.window_id,
           'round_label', actionable.label,
           'stage', actionable.stage,
           'round_size', actionable.round_size,
           'bracket_slot', actionable.bracket_slot,
           -- The player's OWN lane. Never the opponent's identity, value, or
           -- whether they have submitted.
           'lane', actionable.lane),
         p_now
    from actionable
  -- IDEMPOTENT BY CONSTRUCTION, as contract 162 established: the same tie
  -- regenerates to the same key.
  on conflict (user_id, action_key) do update
    set deadline_at = excluded.deadline_at,
        expires_at = excluded.expires_at,
        -- Monotonic. A Penalty Number may be EDITED before the lock, bumping
        -- its version; editing a number is not undoing one, so a completed item
        -- must not reopen.
        completed_at = coalesce(item.completed_at, excluded.completed_at),
        context = excluded.context,
        updated_at = excluded.updated_at
  -- Nothing changed, so nothing is written and `updated_at` does not churn.
  where item.deadline_at is distinct from excluded.deadline_at
     or item.expires_at is distinct from excluded.expires_at
     or item.context is distinct from excluded.context
     or (item.completed_at is null and excluded.completed_at is not null);

  get diagnostics v_written = row_count;
  return v_written;
end;
$penalty$;

revoke all on function predictor_internal.generate_cup_penalty_number_actions(timestamptz)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.generate_cup_penalty_number_actions(timestamptz) is
  'Contract 195. One action per entrant per unsettled, unlocked Championship '
  'playoff or knockout tie, completed when a Penalty Number exists. Every '
  'condition is read from submit_cup_penalty_number''s own authorities, and the '
  'deadline is cup_window_first_kickoff rather than the window lock, which for '
  'a season round is earlier by the game definition''s buffer. Idempotent on '
  '(user_id, action_key).';

-- ---------------------------------------------------------------------------
-- The sweep learns the third authority.
--
-- Patched IN PLACE from `pg_get_functiondef`, not restated from a migration
-- file. Contract 194 learned that lesson the hard way: this function's body has
-- already been rewritten once in place, and a restatement from committed text
-- reverts whatever a later contract patched into it.
-- ---------------------------------------------------------------------------

do $sweep$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'predictor_internal.invalidate_expired_actions(timestamptz)'::regprocedure
  ) into v_definition;

  -- Safe to re-apply. `replace` is not idempotent here: the branch below ENDS
  -- with the same tail it anchors on, so a second run would append a second
  -- copy rather than failing. Silently doubling a predicate is worse than an
  -- error, so the applied state is recognised and skipped.
  if position('cup_window_id' in v_definition) > 0 then
    return;
  end if;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    '                  true))' || chr(10) ||
    '     );',
    '                  true))' || chr(10) ||
    '       -- CONTRACT 195. The Championship Penalty Number, whose deadline is' || chr(10) ||
    '       -- the window''s FIRST KICKOFF rather than the window''s lock. Those' || chr(10) ||
    '       -- are different instants: contract 161 writes a season Cup round''s' || chr(10) ||
    '       -- `locks_at` as the first kickoff MINUS the game definition''s' || chr(10) ||
    '       -- buffer, so the branch above would close this item while' || chr(10) ||
    '       -- `submit_cup_penalty_number` was still accepting a number.' || chr(10) ||
    '       --' || chr(10) ||
    '       -- Hence a different context key, and hence the first kickoff is' || chr(10) ||
    '       -- RE-DERIVED rather than trusted from `expires_at`: a kickoff moves,' || chr(10) ||
    '       -- and a stored deadline is a cache.' || chr(10) ||
    '       or exists (' || chr(10) ||
    '         select 1' || chr(10) ||
    '           from public.bonus_competition_windows cup_window' || chr(10) ||
    '          where cup_window.id = (item.context ->> ''cup_window_id'')::uuid' || chr(10) ||
    '            and coalesce(' || chr(10) ||
    '                  predictor_internal.cup_window_first_kickoff(cup_window.id)' || chr(10) ||
    '                    <= p_now,' || chr(10) ||
    '                  -- A first kickoff that has stopped being derivable closes' || chr(10) ||
    '                  -- the item, for contract 170''s reason: an action with no' || chr(10) ||
    '                  -- deadline in a game that has one can never be closed.' || chr(10) ||
    '                  true))' || chr(10) ||
    '     );'
  );

  if v_definition = v_original then
    raise exception 'Expected expiry-sweep tail was not found';
  end if;

  -- The existing bonus-window re-read must survive: it is what closes a Last
  -- Man Standing item, and contract 170's matchweek re-read must survive too.
  if position('window_row.id = (item.context ->> ''window_id'')::uuid' in v_definition) = 0
    or position('season_matchweek_lock_at(' in v_definition) = 0 then
    raise exception 'The expiry sweep lost an authority it already had';
  end if;

  execute v_definition;
end;
$sweep$;

-- ---------------------------------------------------------------------------
-- The driver runs it, in the same place and in the same order.
--
-- Patched in place for the same reason.
-- ---------------------------------------------------------------------------

do $driver$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.process_player_action_items()'::regprocedure
  ) into v_definition;

  -- Safe to re-apply, for the same reason: a second run would declare `v_cup`
  -- twice and the function would no longer compile.
  if position('generate_cup_penalty_number_actions' in v_definition) > 0 then
    return;
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  v_settled integer;',
    '  v_settled integer;' || chr(10) ||
    '  v_cup integer;'
  );
  if v_definition = v_original then
    raise exception 'Expected action driver declaration was not found';
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  v_settled := predictor_internal.generate_matchweek_settled_actions(v_now);',
    '  v_settled := predictor_internal.generate_matchweek_settled_actions(v_now);' || chr(10) ||
    '  v_cup := predictor_internal.generate_cup_penalty_number_actions(v_now);'
  );
  if v_definition = v_original then
    raise exception 'Expected action generator sequence was not found';
  end if;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    ''matchweek_settled_actions_written'', v_settled,',
    '    ''matchweek_settled_actions_written'', v_settled,' || chr(10) ||
    '    ''cup_penalty_number_actions_written'', v_cup,'
  );
  if v_definition = v_original then
    raise exception 'Expected action driver report shape was not found';
  end if;

  -- The sweep must still run LAST, so an item the generators have just
  -- refreshed is judged on the deadline they refreshed it to. Contract 162 put
  -- it there and this contract inserts above it, not below.
  if position('generate_cup_penalty_number_actions' in v_definition)
     > position('invalidate_expired_actions' in v_definition) then
    raise exception 'The expiry sweep must run after every generator';
  end if;

  execute v_definition;
end;
$driver$;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_generator text := pg_get_functiondef(
    'predictor_internal.generate_cup_penalty_number_actions(timestamptz)'::regprocedure);
  v_sweep text := pg_get_functiondef(
    'predictor_internal.invalidate_expired_actions(timestamptz)'::regprocedure);
  v_driver text := pg_get_functiondef(
    'public.process_player_action_items()'::regprocedure);
  -- The generator with its own explanatory comments removed. Prose is not the
  -- contract, and a guard that searched the whole body would match the comment
  -- explaining WHY `stage <> 'group'` is wrong and refuse a correct function.
  -- That happened on the first apply of this migration, which is why it is
  -- written down here rather than discovered again.
  v_code text := (
    select string_agg(source_line, chr(10))
      from regexp_split_to_table(pg_get_functiondef(
             'predictor_internal.generate_cup_penalty_number_actions(timestamptz)'::regprocedure),
           chr(10)) as source_line
     where btrim(source_line) not like '--%');
begin
  -- Every declared action type now has a generator, which is the contract.
  if v_driver !~ 'generate_cup_penalty_number_actions' then
    raise exception 'The action driver must run the Championship generator';
  end if;

  -- The deadline is the first kickoff, from the one authority that derives it.
  if v_code !~ 'cup_window_first_kickoff' then
    raise exception 'The Penalty Number deadline must be the derived first kickoff';
  end if;

  -- And NOT the window lock, which is a different instant.
  if position('window_row.locks_at' in v_code) > 0 then
    raise exception 'The Penalty Number deadline must not be the window lock';
  end if;

  -- Contract 102's stage predicate, not the shorthand it replaced.
  if position('stage <> ''group''' in v_code) > 0
    or position('stage in (''playoff'', ''knockout'')' in v_code) = 0 then
    raise exception 'The generator must not treat every non-group stage as knockout';
  end if;

  -- A different context key, because it answers to a different authority.
  if v_code !~ 'cup_window_id' or v_sweep !~ 'cup_window_id' then
    raise exception 'The Championship item must carry its own authority key';
  end if;

  -- It writes exactly one relation, and it is the inbox.
  if v_code ~ 'insert into public\.bonus_cup_penalty_numbers'
     or v_code ~ 'update public\.bonus_cup_fixtures'
     or v_code ~ 'update public\.bonus_competition_entrants' then
    raise exception 'A generator may not write a Penalty Number or settle a tie';
  end if;

  -- No opponent disclosure. The item is the player's own lane and coordinates.
  if v_code ~ 'opponent' then
    raise exception 'The action item must not carry the opponent';
  end if;

  -- Unreachable from any API role. A function that can write an action item is
  -- a function that can manufacture a deadline.
  if exists (
    select 1 from information_schema.role_routine_grants
     where routine_schema = 'predictor_internal'
       and routine_name = 'generate_cup_penalty_number_actions'
       and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then
    raise exception 'The Championship generator must be unreachable from API roles';
  end if;
end;
$$;

commit;
