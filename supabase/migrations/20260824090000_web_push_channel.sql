-- ---------------------------------------------------------------------------
-- Contract 217 — push as a SECOND CHANNEL through the existing boundary.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- Contract 216 finished the reminder path: a job posts to `notification-
-- dispatch` every five minutes, the dispatcher claims from
-- `public.reminder_deliveries`, and every run is recorded. What it cannot do is
-- reach anybody, because the only sender it knows is a transactional email
-- provider and no environment carries a credential for one — `SITE-007` still
-- records the sender as blocked on the brand decision.
--
-- Web push needs no such decision and no provider account. The browser gives
-- the application an endpoint, the application signs a request to it with a
-- key pair it generates itself, and the push service delivers ciphertext it
-- cannot read. So this contract adds the channel that can actually run today,
-- and it adds it INSIDE the ledger rather than beside it.
--
-- ---------------------------------------------------------------------------
-- ONE REMINDER IS ONE ROW, WHICHEVER CHANNEL CARRIES IT
-- ---------------------------------------------------------------------------
--
-- The obvious shape — one delivery row per channel — is the wrong one, and it
-- is wrong in the specific way this ledger was built to prevent. Contract 163's
-- unique key is `(user_id, action_key, reminder_kind)`: one reminder per player
-- per action, ever. Adding the channel to that key would make "remind me about
-- matchweek 4" two rows, and a player with both channels on would be told the
-- same thing twice — which is precisely the failure the key exists to stop, and
-- the one a player actually notices.
--
-- So `channel` is a COLUMN ON THE EXISTING ROW, stamped at claim time. The key
-- is untouched. A reminder has exactly one terminal state, so it can be
-- delivered exactly once, and no arithmetic anywhere has to be trusted for that
-- to hold — it is a consequence of the primary shape.
--
-- ---------------------------------------------------------------------------
-- THE OPT-IN IS THE SUBSCRIPTION, AND THERE IS NO SECOND FLAG
-- ---------------------------------------------------------------------------
--
-- There is deliberately no `profiles.reminder_push` beside
-- `profiles.reminder_emails`. A push subscription only exists because the
-- player granted a browser permission and this application then stored the
-- endpoint: the row IS the consent, recorded by the act that gave it. A boolean
-- next to it would be a second authority for the same question, and the two
-- would eventually disagree — a `true` with no subscription reads as "push is
-- on" and reaches nobody.
--
-- It also gives the strongest possible form of the opt-out, which is the one
-- contract 163 already chose for email: turning push off DELETES the endpoint
-- and the keys. The server is then not deciding to leave you alone, it is
-- unable to reach you.
--
--   scheduling gate:  reminder_emails OR the player has a push subscription
--   channel choice:   push where a subscription exists, otherwise email
--
-- A player with `reminder_emails = false` and a subscription is therefore
-- reminded by push and never by email, which is what both of those settings
-- say. A player with neither is not scheduled at all.
--
-- ---------------------------------------------------------------------------
-- PUSH WINS WHEN BOTH ARE AVAILABLE, AND THE ACCOUNT SURFACE SAYS SO
-- ---------------------------------------------------------------------------
--
-- Preferring push is not a performance choice. Push is the channel the player
-- took a deliberate, revocable action to enable, and it is the one that arrives
-- before the deadline rather than whenever a mailbox is next opened. But it
-- means "Reminder emails: on" stops being the whole truth for that player, so
-- the account surface is changed in the same pull request to say where the
-- nudge is actually going. A preference screen that goes stale because the
-- backend got cleverer is the defect one level up.
--
-- ---------------------------------------------------------------------------
-- A DEAD ENDPOINT FALLS BACK TO EMAIL BY ITSELF
-- ---------------------------------------------------------------------------
--
-- A push service answers 404 or 410 for a subscription that no longer exists —
-- the browser was reinstalled, the permission revoked, the profile wiped. The
-- sender prunes it, records the attempt as failed, and contract 163's retry
-- policy schedules another. The next claim finds no subscription for that
-- player and stamps `email` instead.
--
-- That is not a fallback anybody wrote. It is what the existing state machine
-- does once the channel is recomputed per attempt rather than per row, and it
-- is why the channel is stamped at CLAIM and not at SCHEDULE.
--
-- ---------------------------------------------------------------------------
-- WHAT IS STORED, AND WHAT IS NOT
-- ---------------------------------------------------------------------------
--
-- An endpoint URL and two short public key values, which are exactly what
-- RFC 8291 needs to encrypt for one browser and nothing else. No device name,
-- no user agent string, no IP address, no push history — the ledger already
-- records what was attempted, and a second copy annotated with the device would
-- turn a delivery table into a location log.
--
-- The keys are not secrets of ours: `p256dh` is the browser's PUBLIC key and
-- `auth` is a shared salt that is useless without it and without the endpoint.
-- They are still kept behind row-level security and out of every browser role
-- but their owner's, because taken together they are the ability to make a
-- specific person's phone buzz.
--
-- Additive: one table, one column, three functions added, two redefined. No
-- existing policy or grant is relaxed.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. The subscriptions
-- ===========================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  -- THE PUSH SERVICE'S URL FOR ONE BROWSER, and globally unique because that is
  -- what it is: exactly one browser profile is behind it. Unique across users
  -- rather than within one, so that a shared device signing in as somebody else
  -- MOVES the endpoint instead of leaving the previous account able to buzz it.
  endpoint text not null,

  -- The browser's public key (uncompressed P-256 point) and the shared auth
  -- secret, both base64url as the Push API hands them over.
  p256dh text not null,
  auth text not null,

  created_at timestamptz not null default now(),
  -- Refreshed every time the browser re-registers, which it does on each start.
  -- A subscription nobody has confirmed for months is a candidate for pruning;
  -- nothing prunes on it yet, and this contract does not invent a job for it.
  last_seen_at timestamptz not null default now(),

  constraint push_subscriptions_endpoint_unique unique (endpoint),

  -- HTTPS AND A PUBLIC NAME. An endpoint the sender would POST to over plain
  -- http is not a push service, and refusing it in the schema means no code
  -- path has to.
  --
  -- THE HOST RULE IS AN SSRF CONTROL, not tidiness. The sender is a service-role
  -- Edge Function, and this column is written from a browser: without a rule,
  -- any signed-in player could point it at an internal https service and have
  -- the platform POST to it on their behalf. It is a blind, POST-only, one-per-
  -- reminder request that returns them nothing, so the ceiling is low — but low
  -- is not none, and the cheap half of the fix belongs in the schema where no
  -- caller can forget it.
  --
  -- IT IS NOT AN ORIGIN ALLOW-LIST. Real push endpoints live on Google's,
  -- Mozilla's, Microsoft's and Apple's services and on self-hosted ones, and a
  -- list of hostnames here would silently stop working for a browser nobody
  -- anticipated. What is refused is the shape that can never be a public push
  -- service: an address literal, a name with no dot in it, and the private
  -- suffixes.
  constraint push_subscriptions_endpoint_https
    check (
      char_length(endpoint) between 12 and 2048
      -- A dotted DNS name, optional port, then the path. `[` is not permitted,
      -- so an IPv6 literal cannot match, and `localhost` has no dot.
      and endpoint ~ '^https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+(:[0-9]{1,5})?(/|$)'
      -- ...and a dotted quad is a dotted name, so it is refused by name.
      and endpoint !~ '^https://([0-9]{1,3}\.){3}[0-9]{1,3}([:/]|$)'
      and endpoint !~* '^https://[^/]*\.(local|internal|localhost|lan|home|corp)(:[0-9]+)?(/|$)'
    ),

  -- 65 raw bytes of uncompressed P-256 point, base64url: 87 characters, or 88
  -- if the client padded. Structural, not cryptographic — it rejects the
  -- obvious garbage and lets the sender fail honestly on the rest.
  constraint push_subscriptions_p256dh_shaped
    check (p256dh ~ '^[A-Za-z0-9_-]{86,88}={0,2}$'),

  -- 16 raw bytes, base64url: 22 characters unpadded.
  constraint push_subscriptions_auth_shaped
    check (auth ~ '^[A-Za-z0-9_-]{22,24}={0,2}$')
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated;

