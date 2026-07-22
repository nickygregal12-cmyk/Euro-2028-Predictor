# Ops note — Migration applied-state + prod-setup checklist

The single source of truth for which migrations are **live in the dev database**, and the ordered set applied when standing up the **production** project.

**STATUS (2026-07-22): BOTH databases fully applied — all 20 migrations live on dev AND on prod; nothing pending.** Dev: confirmed over prior sessions (#20 `…_write_integrity` functionally verified — see "Write-integrity verification"). **Prod (project ref `vkfnsqdyhvtwyqkisxhk`): stood up 2026-07-22** per `docs/ops-prod-cutover.md` — all 20 applied in strict timestamp order (single concatenated paste), verified by the canonical query (28 rows direct-true + the 2 trigger rows confirmed via a `pg_trigger` diagnostic — see "Prod applied-state tracking") plus a functional smoke test through the live app. The production-project split (Phase 2 exit gate) is **done**.

**How this was built:** by reading the migration files on disk, every application confirmation in `CLAUDE.md`/`build-todo.md`/`roadmap.md`, a **first-hand chat verification pass (2026-07-20)** for `20260720150000`–`20260720210000` (see "Verification pass"), the **scoring-completion verification** for `20260721120000`, and finally a **full applied-state check (2026-07-21)** that reconciled the remaining rows against the live dev DB — a read-only REST probe (tables/columns) plus a dashboard SQL query for the trigger/function/constraint bits the anon key can't see (see "Full applied-state verification"). Every row is now ✅.

## Rules (for the production-project setup)

Dev is fully applied; these rules govern applying the set to a **fresh prod project**:

- **Apply in strict timestamp order.** Migrations are append-only and several *redefine* objects created by earlier ones (e.g. `20260720140000` fixes a trigger from `20260720130000`; `20260720180000` and `20260721120000` each redefine `recompute_tournament_scores()`). Applying out of order will produce a wrong final state.
- Run each file's full contents in the dashboard SQL editor, then confirm with the "Full applied-state verification" query below.
- The app fails soft before each migration (features error or read as empty), so a partially-migrated project keeps running — which is exactly why the dev applied-state drifted out of sync with this doc in the first place. Verify against the live DB, don't trust the flags alone.

## Standing cadence — now that TWO databases are live (added 2026-07-22, post-audit)

With prod stood up, every future migration follows this loop (also recorded as process rule 9 in `roadmap.md`):

1. **Apply to dev first**, in the SQL editor, and verify functionally (the migration's own verification query — real output, not "Success").
2. **Extend the canonical query below** in the same session if the migration adds new objects (a table/column/function/trigger that stands in for it), so the query stays a complete apply-check.
3. **Apply to prod** once dev is verified. Dev and prod must never diverge by more than the migration currently in flight.
4. **Re-run the canonical query on BOTH databases** after each apply and paste real rows back — not only at cutover events. Both tables in this doc get their new row flipped to ✅ in the same confirmation turn.

Rationale: applied-state has drifted from the docs once already (dev, pre-2026-07-21). The fail-soft app masks a missing migration; only the query run catches it. Two DBs doubles the drift surface — the cadence is the guard.

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
| 19 | `20260721130000_match_centre.sql` | Match Centre reads: `get_league_match_picks()` (league-scoped per-match picks, post-lock + co-membership **+ tournament-scope gate**) + `get_match_prediction_distribution()` (overall anonymous distribution, post-lock) + `_stage_ord()` helper | ✅ Confirmed (gate verified — see below) |
| 20 | `20260722120000_write_integrity.sql` | **Part A:** `version` column + `enforce_write_version()` BEFORE UPDATE trigger on `match_predictions`/`predicted_progression`/`bonus_predictions` (optimistic concurrency; distinct SQLSTATE `PT409`). **Part B:** redefines `submit_entry()` with SAFE structural bracket checks (no `r16` rows, exact 8-row shape, progression teams tournament-scoped). | ✅ Confirmed (functional — see below) |

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

## #19 pre-apply amendment — `20260721130000_match_centre.sql` (2026-07-21)

The file was **amended before its first apply** (append-only starts at apply, not authorship — so the fix lands in the file itself, not a corrective migration). An external audit found a **tournament-scoping gap** in `get_league_match_picks()`: it confirmed league co-membership but never checked that the league and the requested match belong to the same tournament, so a member could pass a match from a *different* tournament and resolve this league's picks in a context they shouldn't reach. Fixed with an explicit `leagues.tournament_id = matches.tournament_id` gate that fails closed with the same `insufficient_privilege` errcode as the co-membership rejection.

`get_match_prediction_distribution()` was **checked and intentionally left unchanged** — it takes no league argument and performs no co-membership check; it returns anonymous aggregates scoped to the match's own tournament, so the described cross-tournament leak cannot occur there (no phantom fix added).

**Apply #19 now** to the dev DB (SQL editor, full file contents). Verification queries for Nicky to run after applying — paste back the **real rows/errors**, not "Success":

```sql
-- Setup: pick a league you belong to and a match in that league's tournament,
-- plus a match from a DIFFERENT tournament.
-- (a) Cross-tournament call MUST be rejected by the new gate:
select get_league_match_picks('<your-league-id>', '<match-id-from-OTHER-tournament>');
--   expect: ERROR  'Not a member of this league'  (SQLSTATE 42501 / insufficient_privilege)

-- (b) Same-tournament call still works (returns the normal jsonb payload):
select get_league_match_picks('<your-league-id>', '<match-id-in-SAME-tournament>');
--   expect: jsonb with kind/locked/total_members/predicted_count/picks — no error
```

**Applied + verified — 2026-07-21 (first-hand, dev DB).** Ran a self-contained harness (`pg_temp.test_match_centre()`) that impersonates a real league member (`set_config` on `request.jwt.claims`) and points a cross-tournament call at a throwaway second tournament (created + rolled back in-transaction). Results:

- **(a) cross-tournament** — rejected with **`42501` / "Not a member of this league"** (the new tournament-scope gate firing, not the co-membership one, since the caller *is* a member — the only difference is the match's tournament).
- **(b) same-tournament** — normal payload returned (`kind=group locked=false total_members=1`), so the gate doesn't break the intended path.

Real error + real row, not "Success". #19 is live; `get_match_prediction_distribution()` was intentionally left un-gated (no league arg — nothing to scope).

## Write-integrity verification — `20260722120000` (2026-07-22, first-hand, dev DB)

Applied + functionally verified with two self-contained `pg_temp` harnesses (each in a rolled-back transaction). Real result rows, not "Success":

- **Part A / (a) stale version** — an UPDATE carrying `version = stored − 1` was rejected with **`prediction version conflict (expected -1, stored 0)` [SQLSTATE `PT409`]** — the distinct, non-retryable conflict code (told apart from the `check_violation` lock/joker/rate-limit rejections).
- **Part A / (b) correct version** — an UPDATE with the current version succeeded and the trigger incremented it server-side (**0 → 1**).
- **Part A / (e) triggers compose** — with the tournament forced past lock and the CORRECT version, a score change was rejected by the **lock** trigger (`Predictions are locked — the tournament has started`), not the version trigger — proving the lock fires first (by name order) and is never masked.
- **Part B / (d) valid submit** — a complete seed entry (36 group + the 8-row winner-only bracket) submitted successfully (returned a `submitted_at`).
- **Part B / (c) corrupt submit** — the same entry with an orphan `r16` progression row was rejected with the specific **`Bracket has invalid round-of-16 rows — re-pick your winners`**.

`version` column + `enforce_version_match_predictions` trigger confirmed present. #20 is live on dev.

## Prod applied-state tracking

The cutover to a **separate production project** is driven by `docs/ops-prod-cutover.md`. **Executed 2026-07-22 — prod is fully applied.** All 20 migrations were applied in strict timestamp order (single concatenated paste in the SQL editor), then verified.

**Prod project ref:** `vkfnsqdyhvtwyqkisxhk` (`https://vkfnsqdyhvtwyqkisxhk.supabase.co`).

**Verification method (2026-07-22):** the canonical query below returned **30 rows, 28 direct-true**. The two initially-`false` rows (#4 joker trigger, #16 display-name trigger) were **query bugs, not missing migrations** — a `pg_trigger` diagnostic proved both exist and are enabled under their real names (`match_predictions → enforce_joker_rules_trg` (O); `profiles → enforce_display_name` (O); the same diagnostic also showed `enforce_lock_scores`, `enforce_version_match_predictions`, `rate_limit_prediction_save` on `match_predictions`, consistent with a full apply). The query below has been **corrected** to those real `tgname`s and is now truthful against both databases (proven against prod; a dev re-run is optional). A functional smoke test through the live app (sign-up → log out → log back in → prediction save) passed on top of the object checks.

| # | Migration | Prod status |
|---|-----------|-------------|
| 1 | `20260719120000_init_v0_1.sql` | ✅ Confirmed |
| 2 | `20260719130000_add_match_prediction_joker.sql` | ✅ Confirmed |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | ✅ Confirmed |
| 4 | `20260719150000_enforce_joker_rules.sql` | ✅ Confirmed (via trigger diagnostic — `enforce_joker_rules_trg` O) |
| 5 | `20260719160000_add_bonus_and_submit.sql` | ✅ Confirmed |
| 6 | `20260719170000_lock_and_leaderboard.sql` | ✅ Confirmed |
| 7 | `20260719180000_add_leagues.sql` | ✅ Confirmed |
| 8 | `20260720120000_league_fk_semantics.sql` | ✅ Confirmed |
| 9 | `20260720130000_add_scoring.sql` | ✅ Confirmed |
| 10 | `20260720140000_fix_recompute_trigger.sql` | ✅ Confirmed |
| 11 | `20260720150000_add_last_seen.sql` | ✅ Confirmed |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | ✅ Confirmed |
| 13 | `20260720170000_reveal_after_lock.sql` | ✅ Confirmed |
| 14 | `20260720180000_add_rank_history.sql` | ✅ Confirmed |
| 15 | `20260720190000_profile_on_signup.sql` | ✅ Confirmed |
| 16 | `20260720200000_display_name_moderation.sql` | ✅ Confirmed (via trigger diagnostic — `enforce_display_name` O) |
| 17 | `20260720210000_rate_limits.sql` | ✅ Confirmed |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | ✅ Confirmed |
| 19 | `20260721130000_match_centre.sql` (incl. tournament-scope fix) | ✅ Confirmed |
| 20 | `20260722120000_write_integrity.sql` | ✅ Confirmed |

Legend: ✅ Confirmed applied (verified against the live **prod** DB) · ⏳ Pending.

> **On a future stand-up:** the runbook's "apply ALL migrations in strict timestamp order" step covers every file including `20260722120000_write_integrity.sql` — keep this doc + `ops-prod-cutover.md` as the template.

### Applied-state verification query

Run this against the target project's SQL editor after applying all migrations (runbook step 4). It returns one row per checked object with a `present` boolean — every row should be `true`. Each check stands in for the migration that creates it (single atomic `begin;…commit;`, so a present object implies its whole migration committed). **The two trigger `tgname`s were corrected 2026-07-22 after the prod run (`enforce_joker_rules_trg`, `enforce_display_name`); the query is now truthful against both dev and prod.**

```sql
select * from (values
  ('#1  entries table',                to_regclass('public.entries') is not null),
  ('#1  matches table',                to_regclass('public.matches') is not null),
  ('#2  match_predictions.joker',      exists (select 1 from information_schema.columns where table_name='match_predictions' and column_name='joker')),
  ('#3  predicted_tie_resolutions',    to_regclass('public.predicted_tie_resolutions') is not null),
  ('#4  enforce_joker_rules trigger',  exists (select 1 from pg_trigger where tgname='enforce_joker_rules_trg')),
  ('#5  submit_entry() fn',            to_regprocedure('public.submit_entry(uuid)') is not null),
  ('#5  bonus_predictions table',      to_regclass('public.bonus_predictions') is not null),
  ('#6  tournaments.lock_at',          exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='lock_at')),
  ('#6  get_leaderboard() fn',         exists (select 1 from pg_proc where proname='get_leaderboard')),
  ('#7  leagues table',                to_regclass('public.leagues') is not null),
  ('#7  league_members table',         to_regclass('public.league_members') is not null),
  ('#7  create_league() fn',           exists (select 1 from pg_proc where proname='create_league')),
  ('#8  owner_id FK = RESTRICT',       exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relname='leagues' and c.contype='f' and c.confdeltype='r')),
  ('#9  score_events table',           to_regclass('public.score_events') is not null),
  ('#9  entry_totals view',            to_regclass('public.entry_totals') is not null),
  ('#9  recompute_tournament_scores',  exists (select 1 from pg_proc where proname='recompute_tournament_scores')),
  ('#11 profiles.last_seen_at',        exists (select 1 from information_schema.columns where table_name='profiles' and column_name='last_seen_at')),
  ('#12 profiles.welcomed_at',         exists (select 1 from information_schema.columns where table_name='profiles' and column_name='welcomed_at')),
  ('#13 get_rival_entry() fn',         exists (select 1 from pg_proc where proname='get_rival_entry')),
  ('#14 rank_history table',           to_regclass('public.rank_history') is not null),
  ('#14 capture_rank_history() fn',    exists (select 1 from pg_proc where proname='capture_rank_history')),
  ('#15 on_auth_user_created trigger', exists (select 1 from pg_trigger where tgname='on_auth_user_created')),
  ('#16 enforce_display_name trigger', exists (select 1 from pg_trigger where tgname='enforce_display_name')),
  ('#17 rate_limit_events table',      to_regclass('public.rate_limit_events') is not null),
  ('#18 tournaments.golden_boot',      exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='golden_boot_player_id')),
  ('#19 get_league_match_picks fn',    exists (select 1 from pg_proc where proname='get_league_match_picks')),
  ('#19 get_match_pred_distribution',  exists (select 1 from pg_proc where proname='get_match_prediction_distribution')),
  ('#20 match_predictions.version',    exists (select 1 from information_schema.columns where table_name='match_predictions' and column_name='version')),
  ('#20 enforce_write_version fn',     exists (select 1 from pg_proc where proname='enforce_write_version')),
  ('#20 version trigger (progression)',exists (select 1 from pg_trigger where tgname='enforce_version_predicted_progression'))
) as checks(object, present)
order by object;
```

Paste the **real result rows** back (not "Success") — the next session flips the prod table above to ✅ per migration in the same turn.

## Order-sensitive callouts

- **#15 (`…_profile_on_signup`) must be applied before any real sign-up** (confirmed applied on dev). The client `createMyProfile` was removed, so without this trigger a new sign-up creates an auth user with no `profiles` row.
- **#9 → #10 → #14 → #18 touch the same scoring objects.** Apply in order: #10 fixes #9's trigger, #14 redefines `recompute_tournament_scores()` to also capture rank history, and #18 redefines it again to add §2/§3/§4. All are confirmed applied on dev; on a fresh prod project the whole chain must be applied in this order (the final `recompute_tournament_scores()` = the #18 definition).
- **After #14, backfill rank history once:** `select capture_rank_history('<tournament-id>');` (the trigger only fires on future writes, so already-completed matchdays need one manual capture).
- **#18 (`…_scoring_positions_knockout_awards`) depends on #9/#10 (base scoring) and redefines `recompute_tournament_scores()` again** — apply it AFTER them (timestamp order handles this). It re-adds the `capture_rank_history()` call, so rank-history capture keeps working; once #9/#10/#14/#18 are all applied, capture produces real snapshots — backfill already-completed matchdays once with `select capture_rank_history('<tournament-id>');`.
- **After the scoring migrations (#9, #10, #18) are applied, re-run the dev seed** `npx tsx scripts/seed-dev/index.ts --commit` and confirm the overall leaderboard matches `tests/scripts/scoreEntries.test.ts` (the acceptance test). On the seeded mid-group-stage §2/§3/§4 all score 0, so the leaderboard is unchanged by #18 — to exercise §2/§3/§4 live, complete a group / enter KO participants / set `tournaments.golden_boot_player_id`.

## Related seed files (not migrations, but part of a fresh DB)

- `supabase/seed.sql` — the fixture skeleton (tournament, teams, groups, matches). The **single source of truth** for the fixture list; run once if a DB isn't already seeded (dev **and** prod).
- `supabase/prod-baseline.sql` — the **production** baseline config: verifies the seed.sql skeleton is present and sets `tournaments.lock_at` (derived from `starts_on`). Prod-safe (no users/results/hostile data), idempotent. Run **after** seed.sql on a fresh prod project (see `docs/ops-prod-cutover.md` step 5).
- `supabase/dev-user.sql` — the seeded dev auto-login user (dev only; pre-stamped `welcomed_at`). Never run in production.

## Keeping this honest

When you apply a migration, flip its row to ✅ here **in the same session**, note how it was verified, and reconcile the per-item "Migration to apply" flags in `build-todo.md` + the "still to run" block in `CLAUDE.md`. This doc is the index; those are the scattered references it replaces.
