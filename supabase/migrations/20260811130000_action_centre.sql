-- ---------------------------------------------------------------------------
-- Contract 162 — MIG-UI-14: the action centre, and the read state nothing kept.
--
-- ---------------------------------------------------------------------------
-- WHAT THE REGISTER'S OWN AUDIT FOUND, AND WHAT IT LEAVES TO BUILD
-- ---------------------------------------------------------------------------
--
-- `MIG-UI-14` was audited on 11 August 2026 rather than guessed at, and the
-- audit's finding is the design constraint here: the CONTENT of a notification
-- is already derivable — the global Play inbox computes what is due, and
-- contracts 149 to 151 supply matchweek consequences — but **nothing stores
-- what a player has already seen**. The Hub's "since you were last here" marker
-- is `localStorage` and is explicitly not an authority. So the AppBar carries
-- no notification control at all, deliberately: a bell over an inbox with no
-- read state would either shout for ever or forget on a second device.
--
-- The gap is therefore read state, and an identity stable enough to carry it.
-- That is what this contract adds. It does NOT add a second computation of what
-- is due: the generators below derive an item from the SAME authorities the
-- surfaces already use, and where a fact has an owner, the owner supplies it.
--
-- ---------------------------------------------------------------------------
-- THE TWO TABLES, AND WHY THEY ARE TWO
-- ---------------------------------------------------------------------------
--
-- `player_action_items` is what the SERVER says is outstanding. It is
-- regenerated, and regeneration must be free to correct itself: a deadline
-- moves when contract 117 reschedules a fixture, and an item must move with it.
--
-- `player_action_state` is what the PLAYER did about it — seen, dismissed. That
-- must survive regeneration, or every regeneration would un-read the inbox,
-- which is the "shouts for ever" failure the audit named.
--
-- One table could not do both. An upsert that rewrites the row would either
-- clobber the read state or refuse to correct the deadline, and there is no
-- third option. So the item is the server's and the state is the player's, and
-- regeneration touches only the first.
--
-- ---------------------------------------------------------------------------
-- STABLE IDENTITY: `action_key`
-- ---------------------------------------------------------------------------
--
-- The identity is `(user_id, action_key)`, where `action_key` is derived from
-- WHAT THE ACTION IS rather than from when it was generated — for example
-- `lms_pick_due:<competition_id>:<window_id>`. Two consequences, and both are
-- the requirement:
--
--   * regeneration is idempotent by construction. Running the generator twice
--     produces the same key and therefore the same row, so a retried job cannot
--     duplicate an item. This is `on conflict do update`, not `insert`;
--   * an item marked seen on a phone is the same item on a laptop, because the
--     key does not encode the device, the session or the generation.
--
-- A key that included a timestamp would satisfy neither, and is the obvious
-- wrong answer that a surrogate id invites.
--
-- ---------------------------------------------------------------------------
-- THE CLIENT MANUFACTURES NOTHING
-- ---------------------------------------------------------------------------
--
-- The requirement is explicit: the client must not manufacture deadlines or
-- security-sensitive eligibility. So:
--
--   * `deadline_at` is written only by the generators, from
--     `bonus_competition_windows.locks_at` and the season matchweek lock — the
--     authorities that already own locking. There is no writer a browser can
--     reach that sets it;
--   * the only two commands a browser gets are "mark seen" and "dismiss", and
--     both write ONLY to `player_action_state`, and only for `auth.uid()`;
--   * `completed` and `invalidated` are the SERVER's, derived at regeneration
--     from whether the underlying thing was actually done. A player dismissing
--     an item does not complete it, and the two are separate columns for
--     exactly that reason: "I have seen this and do not want to be told again"
--     is not "I have made my pick".
--
-- Additive: two new tables, one internal generator per game, one regeneration
-- driver, one read and two commands. No existing relation, policy, trigger,
-- grant or function is altered.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. What the server says is outstanding
-- ===========================================================================