-- READ AND REVOKE, NEVER WRITE. A player may see every endpoint this platform
-- holds for them and delete any of them, which is the whole of "you can make us
-- unable to reach you" and needs no function call to be true. Creating one goes
-- through `save_push_subscription`, because a new subscription may have to be
-- taken off another account and no own-row policy can express that.
grant select, delete on table public.push_subscriptions to authenticated;

-- No `drop policy if exists` guard, following contract C1B's own new-table
-- policy. The table is created by this migration, so nothing can pre-exist for
-- a guard to remove — and a needless `drop policy` would put this file in the
-- destructive class for `check-migration-additive.mjs` on a statement that
-- cannot destroy anything.
create policy "own push subscriptions readable"
  on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "own push subscriptions revocable"
  on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

comment on table public.push_subscriptions is
  'Contract 217. One row per browser that has granted this application '
  'permission to notify it. The row IS the push opt-in: deleting it is how a '
  'player turns push off, and there is no second boolean beside it. Holds no '
  'device name, user agent or address.';

-- ===========================================================================
-- 2. Recording a subscription
-- ===========================================================================
--
-- `security definer` for one reason: the endpoint is unique across the whole
-- table, so a browser signing in as a different player has to TAKE the row
-- rather than collide with it. An own-row policy cannot authorise that, and the
-- alternative — leaving the previous account owning an endpoint that now
-- belongs to somebody else's session — is the more dangerous option by a
-- distance.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $save$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in to enable push notifications'
      using errcode = '42501';
  end if;

  -- The CHECK constraints below would catch these anyway. Raising here means
  -- the browser gets a sentence about what it sent rather than a constraint
  -- name, and the two cannot drift because the patterns are the same ones.
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'A push endpoint must be an https URL' using errcode = '22023';
  end if;

  -- Said in its own sentence rather than left to the constraint, because
  -- "that is not a push service" and "that key is malformed" are different
  -- things for whoever is reading a browser console.
  if p_endpoint ~ '^https://([0-9]{1,3}\.){3}[0-9]{1,3}([:/]|$)'
     or p_endpoint !~ '^https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+(:[0-9]{1,5})?(/|$)'
     or p_endpoint ~* '^https://[^/]*\.(local|internal|localhost|lan|home|corp)(:[0-9]+)?(/|$)'
  then
    raise exception 'A push endpoint must name a public push service'
      using errcode = '22023';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
     set user_id = v_uid,
         -- Re-subscribing rotates the keys, so the stored pair must follow or
         -- every later payload is encrypted to a key the browser has discarded.
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         last_seen_at = now();
end;
$save$;

