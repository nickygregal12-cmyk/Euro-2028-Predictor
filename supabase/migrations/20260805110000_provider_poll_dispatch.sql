-- Contract 115: the database calls the provider.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- The `provider-poll` Edge Function is deployed and is the only thing in this
-- system permitted to reach a provider: it holds the three provider credentials
-- as Edge Function secrets, archives the verbatim response through contract
-- 96's custody RPCs, and records processing evidence. It has never been called
-- by anything except a person with curl.
--
-- `pg_cron` has driven five recurring jobs since contract 82, so the schedule
-- was never the missing piece either. Every one of those five calls a plain SQL
-- function. None reaches outside the database, and until this migration none
-- COULD: `pg_net` was available on the project and not installed, so PostgreSQL
-- had no way to make an outbound HTTP request at all.
--
-- That is the whole gap. Not an architecture, one extension and the wiring
-- either side of it:
--
--   pg_cron  ->  public.dispatch_due_provider_polls()
--                  -> net.http_post -> provider-poll Edge Function
--                                       -> provider API (credentials stay here)
--                                       -> archive + processing evidence
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CONTRACT DELIBERATELY DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It does not import fixtures. A dispatched poll ends with a decoded, archived
-- payload — exactly where contract 96 left it — because turning a decoded
-- fixture into a `season_fixtures` row needs contract 112's identity map to
-- have rows in it, and it has none. Writing the import now would mean inventing
-- the mapping as a side effect, which is the same mistake contract 112 stopped
-- short of and named.
--
-- It also does not decide WHAT to poll. `provider_poll_targets` is empty after
-- this migration. A target is a provider, a bounded provider-relative path and
-- a cadence, recorded deliberately by an operator or by a later contract. There
-- is no authority anywhere in this repository for a provider's URL shape, and a
-- migration that guessed path templates would be publishing three guesses as
-- fact.
--
-- The consequence is stated rather than buried: **after this migration the job
-- runs every five minutes and does nothing.** It reports `configured: false`
-- until the two vault secrets exist, and `due: 0` until a target is recorded.
-- Both are ordinary answers, not errors — a job that logged a failure every
-- five minutes until an operator finished setting it up would train everyone to
-- ignore its failures.
--
-- ---------------------------------------------------------------------------
-- WHY THE CALLER KEY LIVES IN VAULT, AND WHAT THAT DOES NOT HIDE
-- ---------------------------------------------------------------------------
--
-- The Edge Function authorises its caller by comparing the `apikey` header
-- against the project secret key named `provider-poll`, in constant time. So
-- the database must hold that key to call it. It is read from `vault` at
-- dispatch time and never stored in a table this repository owns, never written
-- to the dispatch record, and never returned by any function reachable from a
-- browser.
--
-- What that does NOT do is keep it out of `pg_net`. `net.http_post` writes the
-- request — headers included — into `net.http_request_queue` until the
-- background worker has delivered it. That is inherent to pg_net and is stated
-- here rather than papered over. It is why the migration revokes the `net`
-- schema from every browser role and then MEASURES that it did, instead of
-- assuming a schema nobody exposes is a schema nobody can read.

begin;

-- ---------------------------------------------------------------------------
-- The extension, and proof it landed where the dispatcher looks.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

do $$
begin
  -- The dispatcher names `net.http_post` under an empty search path, so a
  -- version that put its functions elsewhere would fail every five minutes at
  -- run time instead of once, here, where somebody is watching.
  if not exists (
    select 1
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
     where ns.nspname = 'net'
       and proc.proname = 'http_post'
  ) then
    raise exception 'pg_net did not create net.http_post; the dispatcher targets that name';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The outbound capability, and the limit of what this contract can lock down.
--
-- An extension's functions are executable by PUBLIC by default, and Supabase
-- goes further: its platform image grants the `net` schema to `anon`,
-- `authenticated` and `service_role` outright. Left alone that means any path
-- able to execute SQL as one of those roles can make the database fetch an
-- arbitrary URL — server-side request forgery with the database's own network
-- position.
--
-- The first version of this migration revoked all three and asserted the
-- result. CI refused it, and the refusal is the useful part of this comment:
--
--   WARNING (01006): no privileges could be revoked for "net"
--   WARNING (01006): no privileges could be revoked for "http_post"
--   ERROR: a browser or service role can still execute a net function
--
-- PostgreSQL warns rather than errors when a non-owner revokes, so the revoke
-- did NOTHING and only the assertion after it noticed. Measured on hosted
-- development rather than inferred: `postgres` is not a superuser and is not a
-- member of `supabase_admin`, so where the platform installed pg_net this role
-- cannot change its grants at all.
--
-- So the revoke below is best-effort and honestly labelled. It is the control
-- on a project where THIS migration installed the extension and this role owns
-- it; it is a no-op with warnings where the platform owns it. What follows is
-- not an assertion that it worked — that would be the same false claim in a
-- different place — but a measurement of the residual, raised as a notice on
-- every apply, plus a hard assertion of the boundary this contract genuinely
-- controls.
--
-- That boundary is reachability, not the grant. `anon`, `authenticated` and
-- `service_role` reach this database through PostgREST, which exposes `public`
-- and `graphql_public` only — never `net`. So the way a browser role could
-- actually reach pg_net is through a function in an exposed schema that it may
-- execute and whose body calls out. There is none, and the check below fails
-- the migration if one ever appears.
-- ---------------------------------------------------------------------------

