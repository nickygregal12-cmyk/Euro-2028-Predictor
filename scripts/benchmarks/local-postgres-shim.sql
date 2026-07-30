-- Minimum Supabase-compatible surface for applying the committed migrations to
-- a plain PostgreSQL cluster, so measurement harnesses can run where container
-- images cannot be pulled.
--
-- NOT a substitute for the local-supabase CI job, which runs the real stack
-- with db lint and pgTAP. This only makes the schema loadable.
--
--   psql -d <db> -f local-postgres-shim.sql
--   for f in supabase/migrations/*.sql; do psql -d <db> -f "$f"; done
--   psql -d <db> -f supabase/seed.sql
--
-- pg_cron is referenced by one migration via `create extension`. Where the
-- extension is unavailable, provide a stub control file before applying:
--   $SHAREDIR/extension/pg_cron.control  (default_version = '1.0')
--   $SHAREDIR/extension/pg_cron--1.0.sql (cron.schedule / cron.unschedule)

-- Roles are cluster-wide, so this must be safe to re-run against a second
-- database in the same cluster — which is exactly what a verification rebuild
-- does. `create role anon` on the second database otherwise aborts the shim,
-- and the migrations then fail with "schema auth does not exist", pointing at
-- the wrong cause.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role','supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin noinherit', r);
    end if;
  end loop;
  execute 'grant anon, authenticated, service_role, supabase_auth_admin to postgres';
  execute 'alter role service_role bypassrls';
end $$;

create extension if not exists pgcrypto;
create schema if not exists auth;

-- Only the columns the migrations and harnesses touch. raw_user_meta_data is
-- required: public.handle_new_user() reads it to derive a display name.
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                varchar(255),
  role               varchar(255),
  email              varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  created_at         timestamptz,
  updated_at         timestamptz
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
