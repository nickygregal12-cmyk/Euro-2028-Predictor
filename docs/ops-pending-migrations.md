# Ops note — Pending migrations (apply in the Supabase SQL editor)

The single source of truth for which migrations are **live in the dev database** vs. **code-complete but not yet applied**. Several Phase 2 features are marked `[x]` (done in code) but fail soft until their migration runs — so this list is what actually blocks the single-tester run being meaningful and the production-project split.

**How this was built:** by reading the migration files on disk, every application confirmation recorded in `CLAUDE.md`/`build-todo.md`/`roadmap.md`, and a **first-hand chat verification pass (2026-07-20)** that functionally checked the most recent batch against the live dev DB. The 7 migrations `20260720150000`–`20260720210000` were confirmed applied in that pass (see "Verification pass" below). Everything from `20260720140000` and earlier — **including the initial schema and the leagues + core scoring migrations** — has **no first-hand proof in this conversation** and must get a genuine live check before the single-tester run.

## Rules

- **Apply in strict timestamp order.** Migrations are append-only and several *redefine* objects created by earlier ones (e.g. `20260720140000` fixes a trigger from `20260720130000`; `20260720180000` redefines `recompute_tournament_scores()`). Applying out of order will produce a wrong final state.
- Run each file's full contents in the dashboard SQL editor. Tick it here once confirmed applied.
- **Do this whole list as part of the production-project setup** (Phase 2 exit gate) — a fresh prod project needs the entire ordered set, not just the "still to run" ones.
- The app is designed to fail soft before each migration (features error or read as empty), so dev keeps running; that's why these drifted out of sync in the first place.

## Status legend

- ✅ **Confirmed applied** — functionally verified first-hand in the 2026-07-20 chat verification pass.
- 🟡 **Documented applied (unverified here)** — recorded as applied in prior docs and the app demonstrably runs on it, but there is **no first-hand proof in this conversation**; include it in the live check before the single-tester run.
- ⛔ **Pending** — no application recorded and no first-hand proof; assume NOT live until a genuine live check.

## The list

| # | Migration | Purpose | Status |
|---|-----------|---------|--------|
| 1 | `20260719120000_init_v0_1.sql` | Initial v0.1 schema: profiles, tournament reference data, entries + predictions; RLS on every table | 🟡 Documented (CLAUDE.md); needs live check |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Adds the `joker` flag to `match_predictions` (§1 doubling) | ⛔ Pending |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | `predicted_tie_resolutions` table — manual third-place tie ordering | ⛔ Pending |
| 4 | `20260719150000_enforce_joker_rules.sql` | `match_predictions` trigger: max 5 jokers/entry + no set/change after kickoff | ⛔ Pending |
| 5 | `20260719160000_add_bonus_and_submit.sql` | `players`, `bonus_predictions`, and the `submit_entry()` completeness validator | ⛔ Pending |
| 6 | `20260719170000_lock_and_leaderboard.sql` | `tournaments.lock_at` + entry-lock BEFORE triggers + `get_leaderboard()` | ⛔ Pending |
| 7 | `20260719180000_add_leagues.sql` | `leagues` + `league_members` + SECURITY DEFINER league functions | ⛔ Pending |
| 8 | `20260720120000_league_fk_semantics.sql` | FK deletion semantics: `leagues.owner_id` → RESTRICT, `league_members.user_id` → CASCADE | ⛔ Pending |
| 9 | `20260720130000_add_scoring.sql` | Scoring engine: `score_events`, `entry_totals` view, `recompute_tournament_scores()` + `matches` result trigger | ⛔ Pending |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Fix: recompute fires on same-value result re-writes; `service_role` grant | ⛔ Pending |
| 11 | `20260720150000_add_last_seen.sql` | `profiles.last_seen_at` / `last_seen_points` for Home's catch-up line | ✅ Confirmed (verification pass) |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | `profiles.welcomed_at` for the once-only /welcome gate | ✅ Confirmed (verification pass) |
| 13 | `20260720170000_reveal_after_lock.sql` | `get_rival_entry()` reveal-after-lock endpoint (post-lock + co-membership) | ✅ Confirmed (verification pass) |
| 14 | `20260720180000_add_rank_history.sql` | `rank_history` table + `capture_rank_history()` + recompute hook | ✅ Confirmed (verification pass) |
| 15 | `20260720190000_profile_on_signup.sql` | `handle_new_user()` / `on_auth_user_created` — server-side profile creation (2026-07-20 incident fix) | ✅ Confirmed (verification pass) |
| 16 | `20260720200000_display_name_moderation.sql` | `enforce_display_name_policy` BEFORE trigger on `profiles` | ✅ Confirmed (functional — see below) |
| 17 | `20260720210000_rate_limits.sql` | `rate_limit_events` + `enforce_rate_limit()` triggers (prediction save 60/min, league join 5/min) | ✅ Confirmed (trigger state — see below) |

