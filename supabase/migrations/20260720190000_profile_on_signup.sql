-- Euro 2028 Predictor — server-side profile creation on sign-up (incident fix)
--
-- Follow-up migration; append-only.
--
-- Fixes the 2026-07-20 incident: with email confirmation ON, sign-up returns NO
-- session, so `auth.uid()` is unset and the client-side `createMyProfile` insert
-- was rejected by the "own profile" RLS policy — leaving a half-created user
-- (auth row, no profile). Root cause: profile creation depended on a client
-- insert that needs a live session.
--
-- Fix: create the profiles row from a trigger on `auth.users` insert instead.
--   * handle_new_user() is SECURITY DEFINER (runs as the function owner, which
--     bypasses RLS) and fires on the auth.users insert itself — so there is NO
--     dependency on a client session or auth.uid(). It works identically whether
--     sign-up returns a session (confirmation off) or not (confirmation on).
--     That is exactly why the no-session failure mode can no longer happen.
--   * The display name comes from the sign-up metadata
--     (raw_user_meta_data->>'display_name'); the client now passes it there.
--     It's clamped to the profiles CHECK (btrim length 1..40), with a 'Player'
--     fallback so a missing/empty name can never fail the insert.
--   * on conflict (id) do nothing — idempotent and safe alongside dev-user.sql /
--     the dev seed, which upsert their own profiles.
--
-- This does NOT enable email confirmation (a separate decision) — it makes it
-- SAFE to enable later. Once this is applied, the client `createMyProfile` call
-- is removed (it's now redundant).
--
-- Idempotent (create or replace / drop-if-exists).

begin;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if v_name = '' then
    v_name := 'Player';
  end if;
  -- Fit the profiles check constraint (btrim length between 1 and 40).
  v_name := btrim(left(v_name, 40));
  if v_name = '' then
    v_name := 'Player';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

commit;