create table if not exists public.player_action_items (
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Derived from what the action IS, never from when it was made. See the
  -- header: this is what makes regeneration idempotent and read state portable.
  action_key text not null,

  action_type text not null,

  -- Lower sorts first. A small fixed vocabulary rather than a free integer, so
  -- two generators cannot disagree about what "important" means.
  priority smallint not null,

  -- The season is REQUIRED and the game is not. Every action type in the
  -- vocabulary below belongs to a season — including `league_invitation`, since
  -- a league hangs off one — and an action with no season could not be routed
  -- anywhere on a multi-competition platform. It is also the repository's
  -- standing invariant, pinned by the Stage C tournament_id inventory: every
  -- direct `tournament_id` is a non-null uuid.
  --
  -- The GAME is nullable because a league invitation belongs to a competition
  -- season and to no game competition at all.
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  competition_id uuid references public.bonus_competitions(id) on delete cascade,

  -- Written by a generator, from a lock authority. Never by a browser.
  deadline_at timestamptz,

  -- When the item stops being worth showing even if nothing happened. A settled
  -- matchweek is interesting for a week, not for ever.
  expires_at timestamptz,

  -- THE SERVER'S TWO VERDICTS, and neither is the player's.
  --   completed  — the underlying thing was done (the pick was made).
  --   invalidated — the item can no longer be acted on and was not done (the
  --                 deadline passed, the competition was withdrawn).
  completed_at timestamptz,
  invalidated_at timestamptz,

  -- Free-form facts the surface renders. Never a rule, never a deadline, and
  -- never presentation copy: the same reasoning contract 156 used for storing
  -- facts rather than a formula.
  context jsonb not null default '{}'::jsonb,

  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, action_key),

  constraint player_action_items_key_shape
    check (char_length(btrim(action_key)) between 3 and 200),

  constraint player_action_items_type_allowed
    check (action_type in (
      'matchweek_predictions_due',
      'lms_pick_due',
      'cup_penalty_number_due',
      'matchweek_settled',
      'game_consequence',
      'league_invitation')),

  constraint player_action_items_priority_range
    check (priority between 1 and 5),

  -- An item is completed or invalidated, never both. Written without a null
  -- hole: `num_nonnulls` counts, so the constraint is decidable for every
  -- combination rather than evaluating to unknown when one side is null, which
  -- a `not (a is not null and b is not null)` spelling would do correctly and a
  -- `a is null or b is null` spelling would too — but neither reads as the
  -- rule, and this one does.
  constraint player_action_items_one_terminal_state
    check (num_nonnulls(completed_at, invalidated_at) <= 1)
);

create index if not exists player_action_items_user_open_idx
  on public.player_action_items (user_id, priority, deadline_at)
  where completed_at is null and invalidated_at is null;

alter table public.player_action_items enable row level security;
revoke all on table public.player_action_items from public, anon, authenticated;

comment on table public.player_action_items is
  'Contract 162. Server-derived outstanding actions, keyed on what the action '
  'is so regeneration is idempotent. Deadlines come from the lock authorities '
  'and never from a client. Read through get_my_actions.';

-- ===========================================================================
-- 2. What the player did about it
-- ===========================================================================
--
-- A separate table so regeneration cannot un-read the inbox. There is no
-- foreign key to `player_action_items`, and that is deliberate rather than an
-- omission: state may legitimately outlive the item. An item that is
-- regenerated after a fixture is rescheduled comes back with the same key, and
-- the player's "I have seen this" should come back with it rather than being
-- cascaded away in between.

create table if not exists public.player_action_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,

  seen_at timestamptz,
  dismissed_at timestamptz,

  updated_at timestamptz not null default now(),

  primary key (user_id, action_key),

  constraint player_action_state_key_shape
    check (char_length(btrim(action_key)) between 3 and 200),

  -- At least one of them, or the row says nothing. A row that is neither seen
  -- nor dismissed is indistinguishable from no row, and two encodings of one
  -- fact is how a count of unread items starts disagreeing with the list.
  constraint player_action_state_says_something
    check (num_nonnulls(seen_at, dismissed_at) >= 1)
);

alter table public.player_action_state enable row level security;
revoke all on table public.player_action_state from public, anon, authenticated;

comment on table public.player_action_state is
  'Contract 162. Per-player seen/dismissed state, deliberately separate from '
  'the item so regeneration cannot un-read an inbox, and deliberately without '
  'a foreign key so state survives an item being regenerated.';

