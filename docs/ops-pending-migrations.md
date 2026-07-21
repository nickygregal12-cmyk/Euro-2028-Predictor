# Ops note — Migration applied-state + prod-setup checklist

The single source of truth for which migrations are **live in the dev database**, and the ordered set to apply when standing up the **production** project.

**STATUS (2026-07-21): all 18 migrations are confirmed applied to the dev DB — nothing is pending.** The earlier "pending" flags were stale (applied in unrecorded sessions, exactly the drift this doc warns about). The dev migration prerequisite for the single-tester exit gate is therefore **satisfied**; the fresh-**production**-project split still needs the whole ordered set applied from scratch.

**How this was built:** by reading the migration files on disk, every application confirmation in `CLAUDE.md`/`build-todo.md`/`roadmap.md`, a **first-hand chat verification pass (2026-07-20)** for `20260720150000`–`20260720210000` (see "Verification pass"), the **scoring-completion verification** for `20260721120000`, and finally a **full applied-state check (2026-07-21)** that reconciled the remaining rows against the live dev DB — a read-only REST probe (tables/columns) plus a dashboard SQL query for the trigger/function/constraint bits the anon key can't see (see "Full applied-state verification"). Every row is now ✅.

## Rules (for the production-project setup)

Dev is fully applied; these rules govern applying the set to a **fresh prod project**:

- **Apply in strict timestamp order.** Migrations are append-only and several *redefine* objects created by earlier ones (e.g. `20260720140000` fixes a trigger from `20260720130000`; `20260720180000` and `20260721120000` each redefine `recompute_tournament_scores()`). Applying out of order will produce a wrong final state.
- Run each file's full contents in the dashboard SQL editor, then confirm with the "Full applied-state verification" query below.
- The app fails soft before each migration (features error or read as empty), so a partially-migrated project keeps running — which is exactly why the dev applied-state drifted out of sync with this doc in the first place. Verify against the live DB, don't trust the flags alone.

## Status legend

- ✅ **Confirmed applied** — verified against the live dev DB (read-only REST probe for tables/columns, dashboard SQL for triggers/functions/constraints, or a first-hand functional check).

## The list

| # | Migration | Purpose | Status |
|---|-----------|---------|--------|
| 1 | `20260719120000_init_v0_1.sql` | Initial v0.1 schema: profiles, tournament reference data, entries + predictions; RLS on every table | ✅ Confirmed (probe — see below) |
| 2 | `20260719130000_add_match_prediction_joker.sql` | Adds the `joker` flag to `match_predictions` (§1 doubling) | ✅ Confirmed (probe) |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | `predicted_tie_resolutions` table — manual third-place tie ordering | ✅ Confirmed (probe) |
| 4 | `20260719150000_enforce_joker_rules.sql` | `match_predictions` trigger: max 5 jokers/entry + no set/change after kickoff | ✅ Confirmed (dashboard) |
| 5 | `20260719160000_add_bonus_and_submit.sql` | `players`, `bonus_predictions`, and the `submit_entry()` completeness validator | ✅ Confirmed (probe + dashboard) |
| 6 | `20260719170000_lock_and_leaderboard.sql` | `tournaments.lock_at` + entry-lock BEFORE triggers + `get_leaderboard()` | ✅ Confirmed (probe + dashboard) |
| 7 | `20260719180000_add_leagues.sql` | `leagues` + `league_members` + SECURITY DEFINER league functions | ✅ Confirmed (probe + dashboard) |
| 8 | `20260720120000_league_fk_semantics.sql` | FK deletion semantics: `leagues.owner_id` → RESTRICT, `league_members.user_id` → CASCADE | ✅ Confirmed (dashboard) |
| 9 | `20260720130000_add_scoring.sql` | Scoring engine: `score_events`, `entry_totals` view, `recompute_tournament_scores()` + `matches` result trigger | ✅ Confirmed (implied — see below) |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Fix: recompute fires on same-value result re-writes; `service_role` grant | ✅ Confirmed (implied — see below) |
| 11 | `20260720150000_add_last_seen.sql` | `profiles.last_seen_at` / `last_seen_points` for Home's catch-up line | ✅ Confirmed (verification pass) |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | `profiles.welcomed_at` for the once-only /welcome gate | ✅ Confirmed (verification pass) |
| 13 | `20260720170000_reveal_after_lock.sql` | `get_rival_entry()` reveal-after-lock endpoint (post-lock + co-membership) | ✅ Confirmed (verification pass) |
| 14 | `20260720180000_add_rank_history.sql` | `rank_history` table + `capture_rank_history()` + recompute hook | ✅ Confirmed (verification pass) |
| 15 | `20260720190000_profile_on_signup.sql` | `handle_new_user()` / `on_auth_user_created` — server-side profile creation (2026-07-20 incident fix) | ✅ Confirmed (verification pass) |
| 16 | `20260720200000_display_name_moderation.sql` | `enforce_display_name_policy` BEFORE trigger on `profiles` | ✅ Confirmed (functional — see below) |
| 17 | `20260720210000_rate_limits.sql` | `rate_limit_events` + `enforce_rate_limit()` triggers (prediction save 60/min, league join 5/min) | ✅ Confirmed (trigger state — see below) |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Scoring completion: §2 group positions + §3 knockout + §4 awards into `score_events`; adds `tournaments.golden_boot_player_id`; redefines `recompute_tournament_scores()` (still calls `capture_rank_history()`); broadens the result trigger + adds a golden-boot trigger | ✅ Confirmed (functional — see below) |