revoke all on function public.save_push_subscription(text, text, text)
  from public, anon;
grant execute on function public.save_push_subscription(text, text, text)
  to authenticated;

comment on function public.save_push_subscription(text, text, text) is
  'Contract 217. Stores or refreshes the calling player''s push subscription. '
  'An endpoint already held for another account is reassigned, because exactly '
  'one browser profile is behind it.';

-- ===========================================================================
-- 3. Pruning one the push service has disowned
-- ===========================================================================
--
-- 404 and 410 from a push service mean the subscription is gone for good.
-- Anything else — a 429, a 500, a timeout — is transient and must NOT delete
-- anything, or a push service having a bad ten minutes would silently opt every
-- player out of a channel they chose.
--
-- Service role only. It deletes by endpoint without regard to owner, which is
-- correct for a dead endpoint and is exactly why no browser role may call it.

create or replace function public.prune_push_subscription(p_endpoint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $prune$
declare
  v_removed integer;
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
  get diagnostics v_removed = row_count;
  return jsonb_build_object('endpoint_removed', v_removed);
end;
$prune$;

revoke all on function public.prune_push_subscription(text)
  from public, anon, authenticated;
grant execute on function public.prune_push_subscription(text) to service_role;

comment on function public.prune_push_subscription(text) is
  'Contract 217. Removes a push subscription a push service answered 404 or '
  '410 for. Service role only: it deletes by endpoint regardless of owner.';

-- ===========================================================================
-- 4. The channel, on the row that already exists
-- ===========================================================================

alter table public.reminder_deliveries
  add column if not exists channel text not null default 'email';

do $channel_check$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'reminder_deliveries_channel_allowed'
       and conrelid = 'public.reminder_deliveries'::regclass
  ) then
    alter table public.reminder_deliveries
      add constraint reminder_deliveries_channel_allowed
      check (channel in ('email', 'push'));
  end if;