-- ===========================================================================
-- 3. The generators
-- ===========================================================================
--
-- One per source of truth, each reading the authority that already owns the
-- fact. None of them decides when something locks; they read where it is
-- already decided.
--
-- All are `predictor_internal` and granted to nobody: an action item is a
-- server statement, and a function that can write one is a function that can
-- manufacture a deadline.

-- --- Last Man Standing: a pick is due in an open, unlocked round -------------
--
-- `bonus_competition_windows.locks_at` is the deadline, read rather than
-- computed. An entrant who has already picked has no action, which is where
-- `completed_at` comes from — not from anyone pressing anything.
create or replace function predictor_internal.generate_lms_pick_actions(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $lms$
declare
  v_written integer := 0;
begin
  with due as (
    select entrant.user_id,
           competition.id as competition_id,
           competition.tournament_id,
           window_row.id as window_id,
           window_row.label,
           window_row.locks_at,
           exists (
             select 1 from public.bonus_lms_selections pick
              where pick.competition_id = competition.id
                and pick.user_id = entrant.user_id
                and pick.window_id = window_row.id) as picked
      from public.bonus_competition_entrants entrant
      join public.bonus_competitions competition
        on competition.id = entrant.competition_id
       and competition.game_key = 'last_man_standing'
      join public.bonus_competition_windows window_row
        on window_row.competition_id = competition.id
     where entrant.outcome = 'active'
       and competition.published
       and window_row.opens_at is not null
       and window_row.locks_at is not null
       and window_row.opens_at <= p_now
       -- Still open. A locked round is not an action; it is history.
       and window_row.locks_at > p_now
  )
  insert into public.player_action_items as item (
    user_id, action_key, action_type, priority, tournament_id, competition_id,
    deadline_at, expires_at, completed_at, context, updated_at)
  select due.user_id,
         'lms_pick_due:' || due.competition_id::text || ':' || due.window_id::text,
         'lms_pick_due',
         -- A pick that is never made eliminates the entrant, so it outranks a
         -- matchweek that merely costs points.
         1,
         due.tournament_id,
         due.competition_id,
         due.locks_at,
         -- It stops being an action the moment the round locks, whether or not
         -- anything regenerates again.
         due.locks_at,
         case when due.picked then p_now else null end,
         jsonb_build_object('window_id', due.window_id, 'round_label', due.label),
         p_now
    from due
  -- IDEMPOTENT BY CONSTRUCTION. The same round regenerates to the same key, so
  -- a job run twice writes the same row twice and the row does not move.
  on conflict (user_id, action_key) do update
    set deadline_at = excluded.deadline_at,
        expires_at = excluded.expires_at,
        -- Completion is monotonic: once a pick exists the item is done, and a
        -- later regeneration must not un-complete it if the pick is edited.
        completed_at = coalesce(item.completed_at, excluded.completed_at),
        context = excluded.context,
        updated_at = excluded.updated_at
  -- Nothing about the item changed, so nothing is written and `updated_at` does
  -- not churn. Without this, every regeneration rewrites every open row.
  where item.deadline_at is distinct from excluded.deadline_at
     or item.expires_at is distinct from excluded.expires_at
     or item.context is distinct from excluded.context
     or (item.completed_at is null and excluded.completed_at is not null);

  get diagnostics v_written = row_count;
  return v_written;
end;
$lms$;

revoke all on function predictor_internal.generate_lms_pick_actions(timestamptz)
  from public, anon, authenticated, service_role;

-- --- Anything already locked is no longer actionable -------------------------
--
-- Invalidation is its own step rather than part of each generator, because the
-- generators only see rounds that are still open — an item whose deadline has
-- passed is precisely the one they no longer select, so no generator can ever
-- close it. That is the bug this step exists to prevent, and it is the reason
-- an unclosed inbox "shouts for ever".
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
     );

  get diagnostics v_closed = row_count;
  return v_closed;
end;
$expire$;

revoke all on function predictor_internal.invalidate_expired_actions(timestamptz)
  from public, anon, authenticated, service_role;

