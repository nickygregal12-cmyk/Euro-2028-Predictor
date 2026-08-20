-- ===========================================================================
-- CAP — remove exactly what the deadline-burst seed created, and nothing else.
-- ===========================================================================
--
-- Every row the seed writes carries a `cab00000-…` identifier, which is what
-- makes this exact rather than approximate: it deletes by that namespace, not
-- by "everything recent" or "everything in this season". A teardown that
-- guesses is worse than none, because it runs against a database somebody
-- still needed.
--
-- Deletion order follows the foreign keys inwards: the writes players made,
-- then their memberships, then the players, then the football.
--
--   psql -d <db> -f scripts/benchmarks/cap-deadline-burst-teardown.sql
-- ===========================================================================

\set ON_ERROR_STOP on

begin;

-- TRIGGERS OFF FOR THE WHOLE TEARDOWN, and the reason is a product rule
-- working rather than a shortcut. `game_membership_events` is append-only —
-- `predictor_internal.block_game_membership_event_mutation` refuses a delete
-- outright — which is correct for an audit table and means a benchmark cannot
-- tidy up after itself without saying so explicitly. `replica` also lifts the
-- foreign keys, which is harmless here because the deletions below already go
-- in dependency order. It is restored before the commit.
set local session_replication_role = replica;

-- Writes made DURING a run, which are not in the namespace themselves — they
-- are keyed to entries that are.
delete from public.season_matchweek_jokers
 where entry_id::text like 'cab00000-0000-0000-0004-%';
delete from public.season_predictions
 where entry_id::text like 'cab00000-0000-0000-0004-%';
delete from public.season_matchweek_cards
 where entry_id::text like 'cab00000-0000-0000-0004-%';
delete from public.player_action_items
 where user_id::text like 'cab00000-0000-0000-0003-%';
delete from public.player_action_state
 where user_id::text like 'cab00000-0000-0000-0003-%';

delete from public.league_members
 where league_id::text like 'cab00000-0000-0000-0005-%';
delete from public.leagues
 where id::text like 'cab00000-0000-0000-0005-%';
-- The invite code outlives the league it belonged to: a trigger registers it
-- and nothing un-registers it on delete, which is right for a registry whose
-- job is to stop a code being reissued — and which means a teardown that
-- forgets it makes the next seed fail on a primary key. Found exactly that way.
delete from public.invite_code_registry
 where league_id::text like 'cab00000-0000-0000-0005-%';

delete from public.game_membership_events
 where user_id::text like 'cab00000-0000-0000-0003-%';
delete from public.entries
 where id::text like 'cab00000-0000-0000-0004-%';
delete from public.game_memberships
 where user_id::text like 'cab00000-0000-0000-0003-%';
delete from public.profiles
 where id::text like 'cab00000-0000-0000-0003-%';

delete from auth.users
 where id::text like 'cab00000-0000-0000-0003-%';

delete from public.season_fixtures
 where id::text like 'cab00000-0000-0000-0002-%';
delete from public.teams
 where id::text like 'cab00000-0000-0000-0001-%';
delete from public.competition_rounds
 where id::text like 'cab00000-0000-0000-0000-%';

set local session_replication_role = origin;

drop table if exists public.cap_burst_outcomes;
drop table if exists public.cap_burst_fixture;
drop table if exists public.cap_burst_config;
drop function if exists public.cap_burst_as(integer);
drop function if exists public.cap_burst_record(text, timestamptz, boolean, text);
drop function if exists public.cap_burst_card(integer);
drop function if exists public.cap_burst_save(integer, integer);
drop function if exists public.cap_burst_confirm(integer);
drop function if exists public.cap_burst_standings(integer);
drop function if exists public.cap_burst_actions(integer);

commit;

select 'torn down' as state,
       (select count(*) from auth.users) as auth_users_remaining;
