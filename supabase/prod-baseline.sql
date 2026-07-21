-- Euro 2028 Predictor — PRODUCTION baseline configuration
--
-- PROD-SAFE. This is the minimum a fresh PRODUCTION database needs to run once
-- the schema (all migrations) and the fixture skeleton are in place.
--
-- WHAT THIS FILE DOES:
--   * Verifies the fixture/bracket skeleton exists (fails loudly if not).
--   * Sets the tournament LOCK instant (tournaments.lock_at) — the moment
--     predictions freeze. Derived from the established repo value starts_on
--     (see the note by the UPDATE), so there is no second copy of that date.
--   * Idempotent: safe to re-run; never clobbers a lock_at an admin has already
--     tightened by hand.
--
-- WHAT THIS FILE DOES NOT DO (deliberately — it is baseline, not seed data):
--   * NO fixture list. The tournament, groups, 24 TBD teams and all 51 matches
--     come from `supabase/seed.sql`, which is the SINGLE source of truth for the
--     fixture skeleton (do not duplicate it here). RUN seed.sql FIRST.
--   * NO users, profiles, entries, predictions, results, leagues or any hostile
--     / test data. Production starts empty of people.
--
-- APPLY ORDER on a fresh prod project (see docs/ops-prod-cutover.md):
--   1. all migrations, in strict timestamp order (schema)
--   2. supabase/seed.sql       — the fixture / bracket skeleton (TBD teams)
--   3. supabase/prod-baseline.sql  — THIS FILE (tournament config / lock_at)

begin;

-- Guard: the fixture skeleton must already be loaded (seed.sql). If the
-- tournament row is missing, refuse rather than silently configuring nothing.
do $$
begin
  if not exists (select 1 from tournaments where name = 'UEFA Euro 2028') then
    raise exception
      'Fixture skeleton not found. Run supabase/seed.sql BEFORE prod-baseline.sql '
      '(it creates the UEFA Euro 2028 tournament, groups, teams and 51 matches).';
  end if;
end $$;

-- Lock instant. lock_at is derived from the tournament's established start date
-- (starts_on = 2028-06-09, the MD1 date in seed.sql) rather than a re-typed
-- literal, so the date has one home. NOTE: per-match kick-off TIMES are unknown
-- until UEFA confirms them (post-2027), so this resolves to 00:00 UTC on the MD1
-- date — a safe, ~2-years-out lock that MUST be tightened to the real MD1
-- kick-off instant before the tournament approaches. The `lock_at is null` guard
-- keeps a hand-set value intact on re-run.
update tournaments
set lock_at = starts_on::timestamptz
where name = 'UEFA Euro 2028'
  and lock_at is null
  and starts_on is not null;

commit;

-- Verification (run after applying; expect one row, lock_at = 2028-06-09 00:00+00):
--   select name, year, starts_on, ends_on, lock_at,
--          (select count(*) from matches m
--             where m.tournament_id = t.id) as match_count
--   from tournaments t
--   where name = 'UEFA Euro 2028';
-- Expect match_count = 51. If lock_at is null, seed.sql set no starts_on — investigate.
