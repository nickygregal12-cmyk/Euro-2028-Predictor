-- DB-004: `net` is never an exposed API schema, and nothing a browser can call
-- reaches it.
--
-- READ-ONLY. This script contains no INSERT, UPDATE, DELETE, CREATE, ALTER,
-- DROP, GRANT or REVOKE, and it is run against hosted targets — including
-- Production — so that property is not incidental. `netExposureCheck.test.ts`
-- asserts it over this file rather than trusting a reader.
--
-- WHY IT EXISTS AT ALL, GIVEN CONTRACT 115 ALREADY CHECKED THIS.
--
-- `20260805110000_provider_poll_dispatch.sql` raises if a browser-reachable
-- function in an exposed schema calls into `net`. That check runs **once**, in
-- a `do $$ … $$` block, at the instant that migration applies. It cannot see
-- migration 153. A guard that runs when the danger is introduced and never
-- again protects the day it was written and no other.
--
-- And it never covered the larger half. `pg_net`'s grants belong to the
-- platform: `anon`, `authenticated` and `service_role` retain usage on the
-- `net` schema and execute on `net.http_post`, and `postgres` is neither
-- superuser nor a member of `supabase_admin` here, so it cannot revoke them.
-- The contract-115 migration reports this by notice rather than hiding it. What
-- makes it unreachable is that PostgREST exposes `public` and `graphql_public`
-- and nothing else — a fact that lives in the **project's API settings**, not
-- in any migration, and which no migration could assert even if it wanted to.
--
-- So the exploit is one API-settings change away, in a console, by someone who
-- has no reason to connect "expose the net schema" with "hand every browser
-- session an arbitrary outbound HTTP request". That is the thing this file
-- watches, and it can only be watched from the hosted target.
--
-- Usage:
--   psql "$SUPABASE_DEV_DB_URL"  -v ON_ERROR_STOP=1 -f supabase/checks/net-exposure.sql
--   psql "$SUPABASE_PROD_DB_URL" -v ON_ERROR_STOP=1 -f supabase/checks/net-exposure.sql

\set ON_ERROR_STOP on

do $$
declare
  v_config    text;
  v_schemas   text;
  v_residual  text;
  v_offenders text;
begin
  -- -----------------------------------------------------------------------
  -- 1. The exposed schema list, read from where PostgREST actually reads it.
  -- -----------------------------------------------------------------------
  -- Supabase configures the Data API by setting `pgrst.db_schemas` on the
  -- `authenticator` role. Reading the role config is reading the setting
  -- itself, rather than reading a copy of it that could disagree.
  select array_to_string(rolconfig, E'\n')
    into v_config
    from pg_catalog.pg_roles
   where rolname = 'authenticator';

  if v_config is null then
    -- FAIL CLOSED. No authenticator role, or no configuration on it, means
    -- this script cannot see what is exposed — which is not the same as
    -- nothing being exposed, and must never be reported as if it were.
    raise exception
      'Could not read pgrst.db_schemas from the authenticator role. The exposed schema list is UNKNOWN, which this check treats as a failure rather than a pass.';
  end if;

  select (regexp_match(v_config, 'pgrst\.db_schemas=([^\n]*)'))[1] into v_schemas;

  if v_schemas is null then
    raise exception
      'The authenticator role carries configuration but no pgrst.db_schemas entry. The exposed schema list is UNKNOWN.';
  end if;

  if exists (
    select 1
      from unnest(string_to_array(v_schemas, ',')) as s
     where btrim(s) = 'net'
  ) then
    raise exception
      'THE net SCHEMA IS EXPOSED THROUGH THE DATA API (pgrst.db_schemas = %). Every browser session can reach net.http_post directly, which is arbitrary outbound HTTP from this database. Remove it from the project API settings immediately.',
      v_schemas;
  end if;

  raise notice 'Exposed API schemas: % — net is not among them.', v_schemas;

  -- -----------------------------------------------------------------------
  -- 2. No browser-callable function in an exposed schema reaches `net`.
  -- -----------------------------------------------------------------------
  -- Contract 115's own check, lifted out of the one-shot `do` block it was
  -- written in so it runs whenever this is run. Security definer functions are
  -- deliberately in scope and are the worse case, not an exception to it.
  --
  -- Scoped to whatever is ACTUALLY exposed rather than to a hard-coded pair, so
  -- exposing a third schema brings its functions under the check automatically
  -- instead of quietly leaving them outside it.
  select string_agg(format('%s.%s', ns.nspname, proc.proname), ', ' order by proc.proname)
    into v_offenders
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
   cross join unnest(array['anon', 'authenticated']) as role_name
   where ns.nspname = any (
           select btrim(s) from unnest(string_to_array(v_schemas, ',')) as s
         )
     and proc.prosrc is not null
     and proc.prosrc ~ '\mnet\.'
     and pg_catalog.has_function_privilege(role_name, proc.oid, 'execute');

  if v_offenders is not null then
    raise exception
      'A browser-callable function in an exposed schema calls into net: %. That is a path from a session to an arbitrary outbound request.',
      v_offenders;
  end if;

  raise notice 'No browser-callable function in an exposed schema references net.';

  -- -----------------------------------------------------------------------
  -- 3. The platform-owned residue, REPORTED and not failed.
  -- -----------------------------------------------------------------------
  -- Failing on this would make the check permanently red on a condition
  -- nobody here can change, which is how a check stops being read. DB-004
  -- records it as latent and contained; this prints it so "contained" keeps
  -- being a thing someone observes rather than a thing someone remembers.
  select string_agg(role_name, ', ' order by role_name)
    into v_residual
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
   where pg_catalog.has_schema_privilege(role_name, 'net', 'usage');

  if v_residual is not null then
    raise notice
      'Platform-owned residue (expected, DB-004): % retain usage on the net schema. They cannot reach it while the two checks above pass.',
      v_residual;
  else
    raise notice 'No browser role holds usage on the net schema.';
  end if;

  raise notice 'DB-004 net exposure check PASSED.';
end;
$$;