revoke all on schema net from public, anon, authenticated, service_role;
revoke all on all functions in schema net from public, anon, authenticated, service_role;
revoke all on all tables in schema net from public, anon, authenticated, service_role;

do $$
declare
  v_residual text;
begin
  -- The revoke is only correct if it left the role that owns the dispatcher
  -- able to call out. A revoke that locked out the job as well would otherwise
  -- be discovered at the first firing rather than here.
  if not pg_catalog.has_function_privilege(
       current_user, 'net.http_post(text, jsonb, jsonb, jsonb, integer)', 'execute') then
    raise exception
      'the net schema revoke also removed % execute on net.http_post, so the dispatcher could not call out',
      current_user;
  end if;

  select string_agg(distinct role_name, ', ' order by role_name)
    into v_residual
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
   where pg_catalog.has_schema_privilege(role_name, 'net', 'usage');

  if v_residual is not null then
    raise notice
      'pg_net is platform-owned here, so its grants survive this migration: % retain access to the net schema. They cannot reach it, because PostgREST exposes public and graphql_public only and no browser-reachable function calls out — which the next check enforces.',
      v_residual;
  end if;

  -- The boundary this contract does control. A function in an exposed schema
  -- that a browser role may execute and whose body reaches `net` is the actual
  -- path from a session to an outbound request, and it is worse when the
  -- function is security definer, so both kinds are in scope.
  if exists (
    select 1
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
     cross join unnest(array['anon', 'authenticated', 'service_role']) as role_name
     where ns.nspname in ('public', 'graphql_public')
       and proc.prosrc is not null
       and proc.prosrc ~ '\mnet\.'
       and pg_catalog.has_function_privilege(role_name, proc.oid, 'execute')
  ) then
    raise exception
      'a browser-reachable function in an exposed schema calls into net, which is a path from a session to an arbitrary outbound request';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- What to poll.
--
-- Scoped to a competition season, because a poll that returns fixtures nobody
-- can place is wasted quota — and because deleting a season should take its
-- polling with it rather than leave a job calling a provider about a
-- competition this platform no longer runs.
-- ---------------------------------------------------------------------------

create table public.provider_poll_targets (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  provider text not null,

  -- Provider-relative, exactly as the Edge Function's `parseRequest` demands.
  -- The bounds below are that function's rules restated as a CHECK, so a target
  -- the Edge Function would reject with a 400 cannot be stored in the first
  -- place. Two copies of one rule is a real cost; the alternative is a row that
  -- burns a dispatch every cadence to be told it was always invalid.
  path text not null,

  cadence_minutes integer not null,

  enabled boolean not null default true,

  last_dispatched_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_poll_targets_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  -- Five is the floor because the schedule below fires every five minutes, so a
  -- smaller cadence would not be honoured and would read as a promise the job
  -- does not keep. A day is the ceiling: a target polled less often than daily
  -- is not a poll, it is a manual refresh with extra machinery.
  constraint provider_poll_targets_cadence_bounded
    check (cadence_minutes between 5 and 1440),

  constraint provider_poll_targets_path_bounded
    check (
      path like '/%'
      and path <> '/'
      and path not like '//%'
      and pg_catalog.strpos(path, '..') = 0
      and pg_catalog.strpos(path, '://') = 0
      and pg_catalog.strpos(path, '#') = 0
      and pg_catalog.char_length(path) <= 1024
    ),

  -- One target means one provider endpoint for one season. Two identical rows
  -- would double the quota spend for identical data.
  constraint provider_poll_targets_identity
    unique (tournament_id, provider, path)
);

comment on table public.provider_poll_targets is
  'Contract 115. One provider endpoint polled on behalf of one competition '
  'season, at a stated cadence. Empty until an operator or a later contract '
  'records a target; this repository holds no authority for a provider''s URL '
  'shape and does not guess one.';