-- --- The driver --------------------------------------------------------------
--
-- `service_role` only, so the recurring job may run it and no browser can. It
-- returns what it did rather than nothing, because a job whose output is silence
-- is a job nobody notices has stopped — the defect contract 135 found in the
-- provider poll.
create or replace function public.process_player_action_items()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $driver$
declare
  v_now timestamptz := now();
  v_lms integer;
  v_closed integer;
begin
  v_lms := predictor_internal.generate_lms_pick_actions(v_now);
  v_closed := predictor_internal.invalidate_expired_actions(v_now);

  return jsonb_build_object(
    'ran_at', v_now,
    'lms_pick_actions_written', v_lms,
    'actions_invalidated', v_closed);
end;
$driver$;

revoke all on function public.process_player_action_items() from public, anon, authenticated;
grant execute on function public.process_player_action_items() to service_role;

-- ===========================================================================
-- 4. The read
-- ===========================================================================
--
-- The caller's own open actions, joined to their own state. Bounded and
-- deterministically ordered for issue #129's reason, and ordered by priority
-- then deadline then key — key last so the order is TOTAL, which is what stops
-- an inbox reshuffling between two renders.

create or replace function public.get_my_actions(
  p_limit integer default 20,
  p_include_dismissed boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $actions$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer;
  v_rows jsonb;
  v_unseen integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  -- The badge count, and it counts what the READ would show: open, undismissed
  -- and unseen. Computed from the same predicate as the list rather than from a
  -- second one, because a bell that disagrees with the inbox it opens is worse
  -- than no bell — which is the state the AppBar is in today.
  select count(*)::integer into v_unseen
    from public.player_action_items item
    left join public.player_action_state state
           on state.user_id = item.user_id and state.action_key = item.action_key
   where item.user_id = v_uid
     and item.completed_at is null
     and item.invalidated_at is null
     and state.dismissed_at is null
     and state.seen_at is null;

  select coalesce(jsonb_agg(entry order by (entry ->> 'ordinal')::integer), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
               'ordinal', row_number() over (
                 order by item.priority,
                          item.deadline_at nulls last,
                          item.action_key),
               'action_key', item.action_key,
               'action_type', item.action_type,
               'priority', item.priority,
               'tournament_id', item.tournament_id,
               'competition_id', item.competition_id,
               'deadline_at', item.deadline_at,
               'expires_at', item.expires_at,
               'context', item.context,
               'seen', state.seen_at is not null,
               'seen_at', state.seen_at,
               'dismissed', state.dismissed_at is not null,
               'generated_at', item.generated_at) as entry
        from public.player_action_items item
        left join public.player_action_state state
               on state.user_id = item.user_id and state.action_key = item.action_key
       where item.user_id = v_uid
         and item.completed_at is null
         and item.invalidated_at is null
         and (p_include_dismissed or state.dismissed_at is null)
       order by item.priority, item.deadline_at nulls last, item.action_key
       limit v_limit
    ) page;

  return jsonb_build_object(
    'unseen', v_unseen,
    'limit', v_limit,
    'actions', v_rows);
end;
$actions$;

revoke all on function public.get_my_actions(integer, boolean) from public, anon;
grant execute on function public.get_my_actions(integer, boolean) to authenticated;

-- ===========================================================================
-- 5. The two commands a browser gets
-- ===========================================================================
--
-- Both write only `player_action_state`, only for `auth.uid()`, and neither can
-- complete an action or move a deadline. Both are idempotent: marking a seen
-- item seen again keeps the FIRST instant, because "when did you first see
-- this" is the fact, and rewriting it would make an item look freshly read
-- every time a surface rendered.
--
-- Both refuse a key the caller holds no item for, so state cannot be written
-- for an arbitrary string. That is a small thing, and it is what stops this
-- table becoming a free key-value store keyed on a user id.

