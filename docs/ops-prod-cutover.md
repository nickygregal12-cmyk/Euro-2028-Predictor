# Ops runbook — Production Supabase cutover

This document records the manual creation of the **separate production Supabase project** and the original live-site cutover. The cutover was completed on 22 July 2026, so this is now primarily a historical execution record rather than a current deployment script. Nicky executes hosted operations by hand — coding agents have no database access.

**Current environment position:** the live site uses the production Supabase project recorded below. Development remains isolated on its separate project. Any future release or recovery action must preserve that boundary.

**Ground rules**
- Do the initial cutover steps **in order** when reading the historical procedure. Several later steps depended on earlier ones.
- Where a step asks for confirmation output, retain the real rows/errors rather than recording only “Success”.
- **Never point a production domain, production deploy or production environment variable at the development Supabase project.** Development data, Auth settings, test CAPTCHA configuration and seeded accounts are not a production fallback.
- After production cutover, rollback means reverting the application deployment or restoring last-known-good **production** configuration. It does not mean changing database environments.
- Hosted database migration, restore or data-remediation work requires its own reviewed plan and explicit approval.

---

## ✅ EXECUTED — 2026-07-22 (all steps complete)

Nicky ran the original cutover end to end. **Prod project ref: `vkfnsqdyhvtwyqkisxhk`** (`https://vkfnsqdyhvtwyqkisxhk.supabase.co`). The checklist below is retained as the execution record for that stand-up. It must not be treated as a current migration inventory or reused without reconciling it against the repository’s latest migrations and operations documents.

- **Step 1 — Resend key rotated.** Done (also closes the 21-Jul screenshot-exposure follow-up); the rotated key is what SMTP uses in step 6.
- **Step 2 — prod project created**, ref `vkfnsqdyhvtwyqkisxhk`, same region as dev.
- **Step 3 — all 20 migrations then present were applied** in strict timestamp order. Includes `20260722120000_write_integrity.sql`; later repository migrations are not covered by this historical statement.
- **Step 4 — verified.** Canonical query returned 30 rows, 28 direct-true; the two `false` rows were **query bugs** (wrong `tgname`s), not missing migrations — a `pg_trigger` diagnostic confirmed `enforce_joker_rules_trg` (O) on `match_predictions` and `enforce_display_name` (O) on `profiles`. Query corrected + prod table flipped to all-✅ in `docs/ops-pending-migrations.md`.
- **Step 5 — baseline data loaded.** `seed.sql` + `prod-baseline.sql`; verified: tournaments 1 / groups 6 / teams 24 / matches 51 / `lock_at` = `2028-06-09 00:00:00+00` (starts_on-derived placeholder — the real MD1 kick-off instant lands with the 2027 schedule announcement, already the standing “Per-matchday kickoff times” roadmap item; **not** a new task).
- **Step 6 — Auth configured.** Site URL `euro28predictor.com`, both-domain redirect wildcards, SMTP via the rotated Resend key (**live-verified** by a real password-recovery send, after fixing an initial config error), Turnstile CAPTCHA with the real secret, email confirmation OFF.
- **Steps 7 & 8 — reordered in practice (env swap before admin grant).** The live site was the sign-up surface, so the order run was: **Netlify env swap → redeploy → sign-up/log-out/log-in/prediction-save smoke test (PASSED) → admin bootstrap**. Netlify env used the prod URL + the **new-style `sb_publishable_*` key** (confirmed working with supabase-js in production); clear-cache redeploy. Nicky’s admin account created on prod and the bootstrap grant run.
- **Step 9 — dev Turnstile secret reverted** to Cloudflare’s test secret; **local dev auto-login confirmed working again** (the `captcha … request disallowed` error is gone). Closes the local-dev-auth blocker.
- **Step 10 — rollback** not needed (smoke test passed).

---

## Historical initial-cutover checklist

### Pre-flight

