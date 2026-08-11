-- Contract 173 — the action centre's third generator: a matchweek that settled.
--
-- ---------------------------------------------------------------------------
-- THIS FILLS A SLOT THE SCHEMA ALREADY DECLARED
-- ---------------------------------------------------------------------------
--
-- `player_action_items_type_allowed` has permitted `matchweek_settled` since
-- contract 162, and the `expires_at` column carries contract 162's own comment:
--
--     -- When the item stops being worth showing even if nothing happened. A
--     -- settled matchweek is interesting for a week, not for ever.
--
-- Measured: nothing writes that type. `MIG-UI-14` names the feed as "picks
-- due, **a matchweek settled**, a private-league invite, a game consequence",
-- so the rule is the requirement's own and is not invented here. Contract 162
-- wrote the picks-due generator, contract 170 wrote the matchweek card's, and
-- this is the third of the four.
--
-- ---------------------------------------------------------------------------
-- THE TRAP THIS GENERATOR HAD TO AVOID, WHICH IS THE INTERESTING PART
-- ---------------------------------------------------------------------------
--
-- Contract 170's expiry sweep closes any open item whose `context ->> 'round_id'`
-- names a competition round that HAS LOCKED. That is exactly right for a card
-- awaiting predictions: a locked round can no longer be played.
--
-- A settled matchweek's round is locked BY DEFINITION — settlement happens
-- after the football. So a recap that recorded its round under the key
-- `round_id` would be invalidated by the very next sweep, fifteen minutes
-- after it was generated, for ever, and the inbox would show nothing while
-- both the generator and the sweep behaved exactly as written.
--
-- The context therefore records `settled_round_id`, and `window_id` is
-- likewise absent. This is stated here and asserted at the foot of the
-- migration, because it is a coupling between two functions that no type
-- system expresses: the sweep's authority is a magic string in a jsonb path.
--
-- DRIVEN, NOT REASONED. On a disposable PostgreSQL 16.13, loading contract
-- 162's committed table text and contract 170's committed sweep text beside
-- this generator, with a lock authority stubbed to the one behaviour the case
-- depends on — a settled matchweek's round has locked:
--
--     generated                                    1
--     swept                                        0
--     item open after the sweep                 true
--
--     ... then the SAME item with its key renamed to `round_id`:
--     swept again                                  1
--     item open after the sweep                FALSE
--
-- The counterfactual is the point. One word of difference in a jsonb key
-- decides whether this feature exists at all, and nothing but running it says
-- so. The same drive also established that a second run writes 0 and leaves
-- one row, that a matchweek settled eighty days ago writes 0 rather than
-- posting a backlog, and that after the sweep closes an expired recap a later
-- run does not bring it back.
--
-- ---------------------------------------------------------------------------
-- WHAT DECIDES THE ITEM'S LIFE
-- ---------------------------------------------------------------------------
--
--   deadline_at   NULL. There is nothing to do by a time. This also keeps the
--                 recap out of contract 163's reminder scheduler by
--                 construction — that function selects `deadline_at is not
--                 null` — so a settled matchweek never becomes an email. A
--                 recap is worth a badge and is not worth a notification.
--   expires_at    settled_at + 7 days, which is contract 162's stated
--                 intention made executable. The existing sweep enforces it;
--                 no new expiry path is added.
--   completed_at  NEVER SET. A recap is not completed by doing anything, and
--                 setting it on generation would make the item arrive already
--                 finished — invisible to a read that filters on open items.
--                 The player disposes of it through contract 162's own
--                 `mark_actions_seen` / `dismiss_action`, which write the
--                 SEPARATE state table and therefore survive regeneration.
--
-- Only matchweeks settled within the last seven days are considered, so the
-- first run on a season with thirty-eight settled matchweeks does not post
-- thirty-eight recaps: an item that would already have expired is never
-- written. That bound is the same seven days as `expires_at`, deliberately —
-- two different windows would eventually disagree.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no table, adds no column and grants nothing to a browser role.
-- It recomputes no points: every figure in the context comes from
-- `season_matchweek_scores`, the banked authority, so a recap cannot disagree
-- with the standings. It reads no other player's row, writes no prediction,
-- moves no lock and settles nothing.

begin;