alter table public.provider_poll_targets enable row level security;

revoke all on table public.provider_poll_targets from anon, authenticated, service_role;

create index provider_poll_targets_due_idx
  on public.provider_poll_targets (enabled, last_dispatched_at);

create or replace function predictor_internal.touch_provider_poll_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $touch$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$touch$;

revoke all on function predictor_internal.touch_provider_poll_target()
  from public, anon, authenticated, service_role;

create trigger touch_provider_poll_target
before update on public.provider_poll_targets
for each row
execute function predictor_internal.touch_provider_poll_target();

-- ---------------------------------------------------------------------------
-- Evidence that a dispatch happened, including the ones that did not.
--
-- `net_request_id` is pg_net's handle, which is what correlates this row to the
-- request pg_net actually made. The caller key is deliberately absent: this
-- table records that a poll was sent, not what it was authorised with.
-- ---------------------------------------------------------------------------

create table predictor_internal.provider_poll_dispatches (
  id uuid primary key default gen_random_uuid(),

  target_id uuid not null
    references public.provider_poll_targets(id) on delete cascade,

  dispatched_at timestamptz not null default now(),

  succeeded boolean not null,
  net_request_id bigint,
  error_detail text,

  -- A failure with a request id, or a success with an error, would be a row
  -- that cannot be read as either outcome.
  constraint provider_poll_dispatches_outcome
    check (
      (succeeded and net_request_id is not null and error_detail is null)
      or ((not succeeded) and net_request_id is null and error_detail is not null)
    )
);

comment on table predictor_internal.provider_poll_dispatches is
  'Contract 115. Append-only record of every poll the database sent or failed '
  'to send, correlated to pg_net''s request id. Never holds the caller key.';

alter table predictor_internal.provider_poll_dispatches enable row level security;

revoke all on table predictor_internal.provider_poll_dispatches
  from anon, authenticated, service_role;

create index provider_poll_dispatches_target_idx
  on predictor_internal.provider_poll_dispatches (target_id, dispatched_at desc);

-- ---------------------------------------------------------------------------
-- Which targets are due.
--
-- Separated from the dispatcher on purpose. This is the part with a rule in it,
-- and keeping it callable on its own means the cadence can be proved without
-- sending anything.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.due_provider_poll_targets(
  p_now timestamptz
)
returns table (target_id uuid, provider text, path text)
language sql
stable
security definer
set search_path = ''
as $due$
  select target.id, target.provider, target.path
    from public.provider_poll_targets target
   where target.enabled
     and p_now is not null
     and (
       target.last_dispatched_at is null
       or target.last_dispatched_at
            <= p_now - pg_catalog.make_interval(mins => target.cadence_minutes)
     )
   -- Longest-waiting first, so a target added late is not permanently starved
   -- behind one that polls often. The id tiebreak only makes the order
   -- deterministic; it expresses no priority.
   order by target.last_dispatched_at nulls first, target.id;
$due$;