- [ ] Confirm the tournament-scoping fix in `20260721130000_match_centre.sql` is **merged into the file on the branch you will apply from**. `get_league_match_picks()` must contain the `leagues.tournament_id = matches.tournament_id` gate (see `docs/ops-pending-migrations.md` § “#19 pre-apply amendment”). Do **not** apply this migration anywhere without that fix.
- [ ] Confirm `supabase/prod-baseline.sql` and `supabase/seed.sql` are on the same branch.
- [ ] Reconcile this historical list against the current repository migration inventory before any new hosted stand-up. Do not assume the list below is current.

### 1. Rotate the Resend API key

- [ ] Rotate the Resend API key (if not already rotated for the prod split). Generate a new key in the Resend dashboard; keep the old one until step 6 is verified, then delete it.
- [ ] Paste this rotated key only into the **production** Supabase SMTP settings. Do **not** put it in the repository or in development configuration.

### 2. Create the production Supabase project

- [ ] Create a new Supabase project in the **same region as development**.
- [ ] Email confirmation stays **OFF** unless the current product decision has been reviewed and changed.
- [ ] Record the new project reference and Project URL through the approved private operations record; do not commit secret keys.

> The dev-only shims (`autoLoginPolicy.ts`, `seed-dev/seedPolicy.ts`) are pinned to the development reference and hard-fail against any other reference. Production must never be used for development automation, and development must never be used as production recovery.

### 3. Apply all migrations in strict timestamp order

The following was the migration list used for the 22 July 2026 stand-up. It is retained only as historical evidence. **Use the current repository migration inventory for any future rollout.**

- [ ] `20260719120000_init_v0_1.sql`
- [ ] `20260719130000_add_match_prediction_joker.sql`
- [ ] `20260719140000_add_predicted_tie_resolutions.sql`
- [ ] `20260719150000_enforce_joker_rules.sql`
- [ ] `20260719160000_add_bonus_and_submit.sql`
- [ ] `20260719170000_lock_and_leaderboard.sql`
- [ ] `20260719180000_add_leagues.sql`
- [ ] `20260720120000_league_fk_semantics.sql`
- [ ] `20260720130000_add_scoring.sql`
- [ ] `20260720140000_fix_recompute_trigger.sql`
- [ ] `20260720150000_add_last_seen.sql`
- [ ] `20260720160000_add_profile_welcomed_at.sql`
- [ ] `20260720170000_reveal_after_lock.sql`
- [ ] `20260720180000_add_rank_history.sql`
- [ ] `20260720190000_profile_on_signup.sql`
- [ ] `20260720200000_display_name_moderation.sql`
- [ ] `20260720210000_rate_limits.sql`
- [ ] `20260721120000_scoring_positions_knockout_awards.sql`
- [ ] `20260721130000_match_centre.sql`
- [ ] `20260722120000_write_integrity.sql`

Order-sensitive callouts from the executed cutover:
- `#9 → #10 → #14 → #18` all touched scoring objects and had to land in that order.
- Rank-history backfill was not needed for the fresh production database because no matchdays were completed.

### 4. Run and record the applied-state verification query

- [ ] Run the current applied-state verification query from `docs/ops-pending-migrations.md` against the intended production database.
- [ ] Copy the real output rows rather than recording only “Success”.
- [ ] Reconcile the output with version-controlled migration history before proceeding.

### 5. Load the baseline data

The original production-safety inventory of `supabase/seed.sql` was:

```text
seed.sql — TABLES TOUCHED (5) and ROWS INSERTED (106 total):
  tournaments   1 row   'UEFA Euro 2028', 2028, starts_on 2028-06-09, ends_on 2028-07-09
                         (lock_at left NULL -> set by prod-baseline.sql)
  groups        6 rows  A–F
  teams        24 rows  'Team A1'…'Team F4'
  group_teams  24 rows  team -> group slot
  matches      51 rows  36 group + 15 knockout, no results supplied

CONTAINS NO: users / auth.users / profiles, entries, match_predictions,
             predicted_tie_resolutions, bonus_predictions, leagues,
             league_members, score_events, rank_history, rate_limit_events,
             or match results.
```

- [ ] Re-audit the current `supabase/seed.sql` before any future production use; the historical inventory above is not a permanent safety guarantee.
- [ ] Apply `supabase/seed.sql` and then `supabase/prod-baseline.sql` only under an approved stand-up plan.
- [ ] Verify the expected tournament, match count and lock time.
- [ ] Replace the placeholder midnight lock with the official first-match kickoff instant before the tournament.

### 6. Configure Auth

In the production project’s Authentication settings:

- [ ] **Site URL:** `https://euro28predictor.com`
- [ ] **Redirect URLs:** production domains only, including the password-update path.
- [ ] **SMTP:** configure via the approved production provider and secret store.
- [ ] **CAPTCHA:** enable using the real production secret; never reuse the development test secret.
- [ ] **Email confirmation:** follow the current recorded product decision.
- [ ] Send a real password-recovery email to confirm SMTP works end to end.

### 7. Admin bootstrap

- [ ] Grant administrator access only through the current reviewed admin-bootstrap procedure and verified production schema.
- [ ] Keep the administrator set minimal.
- [ ] Record the real verification output. Do not assume the historical bootstrap remains schema-compatible.

### 8. Production application configuration and smoke test

- [ ] Set the production site’s Supabase URL and publishable key to the **production** project only.
- [ ] Trigger a production deploy because Vite embeds `VITE_*` values at build time.
- [ ] Smoke-test on the live domain:
  - [ ] Sign up or use an approved test account.
  - [ ] Log in.
  - [ ] Save and reload a prediction.
- [ ] If the smoke test fails, follow the application-only recovery procedure in section 10. Do not change the live site to development Supabase.

### 9. Development CAPTCHA configuration

- [ ] Development may use Cloudflare’s always-passes test secret only in the development Supabase project.
- [ ] Confirm local development authentication works.
- [ ] Do not copy development Auth or CAPTCHA settings into production.

## 10. Safe rollback and recovery boundary

> **Absolute prohibition:** never roll back by changing a production domain or production deployment to the development Supabase URL or key.

Choose the response that matches the failure:

### Application deployment failure

- [ ] Keep all production Supabase environment variables unchanged.
- [ ] In Netlify, restore the last known-good **production application deploy** or redeploy the last known-good application commit.
- [ ] Confirm the restored deploy still references the production project.
- [ ] Smoke-test sign-in, an authenticated read and one approved write against production.

### Incorrect production environment-variable change

- [ ] Restore only the last known-good **production** Supabase URL and production publishable key from the protected Netlify configuration or approved private operations record.
- [ ] Never substitute development values, even temporarily.
- [ ] Redeploy and repeat the production smoke test.

### Database migration, policy or data failure

- [ ] Stop the rollout and preserve the production database for investigation.
- [ ] Do not run a remote reset, destructive down migration, unreviewed SQL repair or environment swap.
- [ ] Roll back the application deploy only when the previous application is compatible with the current production schema.
- [ ] Otherwise disable or isolate the affected application path using an approved maintenance/containment plan.
- [ ] Review migration history, backups/exports, logs and the exact failing preflight before deciding on forward repair or restore.
- [ ] Database restore is not considered available until a backup has been verified and a restore procedure has been reviewed or rehearsed.

### Incident record

- [ ] Record the failed deploy/commit, production deploy restored, environment variables verified, smoke-test result and any database action taken.
- [ ] Record explicitly that production remained attached to production Supabase throughout.

---

## Related documents

- `docs/ops-pending-migrations.md` — migration inventory, verification query and hosted applied-state tracking.
- `docs/ops-admin-bootstrap.md` — administrator setup; currently linked to the `OPS-005` schema-drift question and must be verified before reuse.
- `docs/auth-plan.md` — development authentication behaviour and environment isolation.
- `docs/quality/current-status.md` — current assurance boundaries and remaining operational findings.
- `supabase/prod-baseline.sql` / `supabase/seed.sql` — baseline data sources; re-audit before future production use.
