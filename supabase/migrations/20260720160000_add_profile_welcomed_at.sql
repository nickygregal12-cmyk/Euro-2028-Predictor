-- Euro 2028 Predictor — /welcome seen-tracking column
--
-- Follow-up migration; append-only.
--
-- The /welcome orientation screen (design-system §6) is shown once, on first
-- sign-in, before Home. `welcomed_at` records when the user first saw it — null
-- means "never seen, show it". It's on `profiles` (not client storage) so the
-- once-only guarantee survives across devices.
--
-- No new RLS: the existing "own profile" policy already lets a user read and
-- update their own row, which is all the gate needs. Nullable — every existing
-- profile reads as "not yet welcomed" until it's stamped (real signups then see
-- it once; the dev user is pre-stamped by supabase/dev-user.sql so it never
-- appears in dev flows, with no dev-user special-casing in app code).
--
-- Idempotent (add column if not exists).

begin;

alter table profiles add column if not exists welcomed_at timestamptz null default null;

commit;