## Verification pass — 2026-07-20 (first-hand)

Migrations `20260720150000`–`20260720210000` were confirmed applied against the live dev DB in this conversation. For the two with the most security weight, the method is recorded:

- **`20260720200000_display_name_moderation`** — confirmed **functionally**: attempted to set a profile's `display_name` to `"Admin"` directly via `UPDATE`, and the `enforce_display_name_policy()` trigger correctly raised `"display name not allowed"` (SQLSTATE `23514`), blocking the write. A real functional rejection, not just trigger existence.
- **`20260720210000_rate_limits`** — confirmed **applied**: both `rate_limit_prediction_save` (on `match_predictions`) and `rate_limit_league_membership` (on `league_members`) triggers exist and are enabled (`tgenabled = 'O'`). Full live rate-limit-breach testing was **not** performed (would require staging rapid repeated calls), but combined with the existing unit-tested pure-logic mirror (`src/domain/rateLimit.ts`), this is treated as sufficiently confirmed.
- **`add_last_seen`, `add_profile_welcomed_at`, `reveal_after_lock`, `add_rank_history`, `profile_on_signup`** — confirmed applied as part of the same verification pass.

(Everything before this pass was later reconciled by the 2026-07-21 full check below.)

## Full applied-state verification — 2026-07-21 (dev DB)

