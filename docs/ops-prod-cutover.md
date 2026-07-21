# Ops runbook — Production Supabase cutover

The ordered, manual checklist for standing up a **separate production Supabase project** and pointing the live site at it (roadmap Phase 2 exit gate). Nicky executes every step by hand — Claude Code has no database access.

**Why this exists:** the live site currently runs against the **dev** Supabase project (ref `iouzoutneyjpugbbtdem`). Splitting prod out lets dev revert its Turnstile secret to Cloudflare's TEST secret so local dev auto-login works again (step 9). Until then, dev carries the REAL Turnstile secret, which breaks the headless dev auto-login shim (`captcha protection: request disallowed (invalid-input-response)`).

**Ground rules**
- Do the steps **in order**. Several later steps depend on earlier ones (schema before data; data before admin grant; everything before the Netlify swap).
- Where a step says **paste the confirmation into the next Claude Code session**, do that — the docs-sync-on-confirmation rule means Claude updates the tracking docs in the same turn it receives real output (not "Success", the actual rows/errors).
- Nothing here touches the dev project except the final step 9 (revert its Turnstile secret).

---

## Pre-flight

- [ ] Confirm the tournament-scoping fix in `20260721130000_match_centre.sql` is **merged into the file on the branch you will apply from**. `get_league_match_picks()` must contain the `leagues.tournament_id = matches.tournament_id` gate (see `docs/ops-pending-migrations.md` § "#19 pre-apply amendment"). Do **not** apply this migration anywhere without that fix.
- [ ] Confirm `supabase/prod-baseline.sql` and `supabase/seed.sql` are on the same branch.

## 1. Rotate the Resend API key

- [ ] Rotate the Resend API key (if not already rotated for the prod split). Generate a new key in the Resend dashboard; keep the old one until step 6 is verified, then delete it.
- [ ] You will paste this rotated key into the **prod** Supabase SMTP settings in step 6. Do **not** put it in the repo or in any dev config.

## 2. Create the prod Supabase project

