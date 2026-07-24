# Euro 2028 Predictor — Current Build TODO

**Status date:** 24 July 2026  
**Purpose:** Near-term execution checklist. `docs/quality/current-status.md` is authoritative for facts; `docs/roadmap.md` holds the wider product sequence.

## 0. Production compatibility incident — do first

- [x] Freeze ordinary production promotion in repository guidance and runbooks.
- [x] Confirm the original production application/Supabase mismatch and missing atomic bracket RPC.
- [x] Confirm Netlify automatically published PR #20 merge commit `a403b079` to production.
- [x] Verify read-only that production lacks both `replace_predicted_progression` and `delete_match_prediction`.
- [x] Verify production still grants old direct progression and match-prediction delete privileges.
- [x] Record the broadened two-RPC mismatch and current 4-profile/4-entry production snapshot.
- [x] Rehearse migrations 21–35 on hosted development using the normalized production entry.
- [x] Prove production migrations 1–20 structural effects and prepare exact history-only repair.
- [x] Commit fail-closed production preflight and post-rollout verification scripts.
- [ ] Obtain verified production backup/export or equivalent recovery evidence.
- [ ] Name the operator, recovery decision owner and change window.
- [ ] Rerun both production preflights immediately before change.
- [ ] Apply the prepared 1–20 history-only repair and require a dry run showing migrations 21–35 only.
- [ ] Obtain explicit approval and apply migrations 21–35 in strict timestamp order.
- [ ] Verify bracket save/reload, authenticated RPCs, function allowlists, submission settlement and score clearing.
- [ ] Record the exact compatible application/schema pair, operator and retained evidence.

Do **not** point production at development Supabase. Do not add unsafe direct-table fallbacks. Do not apply migration 33, 34 or 35 alone.

## 1. Netlify environment and deployment controls

- [ ] Scope production Supabase values to production deploys only.
- [ ] Ensure production-project previews and branch deploys cannot access production Supabase.
- [ ] Confirm the separate development Netlify site uses development Supabase.
- [ ] Protect or disable production-project previews until isolation is verified.
- [ ] Add an explicit app/schema compatibility decision before merging database-dependent client paths that auto-deploy from `main`.
- [ ] Recheck Turnstile domain/context behavior after configuration changes.

## 2. Development migration rehearsal — complete

- [x] Confirm disposable development competition data while preserving Auth-backed profiles/reference data.
- [x] Remove legacy bracket/result state.
- [x] Apply migrations 21–35 in timestamp order.
- [x] Clone the normalized production entry by stable match/team references.
- [x] Regenerate 24 group positions and resolve all eight R16 fixtures.
- [x] Replay the full 15-match predicted bracket and validate submission.
- [x] Rehearse result confirm/correct/clear and winner propagation.
- [x] Rehearse atomic bracket stale-snapshot rejection.
- [x] Verify exact function execution allowlists and advisor delta.
- [x] Verify version-safe score deletion, derived-position invalidation, idempotency and lock refusal.
- [x] Restore development to the clean expected mirror.
- [x] Run the migrations 21–35 post-rollout verifier successfully.
- [x] Rebuild the 35-migration chain and pass database lint, pgTAP and TypeScript/PostgreSQL parity.

## 3. Hosted security and Auth configuration

### Function privileges — repository/development complete

- [x] Revoke anonymous/browser execution from internal helpers.
- [x] Remove direct execution from trigger, signup and maintenance functions.
- [x] Restrict scoring, rank capture and result administration to service role.
- [x] Preserve the explicit authenticated application RPC allowlist.
- [x] Add the protected prediction-delete RPC to the exact allowlists.
- [x] Fix mutable helper search paths.
- [x] Close future public-function defaults to owner-only.
- [x] Verify signup trigger and signed-in RPC behavior.
- [ ] Apply migrations 21–35 to production through the controlled rollout.
- [ ] Verify the exact production ACL/advisor result after rollout.

### Separate Auth/configuration work

- [ ] Review and approve leaked-password protection.
- [ ] Enable it and verify signup/reset behavior.
- [ ] Keep intentional authenticated RPC advisor notices documented.

## 4. Production preflight and rollout

- [x] Prove the submitted production entry has 36 predictions, exact tie decisions and valid `4/2/1/1` progression.
- [x] Prove it reconstructs all 24 positions and one valid bracket tree on development.
- [x] Confirm production has no stored result lifecycle state.
- [x] Prove migrations 1–20 structural effects.
- [x] Confirm the production migration-history table is absent.
- [x] Prepare exact 1–20 migration-history repair.
- [x] Extend the pending chain and verifier through migration 35.
- [x] Prepare stop/rollback/remediation rules.
- [ ] Preserve a production backup/recovery artifact.
- [ ] Review final preflight and dry-run output.
- [ ] Apply only after explicit approval.
- [ ] Run database post-verification and advisors.
- [ ] Run the full authenticated application smoke checklist.

## 5. Original Predictor reliability

### Pending-write submission — repository complete, browser closure pending

- [x] **`REL-003`** — flush pending score and bracket debounces before manual submit.
- [x] Await score, tie, bracket and Golden Boot controller writes.
- [x] Include match deletion operations in the same settlement barrier.
- [x] Block submission on errors, conflicts or entry-context cancellation.
- [x] Test immediate submit after final score and bracket edits.
- [x] Test terminal save failure blocking.
- [ ] Browser-verify immediate final edits after production compatibility is restored.
- [ ] Add the journey to Playwright/equivalent and close `REL-003`.