Reconciled the last unverified rows (#1–#8) against the live dev DB — resolving the stale "pending" flags:

- **Read-only REST probe** (the app's anon key, via PostgREST): confirmed the tables/columns EXIST for the initial schema (`entries`, `matches`), `match_predictions.joker` (#2), `predicted_tie_resolutions` (#3), `players` + `bonus_predictions` (#5), `tournaments.lock_at` (#6), and `leagues` + `league_members` (#7). A missing table returns a PostgREST schema error; all returned 200.
- **Dashboard SQL query** (for the trigger/function/constraint bits the anon key can't see — SECURITY DEFINER functions are revoked from anon): confirmed the `enforce_joker_rules` trigger (#4), `submit_entry()` (#5), `get_leaderboard()` (#6), the league functions e.g. `create_league()` (#7), and the FK deletion rules `leagues.owner_id` → RESTRICT + `league_members.user_id` → CASCADE (#8) — all present.

Since each migration is a single atomic `begin;…commit;`, a present table/column implies its whole migration committed (triggers + functions included); the dashboard query confirmed the standalone trigger/constraint migrations too. **Conclusion: the full set (1–18) is live on dev.**

## Scoring-completion verification — `20260721120000` (first-hand)

Confirmed applied against the dev DB in a later chat session:

- Migration `20260721120000_scoring_positions_knockout_awards` applied successfully.
- `recompute_tournament_scores()` confirmed present; `tournaments.golden_boot_player_id` column confirmed present.
- Dev seed re-run (`--commit`): the overall leaderboard is **unchanged** (Cristiano 30, xX_Predictor_Xx 27, …) and matches `tests/scripts/scoreEntries.test.ts` — proving §2/§3/§4 correctly score **0** on the still-incomplete seeded data (no complete groups, no KO results, no golden boot set) with no regression to §1.
- `rank_history` confirmed still capturing — 22 rows for MD1 after the re-seed.

Note: this confirms the pipeline is live and byte-identical to the reference on partial data; it does **not** yet exercise §2/§3/§4 with non-zero output (that needs a complete group / KO participants / an actual golden boot). Those paths are covered by the reference scenario tests (`tests/domain/scoringCompletion.test.ts`) and remain to be seen live when real results land.

**Transitively confirms #9 and #10.** #18 `create or replace`s `recompute_tournament_scores()` and inserts into `score_events` — it cannot apply unless #9 (`add_scoring`, which creates that table/view/function + the result trigger) is already live. And the leaderboard showing real §1 totals after a `--commit` re-seed — which re-writes the same deterministic results after wiping entries — only works because #10 removed the "same value → skip recompute" early-return (without #10 those re-written entries would score 0). So the scoring-completion verification is first-hand proof that #9 and #10 are applied, even though they were never directly checked in a recorded session. Marked ✅ on that basis (was: the doc's own "applied in an unrecorded session" caveat, now resolved for these two).

## Order-sensitive callouts

- **#15 (`…_profile_on_signup`) must be applied before any real sign-up** (confirmed applied on dev). The client `createMyProfile` was removed, so without this trigger a new sign-up creates an auth user with no `profiles` row.
- **#9 → #10 → #14 → #18 touch the same scoring objects.** Apply in order: #10 fixes #9's trigger, #14 redefines `recompute_tournament_scores()` to also capture rank history, and #18 redefines it again to add §2/§3/§4. All are confirmed applied on dev; on a fresh prod project the whole chain must be applied in this order (the final `recompute_tournament_scores()` = the #18 definition).
- **After #14, backfill rank history once:** `select capture_rank_history('<tournament-id>');` (the trigger only fires on future writes, so already-completed matchdays need one manual capture).
- **#18 (`…_scoring_positions_knockout_awards`) depends on #9/#10 (base scoring) and redefines `recompute_tournament_scores()` again** — apply it AFTER them (timestamp order handles this). It re-adds the `capture_rank_history()` call, so rank-history capture keeps working; once #9/#10/#14/#18 are all applied, capture produces real snapshots — backfill already-completed matchdays once with `select capture_rank_history('<tournament-id>');`.
- **After the scoring migrations (#9, #10, #18) are applied, re-run the dev seed** `npx tsx scripts/seed-dev/index.ts --commit` and confirm the overall leaderboard matches `tests/scripts/scoreEntries.test.ts` (the acceptance test). On the seeded mid-group-stage §2/§3/§4 all score 0, so the leaderboard is unchanged by #18 — to exercise §2/§3/§4 live, complete a group / enter KO participants / set `tournaments.golden_boot_player_id`.

## Related seed files (not migrations, but part of a fresh DB)

- `supabase/seed.sql` — the fixture skeleton (tournament, teams, groups, matches). Run once if a DB isn't already seeded.
- `supabase/dev-user.sql` — the seeded dev auto-login user (dev only; pre-stamped `welcomed_at`). Never run in production.

## Keeping this honest

When you apply a migration, flip its row to ✅ here **in the same session**, note how it was verified, and reconcile the per-item "Migration to apply" flags in `build-todo.md` + the "still to run" block in `CLAUDE.md`. This doc is the index; those are the scattered references it replaces.