-- ---------------------------------------------------------------------------
-- The generator.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.generate_matchweek_settled_actions(
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $settled$
declare
  v_written integer := 0;
begin
  with recent as (
    select
      score.tournament_id,
      score.competition_round_id as round_id,
      entry.user_id,
      entry.game_competition_id as competition_id,
      round.ordinal,
      round.label,
      score.points,
      score.fixtures_scored,
      score.joker_applied,
      score.settled_at
      from public.season_matchweek_scores score
      join public.entries entry
        on entry.id = score.entry_id
       -- Same-reference, as every season read in this repository is: an entry
       -- and its matchweek score belong to one competition season.
       and entry.tournament_id = score.tournament_id
      join public.competition_rounds round
        on round.id = score.competition_round_id
       and round.tournament_id = score.tournament_id
     where score.settled_at <= p_now
       -- See the header: the same seven days the item expires after, so a
       -- backlog is never posted and then immediately swept.
       and score.settled_at > p_now - interval '7 days'
       -- A player who has left the game keeps the recap of the matchweeks they
       -- played; `entries` is the record that they played it. Nothing here
       -- reads a membership state, deliberately.
  )
  insert into public.player_action_items as item (
    user_id, action_key, action_type, priority, tournament_id, competition_id,
    deadline_at, expires_at, context, updated_at)
  select recent.user_id,
         'matchweek_settled:' || recent.tournament_id::text
           || ':' || recent.round_id::text,
         'matchweek_settled',
         -- The lowest priority the constraint permits. A recap is news; a pick
         -- due is a deadline. Contract 162 gives a Last Man Standing pick 1 and
         -- contract 170 gives the card 2, and nothing that merely happened may
         -- outrank something that must be done.
         5,
         recent.tournament_id,
         recent.competition_id,
         -- NULL. Nothing is due, and this is what keeps it out of the reminder
         -- scheduler.
         null,
         recent.settled_at + interval '7 days',
         jsonb_build_object(
           -- NOT `round_id`. See the header: contract 170's sweep invalidates
           -- an open item whose `round_id` names a locked round, and a settled
           -- matchweek's round is always locked.
           'settled_round_id', recent.round_id,
           'ordinal', recent.ordinal,
           'round_label', recent.label,
           'points', recent.points,
           'fixtures_scored', recent.fixtures_scored,
           'joker_applied', recent.joker_applied,
           'settled_at', recent.settled_at),
         p_now
    from recent
  on conflict (user_id, action_key) do update
    set expires_at = excluded.expires_at,
        context = excluded.context,
        updated_at = excluded.updated_at
  -- Never resurrect. An item the sweep has closed stays closed even if the
  -- matchweek is rescored later, because reopening it would put a week-old
  -- recap back at the top of an inbox the player has already cleared.
  where item.invalidated_at is null
    and item.completed_at is null
    and (item.expires_at is distinct from excluded.expires_at
      or item.context is distinct from excluded.context);

  get diagnostics v_written = row_count;
  return v_written;
end;
$settled$;

revoke all on function predictor_internal.generate_matchweek_settled_actions(timestamptz)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.generate_matchweek_settled_actions(timestamptz) is
  'Contract 173. One recap per entry per matchweek settled in the last seven '
  'days, expiring seven days after settlement, with no deadline so it never '
  'becomes a reminder. Every figure comes from season_matchweek_scores; '
  'nothing is recomputed. Idempotent on (user_id, action_key).';

-- ---------------------------------------------------------------------------
-- The driver runs all three generators.
--
-- Redefined from its committed text in `20260811210000_matchweek_prediction_
-- actions.sql` with ONE call added and the sweep left last. Verified by the
-- assertions below rather than by reading, which is the control contract 124
-- established after a hand-copied tail drifted.
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
  v_settled integer;
  v_closed integer;
begin
  v_lms := predictor_internal.generate_lms_pick_actions(v_now);
  v_matchweek := predictor_internal.generate_matchweek_prediction_actions(v_now);
  v_settled := predictor_internal.generate_matchweek_settled_actions(v_now);
  -- The sweep runs LAST, so an item the generators have just refreshed is
  -- judged on the deadline they refreshed it to rather than on the previous
  -- run's copy.
  v_closed := predictor_internal.invalidate_expired_actions(v_now);

  return jsonb_build_object(
    'ran_at', v_now,
    'lms_pick_actions_written', v_lms,
    'matchweek_prediction_actions_written', v_matchweek,
    'matchweek_settled_actions_written', v_settled,
    'actions_invalidated', v_closed);
end;
$driver$;

revoke all on function public.process_player_action_items() from public, anon, authenticated;
grant execute on function public.process_player_action_items() to service_role;

comment on function public.process_player_action_items() is
  'Contracts 162, 170 and 173. Runs the Last Man Standing, matchweek-card and '
  'matchweek-settled generators and then the expiry sweep, reporting each '
  'separately. service_role only, and driven by the contract 172 job.';

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $assertions$
declare
  v_generator text := pg_catalog.pg_get_functiondef(
    to_regprocedure('predictor_internal.generate_matchweek_settled_actions(timestamp with time zone)'));
  v_driver text := pg_catalog.pg_get_functiondef(
    to_regprocedure('public.process_player_action_items()'));
  v_sweep text := pg_catalog.pg_get_functiondef(
    to_regprocedure('predictor_internal.invalidate_expired_actions(timestamp with time zone)'));
begin
  -- ---- THE COUPLING THE HEADER IS ABOUT --------------------------------
  --
  -- The sweep reads these two jsonb keys as authorities. If the recap ever
  -- writes either of them it will be invalidated the moment it is generated,
  -- silently, and the only symptom will be an empty inbox.
  if v_sweep !~ 'round_id' then
    raise exception
      'The expiry sweep no longer reads context->>round_id; contract 173''s '
      'reason for naming its own key settled_round_id must be re-checked';
  end if;

  if v_generator ~ '''round_id''' or v_generator ~ '''window_id''' then
    raise exception
      'The settled-matchweek generator writes a context key the expiry sweep '
      'treats as a lock authority; it would close its own items';
  end if;

  if v_generator !~ 'settled_round_id' then
    raise exception 'The settled-matchweek generator does not record its round';
  end if;

  -- ---- IT NEVER BECOMES A DEADLINE OR AN EMAIL -------------------------
  if v_generator ~ 'deadline_at\s*=\s*excluded' then
    raise exception 'The settled-matchweek generator writes a deadline';
  end if;

  -- ---- IT NEVER ARRIVES ALREADY COMPLETED ------------------------------
  if v_generator ~ 'completed_at' and v_generator !~ 'item\.completed_at is null' then
    raise exception 'The settled-matchweek generator sets completed_at';
  end if;

  -- ---- THE DRIVER STILL RUNS EVERYTHING IT USED TO ---------------------
  if v_driver !~ 'generate_lms_pick_actions'
     or v_driver !~ 'generate_matchweek_prediction_actions'
     or v_driver !~ 'generate_matchweek_settled_actions'
     or v_driver !~ 'invalidate_expired_actions' then
    raise exception 'The redefined driver dropped one of its four calls';
  end if;

  -- The sweep is last. Compared by POSITION rather than by presence, because
  -- "all four are called" is true of an order that judges an item on the
  -- previous run's deadline.
  if position('invalidate_expired_actions' in v_driver)
       < position('generate_matchweek_settled_actions' in v_driver) then
    raise exception 'The expiry sweep no longer runs after the generators';
  end if;

  -- ---- STILL NOT REACHABLE BY A BROWSER --------------------------------
  if exists (
    select 1
      from pg_catalog.pg_proc proc
      cross join pg_catalog.aclexplode(proc.proacl) entry
      left join pg_catalog.pg_roles grantee on grantee.oid = entry.grantee
     where proc.oid in (
             to_regprocedure('public.process_player_action_items()'),
             to_regprocedure('predictor_internal.generate_matchweek_settled_actions(timestamp with time zone)'))
       and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'An action generator became reachable by a browser role';
  end if;

  -- ---- THE TYPE IT WRITES IS ONE THE SCHEMA ALREADY ALLOWED ------------
  if not exists (
    select 1
      from pg_catalog.pg_constraint constraint_row
     where constraint_row.conname = 'player_action_items_type_allowed'
       and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%matchweek_settled%'
  ) then
    raise exception 'matchweek_settled is not in the permitted action vocabulary';
  end if;
end;
$assertions$;

commit;
