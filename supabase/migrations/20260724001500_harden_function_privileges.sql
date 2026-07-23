-- Euro 2028 Predictor — harden function execution privileges and search paths
--
-- SECURITY-003 follow-up. PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default. Supabase may also materialise direct grants for API roles. This migration
-- closes the public schema by default, removes every inherited/direct browser grant,
-- and then restores only the application and trusted-service RPC allowlists.
--
-- Trigger and helper functions do not need Data API execution grants. PostgreSQL
-- executes trigger functions through the installed trigger, and SECURITY DEFINER
-- callers execute helpers as the owning postgres role.

begin;

-- Future functions created by the migration owner start closed. Every new public RPC
-- must opt in with an explicit role grant in the migration that creates it.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

-- Remove inherited PUBLIC execution and every current direct API-role grant first.
revoke execute on all functions in schema public
  from public, anon, authenticated, service_role;

-- Browser-facing RPCs. Every function below contains its own authentication,
-- ownership, co-membership and/or post-lock boundary as appropriate.
grant execute on function public.submit_entry(uuid)
  to authenticated, service_role;
grant execute on function public.replace_predicted_progression(uuid, jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.get_leaderboard(uuid)
  to authenticated, service_role;
grant execute on function public.create_league(uuid, text)
  to authenticated, service_role;
grant execute on function public.get_league_preview(text)
  to authenticated, service_role;
grant execute on function public.join_league(text)
  to authenticated, service_role;
grant execute on function public.get_my_leagues(uuid)
  to authenticated, service_role;
grant execute on function public.get_league(uuid)
  to authenticated, service_role;
grant execute on function public.get_league_members(uuid)
  to authenticated, service_role;
grant execute on function public.leave_league(uuid)
  to authenticated, service_role;
grant execute on function public.transfer_ownership(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.delete_league(uuid)
  to authenticated, service_role;
grant execute on function public.get_rival_entry(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.get_league_match_picks(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.get_match_prediction_distribution(uuid)
  to authenticated, service_role;

-- Trusted result/scoring operations. These are never browser-callable.
grant execute on function public.recompute_tournament_scores(uuid)
  to service_role;
grant execute on function public.recompute_all_scores()
  to service_role;
grant execute on function public.capture_rank_history(uuid)
  to service_role;
grant execute on function public.confirm_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.correct_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.clear_match_result(uuid, text)
  to service_role;

-- These pure/trigger helpers previously inherited the caller's mutable search path.
-- Their bodies do not resolve database relations, so an empty path is both safe and
-- sufficient.
alter function public.gen_invite_code() set search_path = '';
alter function public._stage_ord(text) set search_path = '';
alter function public.enforce_write_version() set search_path = '';

commit;