end;
$channel_check$;

comment on column public.reminder_deliveries.channel is
  'Contract 217. Which channel the LAST claim chose for this reminder. '
  'Recomputed on every attempt, so a pruned push endpoint falls back to email '
  'on the retry without anybody writing a fallback.';

-- ===========================================================================
-- 5. Scheduling, widened to the second channel
-- ===========================================================================
--
-- Two changes and no others: the preference gate now admits a player who has a
-- push subscription, and the withdrawal sweep uses the SAME predicate negated.
-- They have to move together — a gate that admits and a sweep that withdraws
-- would schedule a push-only player and then immediately cancel them, forever,
-- five minutes at a time.

create or replace function public.process_reminder_schedule(
  p_lead interval default interval '24 hours',
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $schedule$
declare
  v_now timestamptz := now();
  v_scheduled integer;
  v_swept integer;
begin
  insert into public.reminder_deliveries (
    user_id, action_key, reminder_kind, deadline_at, scheduled_for,
    next_attempt_at, dry_run)
  select item.user_id,
         item.action_key,
         'deadline',
         item.deadline_at,
         greatest(item.deadline_at - p_lead, v_now),
         greatest(item.deadline_at - p_lead, v_now),
         p_dry_run
    from public.player_action_items item
    join public.profiles player on player.id = item.user_id
   where item.completed_at is null
     and item.invalidated_at is null
     and item.deadline_at is not null
     -- THE PREFERENCE, NOW PER CHANNEL. Either consent is enough to be
     -- reminded; neither means no row exists at all, which is still the
     -- strongest form of "we do not contact you".
     and (
       player.reminder_emails
       or exists (
         select 1 from public.push_subscriptions device
          where device.user_id = item.user_id))
     and greatest(item.deadline_at - p_lead, v_now) < item.deadline_at
  on conflict (user_id, action_key, reminder_kind) do nothing;

  get diagnostics v_scheduled = row_count;

  update public.reminder_deliveries delivery
     set status = 'skipped',
         updated_at = v_now
   where delivery.status = 'pending'
     and (
       exists (
         select 1 from public.player_action_items item
          where item.user_id = delivery.user_id
            and item.action_key = delivery.action_key
            and (item.completed_at is not null or item.invalidated_at is not null))
       -- THE SAME PREDICATE, NEGATED. A player is withdrawn only when BOTH
       -- consents are gone.
       or not exists (
         select 1 from public.profiles player
          where player.id = delivery.user_id
            and (
              player.reminder_emails
              or exists (
                select 1 from public.push_subscriptions device
                 where device.user_id = delivery.user_id)))
       or delivery.deadline_at <= v_now);

  get diagnostics v_swept = row_count;

  return jsonb_build_object(
    'ran_at', v_now,
    'scheduled', v_scheduled,
    'withdrawn', v_swept,
    'dry_run', p_dry_run);
end;
$schedule$;

revoke all on function public.process_reminder_schedule(interval, boolean)
  from public, anon, authenticated;
grant execute on function public.process_reminder_schedule(interval, boolean) to service_role;

-- ===========================================================================
-- 6. Claiming, which now also decides the channel
-- ===========================================================================
--
-- The return type gains a column, so this is a drop and recreate rather than a
-- replace. The ARGUMENT signature is unchanged, so the deployment contract's
-- RPC list, every grant and the caller all stay exactly as they are.
--
-- CONTRACT 216'S TIGHTEN-ONLY DRY RUN IS PRESERVED VERBATIM. Its migration
-- asserts on the text of this function body and will refuse the deployment if
-- `dry_run = delivery.dry_run or v_requested_dry_run` is ever weakened back to
-- `dry_run = p_dry_run`; the assertion at the foot of this file repeats the
-- check so a future edit here fails at the same place rather than two contracts
-- later.

-- THIS IS WHY THE MIGRATION IS NOT ADDITIVE, and it is the only reason.
-- `check-migration-additive.mjs` refuses the file on this one statement, which
-- is correct: it cannot tell a drop-and-recreate from a deletion. So this
-- contract goes through `development-migration-rollout.yml`, the guarded lane,
-- exactly as contract 213 does. The statement is left in plain sight rather
-- than hidden inside a `do` block to get past the scanner, because a gate
-- routed around is a gate that stops meaning anything.
drop function if exists public.claim_due_reminders(integer, boolean);

create function public.claim_due_reminders(
  p_limit integer default 50,
  p_dry_run boolean default true
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  action_key text,
  reminder_kind text,
  deadline_at timestamptz,
  attempts smallint,
  dry_run boolean,
  channel text
)
language plpgsql
security definer
set search_path = ''
as $claim$
declare
  v_now timestamptz := now();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  -- Null is not "live". An omitted argument means the caller stated no
  -- intention, and the fail-safe reading of no intention is a dry run.
  v_requested_dry_run boolean := coalesce(p_dry_run, true);
begin
  return query
  with claimed as (
    select delivery.id
      from public.reminder_deliveries delivery
     where delivery.status in ('pending', 'failed')
       and coalesce(delivery.next_attempt_at, delivery.scheduled_for) <= v_now
       and delivery.deadline_at > v_now
       -- THERE MUST STILL BE A CHANNEL. Without this, a player who turned
       -- emails off and later lost their last device would be claimed anyway,
       -- and the `else 'email'` below would send them the very thing they
       -- switched off. The withdrawal sweep cannot cover it: the sweep only
       -- touches `pending` rows and this one may already be `failed` and
       -- retrying. A row with neither channel is simply not claimed, and the
       -- sweep marks it `skipped` on its own cadence.
       and (
         exists (
           select 1 from public.push_subscriptions device
            where device.user_id = delivery.user_id)
         or exists (
           select 1 from public.profiles player
            where player.id = delivery.user_id and player.reminder_emails))
     order by delivery.scheduled_for
     limit v_limit
     -- THE CONTROL. Not `for update` alone, which would make a second sender
     -- WAIT and then process the same row after the first committed.
     for update skip locked
  ),
  taken as (
    update public.reminder_deliveries delivery
       set status = 'sending',
           attempts = delivery.attempts + 1,
           last_attempt_at = v_now,
           -- TIGHTEN ONLY. Contract 216 owns this line and asserts on it.
           dry_run = delivery.dry_run or v_requested_dry_run,
           -- DECIDED PER ATTEMPT, not once per row. That is what makes a
           -- pruned endpoint fall back to email on the retry — and `else` is
           -- only reachable because the claim above has already established
           -- that this player accepts email.
           channel = case
             when exists (
               select 1 from public.push_subscriptions device
                where device.user_id = delivery.user_id) then 'push'
             else 'email'
           end,
           updated_at = v_now
      from claimed
     where delivery.id = claimed.id
    returning delivery.id, delivery.user_id, delivery.action_key,
              delivery.reminder_kind, delivery.deadline_at, delivery.attempts,
              delivery.dry_run, delivery.channel
  )
  select taken.id,
         taken.user_id,
         -- Still read at claim time and still never stored. Returned for the
         -- email channel; the push sender ignores it.
         account.email::text,
         taken.action_key,
         taken.reminder_kind,
         taken.deadline_at,
         taken.attempts,
         taken.dry_run,
         taken.channel
    from taken
    join auth.users account on account.id = taken.user_id;
end;
$claim$;

revoke all on function public.claim_due_reminders(integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer, boolean) to service_role;

-- ===========================================================================
-- 7. The administrator's read, extended by two counts
-- ===========================================================================
--
-- An operator turning on a second channel needs one thing this function could
-- not previously answer: is it the new channel that is delivering? Totals alone
-- read identically whether push works or every push silently fell back to an
-- email sender that is not configured either.
--
-- Same restraint as contracts 172 and 216: counts and instants, admin-gated,
-- naming no player and carrying no endpoint.

create or replace function public.admin_reminder_delivery_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $health$
declare
  v_now timestamptz := now();
  v_deliveries jsonb;
  v_actions jsonb;
  v_sender jsonb;
begin
  perform predictor_internal.require_competition_admin();

  select jsonb_build_object(
      'total', count(*),
      'by_status', coalesce((
        select jsonb_object_agg(grouped.status, grouped.rows)
          from (select delivery.status, count(*) as rows
                  from public.reminder_deliveries delivery
                 group by delivery.status) grouped), '{}'::jsonb),
      -- Live rows only. A ledger that is 100% dry-run reads the same whether
      -- nothing has been sent or everything already finished, so this counts
      -- what is still ahead rather than the whole history.
      'pending_live', count(*) filter (where delivery.status = 'pending' and not delivery.dry_run),
      'pending_dry_run', count(*) filter (where delivery.status = 'pending' and delivery.dry_run),
      'due_now', count(*) filter (
        where delivery.status = 'pending' and delivery.next_attempt_at <= v_now),
      'in_flight', count(*) filter (where delivery.status = 'sending'),
      -- Stall evidence. A row in `sending` with no attempt for an hour is a
      -- sender that died. There IS a sender now, so this stops being a number
      -- that must be zero and becomes a number worth watching.
      'stalled_over_an_hour', count(*) filter (
        where delivery.status = 'sending'
          and coalesce(delivery.last_attempt_at, delivery.updated_at) < v_now - interval '1 hour'),
      'oldest_pending_scheduled_for', min(delivery.scheduled_for) filter (
        where delivery.status = 'pending'),
      'last_updated_at', max(delivery.updated_at),
      -- `last_error` is a PROVIDER's message about a delivery. It is not shown
      -- here, and neither is the address it failed to reach: how many failed is
      -- an operations fact, which one failed is a player's.
      'terminal_failures', count(*) filter (where delivery.status = 'abandoned'),
      'withdrawn', count(*) filter (where delivery.status = 'skipped'),
      'max_attempts_seen', coalesce(max(delivery.attempts), 0),
      -- Contract 217. WHICH CHANNEL ACTUALLY DELIVERED, live rows only —
      -- counting dry runs here would report a channel as working on the
      -- strength of sends that never happened.
      'delivered_by_channel', coalesce((
        select jsonb_object_agg(grouped.channel, grouped.rows)
          from (select sent.channel, count(*) as rows
                  from public.reminder_deliveries sent
                 where sent.status = 'sent' and not sent.dry_run
                 group by sent.channel) grouped), '{}'::jsonb))
    into v_deliveries
    from public.reminder_deliveries delivery;

  select jsonb_build_object(
      'total', count(*),
      'open', count(*) filter (
        where item.completed_at is null and item.invalidated_at is null),
      'completed', count(*) filter (where item.completed_at is not null),
      'invalidated', count(*) filter (where item.invalidated_at is not null),
      'by_type', coalesce((
        select jsonb_object_agg(grouped.action_type, grouped.rows)
          from (select typed.action_type, count(*) as rows
                  from public.player_action_items typed
                 where typed.completed_at is null and typed.invalidated_at is null
                 group by typed.action_type) grouped), '{}'::jsonb),
      'last_generated_at', max(item.generated_at),
      -- An action open past its own deadline is the sweep failing to close it,
      -- which is what `211_action_centre.sql` was written to catch. Zero is the
      -- only correct value once the generator has run.
      'open_past_deadline', count(*) filter (
        where item.completed_at is null
          and item.invalidated_at is null
          and item.deadline_at is not null
          and item.deadline_at <= v_now))
    into v_actions
    from public.player_action_items item;

  v_sender := predictor_internal.reminder_sender_configuration();

  return jsonb_build_object(
    'as_of', v_now,
    'jobs', predictor_internal.reminder_job_status(),
    'actions', v_actions,
    'deliveries', v_deliveries,
    -- DERIVED, where contract 172 could only state a literal. A sender can
    -- exist from contract 216 onward, so a hard-coded false would become a lie
    -- the moment an operator finished the setup and nobody edited this.
    'sender_configured', coalesce((v_sender->>'configured')::boolean, false),
    'sender', v_sender,
    -- Contract 217. HOW MANY BROWSERS COULD BE REACHED AT ALL. Zero with a
    -- configured sender is the honest picture of a channel nobody has opted
    -- into, and it is a different problem from a channel that is failing.
    'push_devices', (select count(*) from public.push_subscriptions),
    'dispatch', predictor_internal.reminder_dispatch_status());
end;
$health$;

revoke all on function public.admin_reminder_delivery_health() from public, anon;
grant execute on function public.admin_reminder_delivery_health() to authenticated;

comment on function public.admin_reminder_delivery_health() is
  'Contracts 172, 216 and 217. Competition-administrator operational health for '
  'the action centre, the reminder ledger, the four jobs, the dispatch runs and '
  'the two delivery channels. It returns no user id, display name, action key, '
  'prediction, push endpoint or message content, and no provider error text.';

-- ===========================================================================
-- 8. Prove it, in the same transaction
-- ===========================================================================

do $assertions$
declare
  v_claim text := pg_get_functiondef(
    'public.claim_due_reminders(integer,boolean)'::regprocedure);
  v_schedule text := pg_get_functiondef(
    'public.process_reminder_schedule(interval,boolean)'::regprocedure);
  v_save text := pg_get_functiondef(
    'public.save_push_subscription(text,text,text)'::regprocedure);
begin
  -- CONTRACT 216'S GATE SURVIVES THIS REWRITE. The claim was dropped and
  -- recreated here, which is the one edit that could quietly undo it, so the
  -- check that lives in 216 is repeated at the place the risk actually is.
  if v_claim !~ 'dry_run[[:space:]]*=[[:space:]]*delivery\.dry_run[[:space:]]+or' then
    raise exception 'claim_due_reminders must still tighten the dry run, never clear it';
  end if;

  if v_claim !~ 'skip[[:space:]]+locked' then
    raise exception 'The claim must still skip locked rows, not wait for them';
  end if;

  -- THE CHANNEL IS DECIDED PER ATTEMPT. Stamping it at scheduling would break
  -- the email fallback for a pruned endpoint, silently and only in production.
  if v_claim !~ 'push_subscriptions' then
    raise exception 'The claim must choose the channel from the live subscriptions';
  end if;

  -- AND THE FALLBACK MAY NOT REACH SOMEBODY WHO SWITCHED EMAIL OFF. The claim
  -- has to read the preference as well as the subscriptions, or a push-only
  -- player who loses their last device is sent the one thing they refused.
  if v_claim !~ 'reminder_emails' then
    raise exception
      'The claim must not fall back to email for a player who turned email off';
  end if;

  -- BOTH HALVES OF THE PREFERENCE MOVED. A gate that admits push-only players
  -- and a sweep that withdraws them would cancel every reminder it schedules.
  if (select count(*) from regexp_matches(v_schedule, 'push_subscriptions', 'g')) < 2 then
    raise exception
      'Scheduling and its withdrawal sweep must both consider push subscriptions';
  end if;

  if v_schedule !~ 'reminder_emails' then
    raise exception 'Scheduling must still enforce the email preference';
  end if;

  -- THE LEDGER STILL HOLDS NO ADDRESS AND NO CONTENT, and now no endpoint
  -- either: the channel is a word, not a destination.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'reminder_deliveries'
       and column_name in ('email', 'subject', 'body', 'html', 'text_body',
                           'recipient', 'endpoint', 'p256dh')
  ) then
    raise exception 'The reminder ledger must hold no address, endpoint or content';
  end if;

  -- ONE REMINDER IS STILL ONE ROW. If the channel ever joins this key, a player
  -- with both channels on is told the same thing twice.
  if not exists (
    select 1 from pg_constraint
     where conname = 'reminder_deliveries_once_per_action'
       and conrelid = 'public.reminder_deliveries'::regclass
       and pg_get_constraintdef(oid) = 'UNIQUE (user_id, action_key, reminder_kind)'
  ) then
    raise exception
      'The one-reminder-per-action key must not gain the channel: that is a duplicate send';
  end if;

  -- NO BROWSER ROLE MAY WRITE A SUBSCRIPTION DIRECTLY. Insert and update are
  -- the two that need the definer's reassignment; select and delete are the
  -- player's own and are policy-gated.
  if has_table_privilege('authenticated', 'public.push_subscriptions', 'insert')
     or has_table_privilege('authenticated', 'public.push_subscriptions', 'update')
     or has_table_privilege('anon', 'public.push_subscriptions', 'select')
  then
    raise exception 'Push subscriptions must be written through save_push_subscription only';
  end if;

  if not (select relrowsecurity from pg_class
           where oid = 'public.push_subscriptions'::regclass) then
    raise exception 'Push subscriptions must be behind row-level security';
  end if;

  -- PRUNING IS NOT BROWSER-REACHABLE. It deletes by endpoint without regard to
  -- owner, which is right for a dead endpoint and wrong for anybody else.
  if has_function_privilege('authenticated', 'public.prune_push_subscription(text)', 'execute')
     or has_function_privilege('anon', 'public.prune_push_subscription(text)', 'execute')
  then
    raise exception 'Only the service role may prune a push subscription';
  end if;

  -- THE SAVE TAKES ITS OWNER FROM THE SESSION, never from an argument. A
  -- `p_user_id` here would let any signed-in player point somebody else's
  -- account at a browser they control.
  if (select pg_get_function_arguments(
        'public.save_push_subscription(text,text,text)'::regprocedure)) ~* 'user' then
    raise exception 'save_push_subscription must read the player from the session';
  end if;

  if v_save !~ 'auth\.uid' then
    raise exception 'save_push_subscription must read the player from the session';
  end if;

  -- THE ENDPOINT IS A URL A BROWSER CHOSE AND A SERVICE ROLE WILL POST TO. An
  -- https check alone would let a signed-in player aim the sender at an
  -- internal address.
  if not exists (
    select 1 from pg_constraint
     where conname = 'push_subscriptions_endpoint_https'
       and conrelid = 'public.push_subscriptions'::regclass
       and pg_get_constraintdef(oid) ~ '0-9\]\{1,3\}'
  ) then
    raise exception 'The endpoint constraint must refuse an address literal, not only plain http';
  end if;
end;
$assertions$;