- [ ] Create a new Supabase project in the **same region as dev** (dev region: check the dev project's settings and match it — latency + Auth cookie parity).
- [ ] Email confirmation stays **OFF** (configured in step 6) — recorded product decision (CLAUDE.md status).
- [ ] **Record the new project ref here when created:** `PROD_PROJECT_REF = ____________________`
- [ ] Note the prod Project URL (`https://<ref>.supabase.co`) and the anon/publishable key — needed for step 8.

> The dev-only shims (`autoLoginPolicy.ts`, `seed-dev/seedPolicy.ts`) are pinned to the **dev** ref and hard-fail against any other ref, so they can never touch this prod project even if misconfigured. Nothing else in the app special-cases a ref.

## 3. Apply all migrations, in strict timestamp order

Apply each file's **full contents** in the prod project's SQL editor, one at a time, in this exact order (append-only; several redefine earlier objects — order matters, per `docs/ops-pending-migrations.md`):

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
- [ ] `20260721130000_match_centre.sql`  ← must include the tournament-scoping fix (pre-flight)

Order-sensitive callouts (from `docs/ops-pending-migrations.md`):
- `#9 → #10 → #14 → #18` all touch the scoring objects and must land in this order (the final `recompute_tournament_scores()` = the #18 definition).
- Rank-history backfill (`select capture_rank_history('<tournament-id>');`) is **not needed at cutover** — there are no completed matchdays on a fresh prod DB yet; the trigger captures live from the first real result.

## 4. Run + record the applied-state verification query

- [ ] Run the **applied-state verification query** from `docs/ops-pending-migrations.md` § "Prod applied-state tracking" against the prod DB.
- [ ] Copy the **real output rows** (not "Success").
- [ ] **Paste that output into the next Claude Code session.** That session updates the **Prod applied-state tracking** section of `docs/ops-pending-migrations.md` (flipping the prod column to ✅ per migration) in the **same turn** — docs-sync-on-confirmation.

## 5. Load the baseline data

Run these two files in the prod SQL editor, **in this order** (prod-baseline reuses seed.sql — the fixture list has one home):

- [ ] `supabase/seed.sql` — the fixture / bracket skeleton: tournament, groups, 24 TBD teams (`Team A1`…`Team F4`), all 51 matches with dates/venues.
- [ ] `supabase/prod-baseline.sql` — sets `tournaments.lock_at` (derived from `starts_on` = MD1 date) and verifies the skeleton is present. Idempotent.
- [ ] Run the verification query at the bottom of `prod-baseline.sql`: expect **one** tournament row, `match_count = 51`, `lock_at = 2028-06-09 00:00+00`.
- [ ] **NOTE:** `lock_at` resolves to 00:00 UTC on the MD1 date because per-match kick-off **times** are still unknown. It is a safe ~2-years-out lock, but **must be tightened to the real MD1 kick-off instant** before the tournament approaches (and real teams seeded after the Dec 2026 draw). Not a cutover blocker.

## 6. Configure Auth

In the prod project's Authentication settings:

- [ ] **Site URL:** `https://euro28predictor.com`
- [ ] **Redirect URLs:** both domains, with wildcards, including the password-update path:
  - `https://euro28predictor.com/**`
  - `https://euro28predictor.netlify.app/**`
  - (ensure `/auth/update-password` on both is covered by the wildcards above)
- [ ] **SMTP:** configure via Resend using the **rotated** key from step 1 (sender on the verified `euro28predictor.com` domain).
- [ ] **CAPTCHA (Turnstile):** enable with the **REAL** Cloudflare secret (the same production secret dev currently holds — Supabase runs siteverify; the secret never enters the repo). The client site key is already domain-locked to euro28predictor.com and is set in Netlify (unchanged, step 8).
- [ ] **Email confirmation:** **OFF** (recorded product decision — friends/casual scale; the `handle_new_user()` trigger makes turning it on safe later).
- [ ] Send a **real** password-recovery email from the dashboard to confirm SMTP works end-to-end.

## 7. Admin bootstrap

- [ ] Grant admin per `docs/ops-admin-bootstrap.md` — run the `update profiles set role = 'admin' …` grant for Nicky's account **in the prod project** (after Nicky has signed up on the live site in step 8, or immediately if pre-creating the account). Verify with the check query in that doc.
- [ ] Keep the admin set minimal (Nicky + at most one trusted backup).

## 8. Netlify env swap + smoke test

- [ ] In Netlify site env vars, swap to prod:
  - `VITE_SUPABASE_URL` → prod Project URL (`https://<PROD_PROJECT_REF>.supabase.co`)
  - `VITE_SUPABASE_ANON_KEY` → prod anon/publishable key
  - `VITE_TURNSTILE_SITE_KEY` → **unchanged** (public site key, domain-locked)
- [ ] Trigger a redeploy (env changes need a rebuild — Vite inlines `VITE_*` at build time).
- [ ] Smoke-test on the **live domain** (`euro28predictor.com`):
  - [ ] Sign up a fresh account (Turnstile solves; profile row is created by the trigger).
  - [ ] Log in.
  - [ ] Save a group prediction (autosave persists).
- [ ] If the smoke test fails, use the rollback note (step 10) before debugging further.

## 9. Revert the DEV project's Turnstile secret (fixes local dev)

- [ ] In the **dev** Supabase project (ref `iouzoutneyjpugbbtdem`) → Authentication → CAPTCHA, replace the REAL Turnstile secret with **Cloudflare's always-passes TEST secret** (`1x0000000000000000000000000000000AA`).
- [ ] Confirm local dev auto-login works again: run `npm run dev`, load the app, verify it silently signs in as the dev user (no `invalid-input-response` error).
- [ ] **Paste that confirmation into the next Claude Code session**, which records "local dev auto-login restored" in the CLAUDE.md status in the same turn.

## 10. Rollback

- [ ] If anything goes wrong after step 8, revert by swapping the Netlify env vars (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) **back to the dev project values** and redeploying. That points the live site back at dev — the pre-cutover state — with no data migration needed. (Dev's Turnstile secret would then need re-reverting to the real secret if step 9 was already done and you want the live site's CAPTCHA to validate against dev again.)

---

## Related docs

- `docs/ops-pending-migrations.md` — the migration inventory, order-sensitive callouts, the verification query, and the **Prod applied-state tracking** section this runbook feeds.
- `docs/ops-admin-bootstrap.md` — the admin grant (step 7).
- `docs/auth-plan.md` — the dev auto-login shim and the dev-ref pinning that keeps it off prod.
- `supabase/prod-baseline.sql` / `supabase/seed.sql` — the baseline data (step 5).