create or replace function public.mark_actions_seen(p_action_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $seen$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_marked integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_action_keys is null or array_length(p_action_keys, 1) is null then
    return jsonb_build_object('marked', 0);
  end if;

  if array_length(p_action_keys, 1) > 100 then
    raise exception 'Too many action keys in one call' using errcode = '22023';
  end if;

  insert into public.player_action_state as state (user_id, action_key, seen_at, updated_at)
  select v_uid, item.action_key, v_now, v_now
    from public.player_action_items item
   where item.user_id = v_uid
     -- Only keys the caller actually holds an item for.
     and item.action_key = any (p_action_keys)
  on conflict (user_id, action_key) do update
    -- IDEMPOTENT, and the coalesce is the whole point: the first sighting is
    -- the fact, so a re-render does not restate it.
    set seen_at = coalesce(state.seen_at, excluded.seen_at),
        updated_at = v_now
    where state.seen_at is null;

  get diagnostics v_marked = row_count;
  return jsonb_build_object('marked', v_marked);
end;
$seen$;

revoke all on function public.mark_actions_seen(text[]) from public, anon;
grant execute on function public.mark_actions_seen(text[]) to authenticated;

create or replace function public.dismiss_action(p_action_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $dismiss$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_dismissed integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  insert into public.player_action_state as state (
    user_id, action_key, seen_at, dismissed_at, updated_at)
  select v_uid, item.action_key, v_now, v_now, v_now
    from public.player_action_items item
   where item.user_id = v_uid
     and item.action_key = p_action_key
  on conflict (user_id, action_key) do update
    set dismissed_at = coalesce(state.dismissed_at, v_now),
        -- Dismissing implies seeing. A dismissed item that was never marked
        -- seen would otherwise keep counting towards `unseen` for ever.
        seen_at = coalesce(state.seen_at, v_now),
        updated_at = v_now;

  get diagnostics v_dismissed = row_count;

  if v_dismissed = 0 then
    raise exception 'No such action for this player' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('dismissed', true, 'action_key', p_action_key);
end;
$dismiss$;

revoke all on function public.dismiss_action(text) from public, anon;
grant execute on function public.dismiss_action(text) to authenticated;

-- ===========================================================================
-- 6. Prove the boundaries, in the same transaction
-- ===========================================================================

do $$
declare
  v_seen text := pg_get_functiondef('public.mark_actions_seen(text[])'::regprocedure);
  v_dismiss text := pg_get_functiondef('public.dismiss_action(text)'::regprocedure);
  v_read text := pg_get_functiondef('public.get_my_actions(integer,boolean)'::regprocedure);
begin
  -- THE CENTRAL BOUNDARY. Neither browser command may write an ITEM, because an
  -- item carries the deadline and the completion verdict. They write state.
  if (v_seen || v_dismiss) ~* '(insert[[:space:]]+into|update)[[:space:]]+public\.player_action_items' then
    raise exception 'A browser command must never write an action item';
  end if;

  -- And neither may set a deadline or a completion under any spelling.
  if (v_seen || v_dismiss) ~* 'deadline_at|completed_at|invalidated_at' then
    raise exception 'A browser command must never touch a deadline or a verdict';
  end if;

  -- Both are scoped to the caller alone.
  if v_seen !~ 'auth\.uid\(\)' or v_dismiss !~ 'auth\.uid\(\)' or v_read !~ 'auth\.uid\(\)' then
    raise exception 'Every browser-reachable action function must resolve auth.uid()';
  end if;

  -- The generators, which DO write items, are reachable by no browser role and
  -- the driver by no browser role either.
  if has_function_privilege('authenticated',
       'predictor_internal.generate_lms_pick_actions(timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.process_player_action_items()', 'execute')
     or has_function_privilege('anon', 'public.process_player_action_items()', 'execute')
  then
    raise exception 'Only the server may generate action items';
  end if;

  -- No browser role reaches either table directly: `player_action_items` holds
  -- every player's outstanding actions, and a select on it is a scrape of who
  -- is playing what.
  if has_table_privilege('authenticated', 'public.player_action_items', 'select')
     or has_table_privilege('authenticated', 'public.player_action_state', 'select')
     or has_table_privilege('anon', 'public.player_action_items', 'select')
     or has_table_privilege('anon', 'public.player_action_state', 'select')
  then
    raise exception 'No browser role may read the action tables directly';
  end if;

  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('player_action_items', 'player_action_state')
      and not c.relrowsecurity
  ) then
    raise exception 'Every new table must keep row-level security enabled';
  end if;
end;
$$;