## Verification pass — 2026-07-20 (first-hand)

Migrations `20260720150000`–`20260720210000` were confirmed applied against the live dev DB in this conversation. For the two with the most security weight, the method is recorded:

- **`20260720200000_display_name_moderation`** — confirmed **functionally**: attempted to set a profile's `display_name` to `"Admin"` directly via `UPDATE`, and the `enforce_display_name_policy()` trigger correctly raised `"display name not allowed"` (SQLSTATE `23514`), blocking the write. A real functional rejection, not just trigger existence.
- **`20260720210000_rate_limits`** — confirmed **applied**: both `rate_limit_prediction_save` (on `match_predictions`) and `rate_limit_league_membership` (on `league_members`) triggers exist and are enabled (`tgenabled = 'O'`). Full live rate-limit-breach testing was **not** performed (would require staging rapid repeated calls), but combined with the existing unit-tested pure-logic mirror (`src/domain/rateLimit.ts`), this is treated as sufficiently confirmed.
- **`add_last_seen`, `add_profile_welcomed_at`, `reveal_after_lock`, `add_rank_history`, `profile_on_signup`** — confirmed applied as part of the same verification pass.

**Everything before this pass (`≤ 20260720140000`, incl. the initial schema, leagues, and the core scoring-into-DB migrations) has no first-hand proof in this conversation** and should stay flagged as needing a genuine live check before the single-tester run — even the initial schema (the app running proves *something* is there, but it was not re-verified here).

## Order-sensitive callouts

- **#15 (`…_profile_on_signup`) must be applied before any real sign-up** (confirmed applied on dev). The client `createMyProfile` was removed, so without this trigger a new sign-up creates an auth user with no `profiles` row.
- **#9 → #10 → #14 touch the same scoring objects.** Apply in order; #10 fixes #9's trigger, and #14 (confirmed) redefines `recompute_tournament_scores()` to also capture rank history — note #14 is confirmed applied but the scoring migrations it builds on (#9/#10) are NOT, so on a fresh prod project the whole chain must be re-applied in order.
- **After #14, backfill rank history once:** `select capture_rank_history('<tournament-id>');` (the trigger only fires on future writes, so already-completed matchdays need one manual capture).
- **After the scoring migrations (#9, #10) are applied, re-run the dev seed** `npx tsx scripts/seed-dev/index.ts --commit` and confirm the overall leaderboard matches `tests/scripts/scoreEntries.test.ts` (the acceptance test).

## Related seed files (not migrations, but part of a fresh DB)

- `supabase/seed.sql` — the fixture skeleton (tournament, teams, groups, matches). Run once if a DB isn't already seeded.
- `supabase/dev-user.sql` — the seeded dev auto-login user (dev only; pre-stamped `welcomed_at`). Never run in production.

## Keeping this honest

When you apply a migration, flip its row to ✅ here **in the same session**, note how it was verified, and reconcile the per-item "Migration to apply" flags in `build-todo.md` + the "still to run" block in `CLAUDE.md`. This doc is the index; those are the scattered references it replaces.
