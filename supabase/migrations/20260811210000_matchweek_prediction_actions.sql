-- Contract 170 — the action centre learns about the matchweek card.
--
-- ---------------------------------------------------------------------------
-- WHAT IS MISSING
-- ---------------------------------------------------------------------------
--
-- Contract 162 built the action centre and wrote ONE generator, for a Last Man
-- Standing pick. That was the right first one — a missed pick eliminates the
-- entrant — but it leaves the inbox answering a question nobody asks. A player
-- in a weekly season plays the Match Predictor every week and Last Man Standing
-- only if they joined one, so for most players the action centre is empty in
-- exactly the week they most need reminding.
--
-- This is the generator for the matchweek card, and it is the last one this
-- contract can write: the Championship's own action is a fixture in a bracket
-- that does not exist yet for a season (see `CUP-002` in the accepted
-- requirements register), so writing its generator now would be writing against
-- a shape nobody has decided.
--
-- ---------------------------------------------------------------------------
-- WHEN A MATCHWEEK IS AN ACTION
-- ---------------------------------------------------------------------------
--
-- Both ends come from authorities that already own them, not from new rules:
--
--   * it has OPENED — `competition_rounds.window_opens_at`, contract 113's
--     stored play window, refreshed by contract 123 when the fixtures move;
--   * it has not LOCKED — `predictor_internal.season_matchweek_lock_at`, the
--     same derivation the matchweek scheduler and the Last Man Standing
--     successor scheduler use, with the game definition's own buffer.
--
-- A round with no derivable lock is not due. `season_matchweek_lock_at` returns
-- null when a kickoff is unconfirmed, and null is "not derivable" rather than
-- "no deadline" — an action with no deadline in a game that has one would be an
-- action nothing could ever close.
--
-- The entry is selected by PROPERTY rather than by name, copying the matchweek
-- scheduler exactly: a game whose `lock_scope` is `matchweek` and which holds a
-- prediction card. That is the Main Predictor today. Last Man Standing is also
-- matchweek-scoped and holds no card, so it is excluded by the same test that
-- includes the Predictor, rather than by naming either.
--
-- ---------------------------------------------------------------------------
-- WHEN IT IS DONE, AND THE ONE JUDGEMENT IN THIS CONTRACT
-- ---------------------------------------------------------------------------
--
-- The item completes when the card is COMPLETE — a prediction for every fixture
-- in the round — and its context carries `predicted` and `fixtures` so a
-- surface can say "6 of 10" rather than "incomplete".
--
-- Contract 82 established that a partial card is legitimate: it submits exactly
-- what the player entered and the blanks score nothing. So a player may
-- deliberately leave a fixture blank, and for them this item would stay open
-- until the matchweek locks.
--
-- That is the correct behaviour and not an oversight, because contract 162
-- already gave them the control: DISMISS survives regeneration, by construction,
-- since read state lives in a second table the generator never writes. A player
-- who means to leave a blank dismisses the item once and the job does not bring
-- it back. Completing the item on the first prediction instead would be worse —
-- it would tell a player who predicted one fixture of ten that they were done.
--
-- ---------------------------------------------------------------------------
-- THE SWEEP HAD TO LEARN A SECOND AUTHORITY
-- ---------------------------------------------------------------------------
--
-- Contract 162's expiry sweep re-reads the round's lock from
-- `bonus_competition_windows`, keyed on `context ->> 'window_id'`, because a
-- stored `expires_at` is a COPY and a lock moves. A matchweek has no bonus
-- window: its authority is `competition_rounds` and the derived lock.
--
-- So the sweep gains a second re-read rather than relying on the stored copy
-- for these items. Leaving it on the copy would reintroduce the exact defect
-- `211_action_centre.sql` was written to catch — contracts 117 and 119
-- reschedule a fixture and drag the matchweek's lock EARLIER, the generator
-- stops selecting the now-locked round, and nothing closes the item.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no table, adds no grant a browser can reach, and schedules no job:
-- `process_player_action_items` remains `service_role`-only and remains
-- unscheduled by any migration. It writes no prediction, moves no lock and
-- settles nothing.

begin;