revoke all on function predictor_internal.due_provider_poll_targets(timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Where to send it, and with what.
--
-- plpgsql rather than SQL because a SQL body is parsed at creation time, and
-- `vault` is a Supabase-provided schema — a language-sql function referencing
-- it would make this migration unreplayable anywhere vault is absent. Late
-- binding also gives the honest answer below: no vault is indistinguishable
-- from no secret, and both mean "not configured yet".
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.provider_poll_endpoint(
  out endpoint_url text,
  out caller_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $endpoint$
begin
  begin
    select secret.decrypted_secret into endpoint_url
      from vault.decrypted_secrets secret
     where secret.name = 'provider_poll_function_url';

    select secret.decrypted_secret into caller_key
      from vault.decrypted_secrets secret
     where secret.name = 'provider_poll_caller_key';
  exception
    when undefined_table or invalid_schema_name then
      endpoint_url := null;
      caller_key := null;
      return;
  end;

  -- An http:// endpoint would send the caller key in clear text. Refusing is
  -- louder than returning null, and correctly so: this is a misconfiguration,
  -- not an absence.
  if endpoint_url is not null and endpoint_url !~ '^https://' then
    raise exception 'provider_poll_function_url must be an https URL'
      using errcode = '22023';
  end if;
end;
$endpoint$;

revoke all on function predictor_internal.provider_poll_endpoint()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The one outbound call.
--
-- Kept to a single function whose only job is the net call, so the dispatcher
-- around it can be tested without sending anything, and so the argument shape
-- has exactly one place to be wrong. Named arguments rather than positional:
-- pg_net has changed its parameter list across versions, and a positional call
-- that silently bound `params` to a headers object would send the caller key as
-- a query string.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.post_provider_poll(
  p_endpoint_url text,
  p_caller_key text,
  p_provider text,
  p_path text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $post$
declare
  v_request_id bigint;
begin
  select net.http_post(
    url => p_endpoint_url,
    body => pg_catalog.jsonb_build_object('provider', p_provider, 'path', p_path),
    headers => pg_catalog.jsonb_build_object(
      'content-type', 'application/json',
      'apikey', p_caller_key
    ),
    -- The Edge Function allows a provider twenty seconds and then archives the
    -- response before replying, so a shorter timeout here would abandon polls
    -- that were about to succeed.
    timeout_milliseconds => 30000
  ) into v_request_id;

  return v_request_id;
end;
$post$;

revoke all on function predictor_internal.post_provider_poll(text, text, text, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The job.
-- ---------------------------------------------------------------------------

create or replace function public.dispatch_due_provider_polls(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $dispatch$
declare
  v_endpoint record;
  v_target record;
  v_request_id bigint;
  v_due integer := 0;
  v_dispatched integer := 0;
  v_failed integer := 0;
begin
  if p_now is null then
    raise exception 'Dispatch time is required'
      using errcode = '22023';
  end if;

  select count(*)::integer into v_due
    from predictor_internal.due_provider_poll_targets(p_now);

  select * into v_endpoint from predictor_internal.provider_poll_endpoint();

  -- Not configured is reported, not raised. The vault secrets are created by an
  -- operator after this migration ships, and a job that failed loudly every
  -- five minutes in the meantime would be noise nobody reads by the time it
  -- means something.
  if v_endpoint.endpoint_url is null or v_endpoint.caller_key is null then
    return pg_catalog.jsonb_build_object(
      'configured', false, 'due', v_due, 'dispatched', 0, 'failed', 0
    );
  end if;

  for v_target in
    select * from predictor_internal.due_provider_poll_targets(p_now)
  loop
    -- Per-target isolation, as the other recurring jobs do it: one unreachable
    -- endpoint must not stop every other season's poll.
    begin
      v_request_id := predictor_internal.post_provider_poll(
        v_endpoint.endpoint_url, v_endpoint.caller_key, v_target.provider, v_target.path
      );

      insert into predictor_internal.provider_poll_dispatches (
        target_id, dispatched_at, succeeded, net_request_id
      ) values (v_target.target_id, p_now, true, v_request_id);

      -- Only a sent poll advances the clock. A failed one stays due, so the
      -- next firing retries it rather than waiting out a cadence it never used.
      update public.provider_poll_targets
         set last_dispatched_at = p_now
       where id = v_target.target_id;

      v_dispatched := v_dispatched + 1;
    exception
      when others then
        insert into predictor_internal.provider_poll_dispatches (
          target_id, dispatched_at, succeeded, error_detail
        ) values (
          v_target.target_id, p_now, false, pg_catalog.left(sqlerrm, 4000)
        );
        v_failed := v_failed + 1;
    end;
  end loop;

  return pg_catalog.jsonb_build_object(
    'configured', true, 'due', v_due, 'dispatched', v_dispatched, 'failed', v_failed
  );
end;
$dispatch$;

revoke all on function public.dispatch_due_provider_polls(timestamptz)
  from public, anon, authenticated, service_role;

-- Every five minutes, which is the resolution of the cadence rather than the
-- polling rate: a target polled hourly is still only polled hourly. The other
-- five jobs run on or near the hour, so this sits on the five-minute grid and
-- shares :00 with them only twelve times a day.
select cron.schedule(
  'provider-poll-dispatch-due-targets',
  '*/5 * * * *',
  'select public.dispatch_due_provider_polls();'
);

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'public'
       and relation.relname = 'provider_poll_targets'
       and relation.relrowsecurity
  ) then
    raise exception 'provider_poll_targets must have row level security enabled';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'predictor_internal'
       and relation.relname = 'provider_poll_dispatches'
       and relation.relrowsecurity
  ) then
    raise exception 'provider_poll_dispatches must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_name in ('provider_poll_targets', 'provider_poll_dispatches')
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can reach a contract 114 table';
  end if;

  -- This migration wires a schedule; it must not also start polling. A target
  -- created here would be a URL nobody chose, called every cadence.
  if exists (select 1 from public.provider_poll_targets) then
    raise exception 'this migration must record no poll targets';
  end if;
end;
$$;

commit;
