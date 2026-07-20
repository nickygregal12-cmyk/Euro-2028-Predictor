-- Euro 2028 Predictor — league → auth.users FK deletion semantics
--
-- Follow-up to 20260719180000_add_leagues.sql, which created the league FKs to
-- auth.users inline. Because that migration used `create table if not exists`,
-- a database where the tables already existed may carry stale constraint
-- definitions — so this migration asserts the intended deletion semantics
-- explicitly and idempotently (drop-if-exists then add).
--
-- In doing so it settles the account-deletion design early (roadmap Phase 3):
--
--   * league_members.user_id  →  ON DELETE CASCADE
--       A member simply drops out of a league when their account is removed.
--       Safe for both the dev-seed wipe and real account deletion.
--
--   * leagues.owner_id         →  ON DELETE RESTRICT
--       A user who still OWNS a league cannot be deleted. This pushes the core
--       invariant — leagues are never orphaned; owners transfer or delete — down
--       to the database, so the future account-deletion flow MUST hand owned
--       leagues over (transfer to a remaining member, or delete the league if
--       they're the last one) BEFORE removing the account, rather than silently
--       destroying every other member's league via a cascade.
--
-- Consequence for tooling: anything that deletes users in bulk (the dev seed's
-- idempotent wipe, an admin purge) must clear the seed/target users' league rows
-- first. The dev seed does this now (scripts/seed-dev/index.ts).

begin;

-- Members cascade: leaving is automatic when the account is gone.
alter table league_members drop constraint if exists league_members_user_id_fkey;
alter table league_members
  add constraint league_members_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Owners restrict: a league is never orphaned by an account deletion.
alter table leagues drop constraint if exists leagues_owner_id_fkey;
alter table leagues
  add constraint leagues_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete restrict;

commit;