-- ---------------------------------------------------------------------------
-- The matchweek generator.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.generate_matchweek_prediction_actions(
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $matchweek$
declare
  v_written integer := 0;
begin
  with due as (
    select
      entry.user_id,
      entry.id as entry_id,
      entry.tournament_id,
      entry.game_competition_id as competition_id,
      round.id as round_id,
      round.ordinal,
      round.label,
      predictor_internal.season_matchweek_lock_at(
        entry.tournament_id, round.id, definition.buffer_minutes) as locks_at,
      (select count(*)::integer
         from public.season_fixtures fixture
        where fixture.tournament_id = entry.tournament_id
          and fixture.competition_round_id = round.id) as fixtures,
      (select count(*)::integer
         from public.season_predictions prediction
         join public.season_fixtures fixture
           on fixture.id = prediction.season_fixture_id
        where prediction.entry_id = entry.id
          and fixture.competition_round_id = round.id) as predicted
      from public.entries entry
      join public.bonus_competitions game
        on game.tournament_id = entry.tournament_id
       and game.id = entry.game_competition_id
      join public.game_definitions definition
        on definition.game_key = game.game_key
      join public.competition_rounds round
        on round.tournament_id = entry.tournament_id
     -- The same property test the matchweek scheduler uses: a matchweek-scoped
     -- game that holds a card. Last Man Standing is matchweek-scoped and holds
     -- none, so it is excluded by the test that includes the Predictor.
     where definition.lock_scope = 'matchweek'
       and definition.requires_prediction_entry
       and game.published
       -- OPEN at both ends, from the two authorities that own them.
       and round.window_opens_at is not null
       and round.window_opens_at <= p_now
  ),
  actionable as (
    select * from due
     where due.locks_at is not null
       and due.locks_at > p_now
       -- A round with no fixtures is not a card. It is also the state a season
       -- sits in before its calendar imports, and asking a player to predict
       -- nothing would be the action centre's first false positive.
       and due.fixtures > 0
  )
  insert into public.player_action_items as item (
    user_id, action_key, action_type, priority, tournament_id, competition_id,
    deadline_at, expires_at, completed_at, context, updated_at)
  select actionable.user_id,
         'matchweek_predictions_due:' || actionable.tournament_id::text
           || ':' || actionable.round_id::text,
         'matchweek_predictions_due',
         -- Below a Last Man Standing pick, which eliminates. A missed matchweek
         -- costs points and the player is still in the competition next week.
         2,
         actionable.tournament_id,
         actionable.competition_id,
         actionable.locks_at,
         actionable.locks_at,
         case when actionable.predicted >= actionable.fixtures then p_now else null end,
         jsonb_build_object(
           'round_id', actionable.round_id,
           'ordinal', actionable.ordinal,
           'round_label', actionable.label,
           'fixtures', actionable.fixtures,
           'predicted', actionable.predicted),
         p_now
    from actionable
  on conflict (user_id, action_key) do update
    set deadline_at = excluded.deadline_at,
        expires_at = excluded.expires_at,
        -- Monotonic, as contract 162 established: a completed card that is
        -- later edited must not reopen the item. Editing a prediction is not
        -- undoing one.
        completed_at = coalesce(item.completed_at, excluded.completed_at),
        context = excluded.context,
        updated_at = excluded.updated_at
  where item.deadline_at is distinct from excluded.deadline_at
     or item.expires_at is distinct from excluded.expires_at
     or item.context is distinct from excluded.context
     or (item.completed_at is null and excluded.completed_at is not null);

  get diagnostics v_written = row_count;
  return v_written;
end;
$matchweek$;

revoke all on function predictor_internal.generate_matchweek_prediction_actions(timestamptz)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.generate_matchweek_prediction_actions(timestamptz) is
  'Contract 170. One action per entry per OPEN, unlocked matchweek holding at '
  'least one fixture, completed when the card is complete. Both ends of "open" '
  'come from the authorities that own them: competition_rounds.window_opens_at '
  'and season_matchweek_lock_at. Idempotent on (user_id, action_key).';

-- ---------------------------------------------------------------------------
-- The sweep gains the matchweek's authority.
--
-- Redefined from its committed text in `20260811130000_action_centre.sql`. The
-- bonus-window re-read is carried across unchanged; a second is added for items
-- whose authority is a competition round.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.invalidate_expired_actions(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $expire$
declare
  v_closed integer := 0;
begin
  update public.player_action_items item
     set invalidated_at = p_now,
         updated_at = p_now
   where item.completed_at is null
     and item.invalidated_at is null
     and (
       -- The fast path: the stored expiry has passed.
       (item.expires_at is not null and item.expires_at <= p_now)
       -- AND THE AUTHORITY, re-read. `expires_at` is a COPY of the round's lock
       -- taken when the item was generated, and a lock MOVES: contracts 117 and
       -- 119 reschedule a fixture and drag the matchweek's lock with it. If it
       -- moves EARLIER, the copy is stale, the generator no longer selects the
       -- now-locked round, and nothing would ever close the item — it would ask
       -- for a pick that can no longer be made, for ever.
       --
       -- Found by `211_action_centre.sql`, which locked a round and watched the
       -- sweep do nothing. A stored deadline is a cache; the window is the fact.
       or exists (
         select 1
           from public.bonus_competition_windows window_row
          where window_row.id = (item.context ->> 'window_id')::uuid
            and window_row.locks_at is not null
            and window_row.locks_at <= p_now)
       -- CONTRACT 170. The same argument for the matchweek card, whose
       -- authority is a competition round and a derived instant rather than a
       -- bonus window. The lock is re-derived rather than read from the item,
       -- for the reason above: contract 123 refreshes a stale window precisely
       -- because the kickoffs it is derived from move.
       or exists (
         select 1
           from public.competition_rounds round
           join public.bonus_competitions game
             on game.id = item.competition_id
           join public.game_definitions definition
             on definition.game_key = game.game_key
          where round.id = (item.context ->> 'round_id')::uuid
            and round.tournament_id = item.tournament_id
            and coalesce(
                  predictor_internal.season_matchweek_lock_at(
                    round.tournament_id, round.id, definition.buffer_minutes)
                    <= p_now,
                  -- A lock that has stopped being derivable — a fixture whose
                  -- kickoff was withdrawn — closes the item too. Leaving it open
                  -- would ask for a card against a matchweek with no deadline,
                  -- and contract 123 queues that case for an owner rather than
                  -- resolving it silently.
                  true))
     );

  get diagnostics v_closed = row_count;
  return v_closed;
end;
$expire$;

revoke all on function predictor_internal.invalidate_expired_actions(timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The driver runs both generators and says so separately.
--
-- Separately, because one number for two generators is a number that cannot
-- tell you which of them stopped — the defect contract 135 found in the
-- provider poll and contract 162 already avoided.
-- ---------------------------------------------------------------------------

create or replace function public.process_player_action_items()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $driver$
declare
  v_now timestamptz := now();
  v_lms integer;
  v_matchweek integer;
  v_closed integer;
begin
  v_lms := predictor_internal.generate_lms_pick_actions(v_now);
  v_matchweek := predictor_internal.generate_matchweek_prediction_actions(v_now);
  -- The sweep runs LAST, so an item the generators have just refreshed is
  -- judged on the deadline they refreshed it to rather than on the previous
  -- run's copy.
  v_closed := predictor_internal.invalidate_expired_actions(v_now);

  return jsonb_build_object(
    'ran_at', v_now,
    'lms_pick_actions_written', v_lms,
    'matchweek_prediction_actions_written', v_matchweek,
    'actions_invalidated', v_closed);
end;
$driver$;

revoke all on function public.process_player_action_items() from public, anon, authenticated;
grant execute on function public.process_player_action_items() to service_role;

comment on function public.process_player_action_items() is
  'Contract 162, extended by contract 170. Regenerates the action inbox and '
  'closes what has expired, reporting each generator separately. service_role '
  'only, and scheduled by no migration.';

commit;

-- ---------------------------------------------------------------------------
-- What must be true of this migration.
-- ---------------------------------------------------------------------------

do $assert$
declare
  v_generator text := pg_catalog.pg_get_functiondef(
    'predictor_internal.generate_matchweek_prediction_actions(timestamptz)'::regprocedure);
  v_sweep text := pg_catalog.pg_get_functiondef(
    'predictor_internal.invalidate_expired_actions(timestamptz)'::regprocedure);
  v_driver text := pg_catalog.pg_get_functiondef(
    'public.process_player_action_items()'::regprocedure);
begin
  -- The generator names no game. Selecting the Predictor by name would silently
  -- exclude the next matchweek-scoped card the platform adds.
  if v_generator ~ 'main_predictor' or v_generator ~ 'last_man_standing' then
    raise exception 'The matchweek generator selects a game by name rather than by property';
  end if;

  if v_generator !~ 'lock_scope' or v_generator !~ 'requires_prediction_entry' then
    raise exception 'The matchweek generator does not select by lock scope and card';
  end if;

  -- Both ends of "open" come from their own authority.
  if v_generator !~ 'window_opens_at' or v_generator !~ 'season_matchweek_lock_at' then
    raise exception 'The matchweek generator does not use the stored window and the derived lock';
  end if;

  -- THE ASSERTION THIS MIGRATION EXISTS FOR BESIDE THE GENERATOR. The sweep
  -- must re-read the matchweek authority rather than trust the stored copy.
  if v_sweep !~ 'season_matchweek_lock_at' then
    raise exception
      'The expiry sweep still trusts the stored expiry for a matchweek item, '
      'which is the defect 211_action_centre.sql exists to catch';
  end if;

  -- And it must not have lost the bonus-window re-read it already had.
  if v_sweep !~ 'bonus_competition_windows' then
    raise exception 'The expiry sweep lost its Last Man Standing re-read';
  end if;

  -- Two generators, reported separately.
  if v_driver !~ 'matchweek_prediction_actions_written'
     or v_driver !~ 'lms_pick_actions_written' then
    raise exception 'The driver does not report both generators separately';
  end if;

  -- The sweep runs after the generators.
  if pg_catalog.strpos(v_driver, 'invalidate_expired_actions')
     < pg_catalog.strpos(v_driver, 'generate_matchweek_prediction_actions') then
    raise exception 'The sweep runs before the generator it must judge after';
  end if;

  -- No browser gains the driver.
  if pg_catalog.has_function_privilege(
       'authenticated', 'public.process_player_action_items()', 'execute') then
    raise exception 'The action driver is reachable by a browser role';
  end if;
end;
$assert$;