### Persisted score clearing — client deployed, backend pending

- [x] **`DATA-005`** — persist deletion when a complete score is cleared.
- [x] Deny direct table deletion and use an owner/scope/lock/version-checked RPC in the migration chain.
- [x] Serialize delete/upsert on the same match key.
- [x] Protect unseen/newer rows with unknown/stale version conflicts.
- [x] Clear stale derived group positions after deletion.
- [x] Test loaded, unsaved-local and stale-device paths.
- [x] Add pgTAP coverage for privileges, ownership, scope, version, idempotency and lock.
- [x] Confirm the score-clear client is live in production commit `a403b079`.
- [x] Confirm the production backend RPC is absent, causing save failure rather than successful clearing.
- [ ] Apply migration 35 as part of the complete approved 21–35 chain.
- [ ] Browser-verify clear/reload, restore, stale conflict and post-lock refusal in production.
- [ ] Add the journey to Playwright/equivalent and close `DATA-005`.

### Remaining reliability work

- [ ] **`REL-002`** — prevent late best-effort reads from overwriting newer state.
- [ ] **`REL-006`** — make first entry creation idempotent under concurrent tabs.
- [ ] Complete wider tournament/reference immutability constraints.
- [ ] Map raw database/network failures to stable user-facing errors.

## 6. Real tournament progression

- [ ] Implement transactional real R16 population from confirmed group standings.
- [ ] Use canonical group-order and best-third rules.
- [ ] Add exact saved actual tie decisions for unresolved standings.
- [ ] Fail closed at the fourth/fifth best-third boundary.
- [ ] Populate all eight R16 fixtures together.
- [ ] Never overwrite participants beneath a confirmed downstream result.
- [ ] Add exhaustive pgTAP coverage for qualifying-third combinations and corrections.

## 7. Submission automation and reminders

- [ ] Implement automatic submission at lock for valid complete entries.
- [ ] Record manual versus automatic submission.
- [ ] Keep incomplete entries out of standings.
- [ ] Add 48-hour and 24-hour reminders after SMTP/Auth verification.
- [ ] Test exact lock-boundary behavior.
- [ ] Replace provisional `lock_at` with the official opening kickoff when confirmed.

## 8. Result administration

- [ ] Define the version-controlled admin authorization model.
- [ ] Do not rely on nonexistent `profiles.role` without a migration and tests.
- [ ] Add server-side/browser administration for confirm, correct and clear.
- [ ] Require reasons and expose revision history.
- [ ] Add browser tests for regulation, extra time, penalties and correction propagation.
- [ ] Keep result RPCs unavailable to ordinary browser roles.

## 9. Browser E2E and operations

- [ ] Add Playwright or equivalent.
- [ ] Cover auth/recovery, welcome, full entry, ties, bracket, submission settlement and score clearing.
- [ ] Cover conflict resolution, leagues and result administration.
- [ ] Run mobile, keyboard and accessibility journeys.
- [ ] Make critical E2E a required merge/release gate.
- [ ] Confirm branch protection and required checks.
- [ ] Pin/verify Netlify Node runtime.
- [ ] Add production error reporting, alert ownership and critical-journey monitoring.
- [ ] Create and rehearse backup/restore and application rollback procedures.

## 10. Core experience follow-ups

After integrity gates:

- [ ] Complete other-player profile states and richer H2H.
- [ ] Rank graph and bracket-health-vs-real.
- [ ] Expanded Match Centre states.
- [ ] Account/privacy/contact-admin surfaces.
- [ ] Post-lock prediction trends.
- [ ] Route focus/title/live-region behavior and skip link.
- [ ] Menu semantics, invite preview and unavailable/error states.
- [ ] Mobile physics and friction pass.

## 11. Bonus games — after core gates

- [ ] Build the optional competition framework and isolated scoring/league boundaries.
- [ ] Complete rules/design/build/test for KO Predictor.
- [ ] Complete rules/design/build/test for Last Man Standing.
- [ ] Complete rules/design/build/test for Predictor Cup.

The Sweepstake builder remains non-launch-blocking.

## 12. Official data and final readiness

- [ ] Reverify official Euro 2028 regulations and best-third allocation.
- [ ] Load official qualifiers and draw assignments safely.
- [ ] Replace provisional dates/times and lock instant.
- [ ] Verify venue/team source metadata.
- [ ] Run a full multi-game dress rehearsal through the final.
- [ ] Run final security, accessibility, performance and documentation sweeps.
- [ ] Remove provisional/internal labels from public UI.

## Completed foundations

- [x] React/TypeScript/Vite/Supabase/Netlify application spine.
- [x] Original Predictor group, tie, third-place and bracket UI.
- [x] Leagues, H2H, matches, profile and points views.
- [x] Scoring rule/config alignment.
- [x] Application CI and disposable database parity CI.
- [x] Canonical predicted group ordering.
- [x] RPC-only submission and derived positions.
- [x] Authoritative result lifecycle.
- [x] Predicted bracket replay and winner propagation.
- [x] Atomic bracket persistence.
- [x] Exact function allowlists and closed future defaults.
- [x] Pending-write submission barrier.
- [x] Version-safe persisted score clearing.
- [x] Hosted development rehearsal through migration 35.
- [x] Live hosted audit and documentation authority hierarchy.
- [x] Post-merge automatic production deploy reconciliation.
