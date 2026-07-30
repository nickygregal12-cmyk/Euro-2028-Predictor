-- Euro 2028 Predictor — declare bonus_cup_fixtures.winner_user_id deletion semantics
--
-- Follow-up to 20260729050000_predictor_cup_knockouts.sql, which added
-- `winner_user_id uuid references auth.users (id)` with no `on delete` clause.
-- PostgreSQL defaults an omitted clause to NO ACTION, so the behaviour was
-- implied rather than chosen — the only one of six foreign keys on this table
-- that does not state its action, and the only reference to auth.users in the
-- whole migration set that leaves it unsaid.
--
-- This migration changes no behaviour. NO ACTION and RESTRICT are equivalent
-- for a non-deferrable constraint: both reject the delete, differing only in
-- when the check may be deferred, and this constraint is not deferrable. What
-- changes is that the deletion semantics become readable at the schema rather
-- than inherited from a default.
--
-- RESTRICT is not a preference, it is the only viable action here:
--
--   * SET NULL is impossible. `bonus_cup_fixtures_settle_shape` asserts
--       (winner_user_id is null) = (decided_by is null)
--       (winner_user_id is null) = (settled_at is null)
--     so nulling the winner while decided_by and settled_at remain set would
--     violate the check and fail the delete anyway — with a confusing error
--     instead of a clear one.
--
--   * CASCADE is wrong. It would delete a settled cup tie because one of its
--     participants left, silently altering another player's bracket.
--
--   * RESTRICT is already implied. `bonus_cup_fixtures_winner_played` requires
--     the winner to be the home or away user, and both of those already
--     RESTRICT through the composite entrant foreign keys. Declaring it here
--     states what the table already guarantees.
--
-- Consequence, unchanged by this migration and recorded so it is not
-- rediscovered: a user who has won a Predictor Cup tie cannot be deleted until
-- that competition's rows are dealt with. That is a second deletion blocker
-- alongside leagues.owner_id, and unlike leagues it has no documented hand-over
-- flow. Settling that belongs to the Stage C account-deletion design, not here.
-- See docs/quality/investigations/ for the 30 July 2026 foreign-key survey.

begin;

alter table public.bonus_cup_fixtures
  drop constraint if exists bonus_cup_fixtures_winner_user_id_fkey;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_winner_user_id_fkey
  foreign key (winner_user_id) references auth.users (id) on delete restrict;

commit;
