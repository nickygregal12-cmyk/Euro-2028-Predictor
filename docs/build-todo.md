# Euro 2028 Predictor — Current Build TODO

**Status date:** 24 July 2026  
**Purpose:** Near-term execution checklist. `docs/quality/current-status.md` is authoritative for facts; `docs/roadmap.md` holds the wider sequence.

## 0. Production compatibility incident — do first

- [x] Freeze ordinary production promotion in repository guidance and runbooks.
- [x] Confirm the production application/Supabase mismatch and exact missing RPC.
- [x] Rehearse migrations 21–34 on hosted development using the normalized production entry.
- [x] Prove production migrations 1–20 structural effects and prepare the exact history-only repair.
- [x] Commit fail-closed production preflight and post-rollout verification scripts.
- [ ] Obtain verified production backup/export or equivalent recovery evidence.
- [ ] Name the production operator, rollback decision owner and change window.
- [ ] Re-run both production preflights immediately before the change.
- [ ] Apply the prepared 1–20 history-only repair and require a dry run showing migrations 21–34 only.
- [ ] Obtain explicit owner approval and apply migrations 21–34 in strict timestamp order.
- [ ] Verify live bracket save/reload, authenticated RPCs, function allowlists and submission timestamp after compatibility is restored.
- [ ] Record the exact application commit, hosted migration state, operator and verification evidence.

Do **not** point production at development Supabase and do not apply migration 33 or 34 alone.

## 1. Netlify environment isolation

- [ ] Scope production Supabase values to production deploys only.
- [ ] Ensure production-project deploy previews and branch deploys cannot access production Supabase.
- [ ] Confirm the separate development Netlify site uses development Supabase.
- [ ] Protect or disable production-project previews until isolation is verified.
- [ ] Re-check Turnstile domain/context behavior after the change.

## 2. Development migration rehearsal — completed

- [x] Confirm development competition data was disposable while preserving Auth-backed profiles and reference data.
- [x] Remove legacy 16-row brackets, old scored results and other disposable competition state.
- [x] Apply migrations 21–33 in timestamp order.
- [x] Clone the exact normalized production entry by stable match/team references.
- [x] Regenerate 24 group positions and resolve all eight R16 fixtures.
- [x] Replay the full 15-match predicted bracket and validate submission.
- [x] Rehearse result confirm/correct/clear and winner propagation.
- [x] Rehearse atomic bracket stale-snapshot rejection.
- [x] Apply migration 34 and verify the exact function execution matrix.
- [x] Restore development to the expected clean post-rollout mirror.
- [x] Run the migrations 21–34 post-rollout verifier with `overall_pass = true`.
- [ ] Let database-parity CI prove the new migration and pgTAP privilege suite on a clean disposable rebuild.

## 3. Hosted security hardening

### Function privileges and search paths — repository/development complete

- [x] Export and classify hosted security-advisor findings.
- [x] Revoke anonymous/browser execute from internal group-order helpers.
- [x] Revoke direct execute from trigger, signup and maintenance helpers.
- [x] Restrict score-recompute, rank-capture and result operations to service role.
- [x] Preserve only the explicit authenticated application RPC allowlist.
- [x] Set fixed empty `search_path` on the three mutable helpers.
- [x] Close future public-function default execution to owner-only.
- [x] Verify signup trigger behavior after direct function execution was removed.
- [x] Re-run development advisors and retain the before/after result.
- [ ] Apply migration 34 to production as part of the controlled 21–34 chain.
- [ ] Verify the exact production ACL matrix and advisor delta after rollout.

### Separate Auth/configuration work

- [ ] Review and approve enabling leaked-password protection.
- [ ] Enable leaked-password protection and verify signup/reset behavior.
- [ ] Keep intentional signed-in application RPC advisor notices documented rather than revoking required functionality blindly.

## 4. Production migration preflight and rollout plan

- [x] Run exact read-only source-state equivalents of the later fail-closed migrations.
- [x] Prove the existing submitted production entry:
  - [x] has all 36 group predictions;
  - [x] has exact valid tie decisions;
  - [x] regenerates all 24 group positions on development;
  - [x] resolves the best-third boundary;
  - [x] replays one valid 15-match bracket tree.
- [x] Confirm there are still no stored production results before result-lifecycle rollout.
- [x] Prove every structural effect of production migrations 1–20.
- [x] Prepare the exact 1–20 metadata-only migration-history repair.
- [x] Prepare stop/rollback/remediation rules for every migration boundary.
- [x] Extend the pending chain and verifier through migration 34.
- [ ] Preserve a production schema/data backup or equivalent recovery artifact.
- [ ] Review the final plan and dry-run output before any production mutation.
- [ ] Apply in timestamp order only after explicit approval.
- [ ] Verify bracket save/reload, submission, result lifecycle, scoring, winner propagation and function privilege boundaries.

## 5. Original Predictor reliability

- [ ] **`REL-003`** — flush or await pending score/tie/bracket/bonus writes before manual submit.
- [ ] Surface a clear submit-blocked state while any required write is pending, failed or conflicted.
- [ ] Test submit immediately after editing the last score and last bracket pick.
- [ ] **`DATA-005`** — define and persist score deletion when a completed prediction is cleared.
- [ ] **`REL-002`** — prevent late best-effort reads from overwriting newer local/server state.
- [ ] **`REL-006`** — make first entry creation idempotent under concurrent tabs.
- [ ] Complete wider tournament/reference immutability constraints.
- [ ] Map raw database/network errors to stable user-facing messages.

## 6. Real tournament progression

- [ ] Implement transactional real R16 population from confirmed group standings.
- [ ] Use the proven group-order and best-third rules.
- [ ] Add exact saved real tie decisions for unresolved actual standings.
- [ ] Fail closed if a tie crosses the fourth/fifth best-third boundary.
- [ ] Populate all eight R16 fixtures together.
- [ ] Do not overwrite participants beneath confirmed downstream results.
- [ ] Add pgTAP coverage for all 15 qualifying-third combinations and correction order.

## 7. Submission automation and reminders

- [ ] Implement automatic submission at the lock instant for valid complete entries.
- [ ] Record whether submission was manual or automatic.
- [ ] Keep incomplete entries out of standings.
- [ ] Add 48-hour and 24-hour reminder emails after SMTP/Auth settings are re-verified.
- [ ] Test exact lock-boundary behavior with the fake clock and database clock.
- [ ] Replace provisional `lock_at` with the official opening-match kickoff instant when confirmed.

## 8. Result administration

- [ ] Define the version-controlled admin authorization model.
- [ ] Do not rely on the nonexistent `profiles.role` field until a migration creates and tests it.
- [ ] Add a server-side adapter/control room for confirm, correct and clear.
- [ ] Require correction/clear reasons.
- [ ] Display result revision history.
- [ ] Add browser tests for regulation, extra time, penalties and downstream correction order.
- [ ] Keep result RPCs unavailable to ordinary browser roles.

## 9. Browser E2E

- [ ] Add Playwright or equivalent.
- [ ] Cover auth and password recovery without leaking enumeration details.
- [ ] Cover first-use welcome.
- [ ] Cover full group entry, ties, best thirds and bracket.
- [ ] Cover pending-write submission and conflict resolution.
- [ ] Cover league create/join/invite/deep-link flows.
- [ ] Cover result administration and scoring updates.
- [ ] Run mobile viewport and keyboard/accessibility journeys.
- [ ] Add the critical E2E suite as a required merge/release gate.

## 10. Operations readiness

- [ ] Confirm GitHub branch protection and required checks.
- [ ] Pin/verify the Netlify Node runtime as well as CI.
- [ ] Add production error reporting and alert ownership.
- [ ] Add uptime/critical-journey monitoring.
- [ ] Create a verified backup procedure.
- [ ] Rehearse restore into a safe environment.
- [ ] Rehearse application rollback without changing production Supabase.
- [ ] Record an incident template containing app commit, schema state and environment references.

## 11. Core experience follow-ups

After integrity gates:

- [ ] Complete other-player profile route/states.
- [ ] H2H rank graph and bracket-health-vs-real.
- [ ] Expanded match-centre phase states.
- [ ] Account/privacy/contact-admin surfaces.
- [ ] Post-lock prediction trends.
- [ ] Route focus/title/live-region behavior and skip link.
- [ ] Fix custom menu semantics.
- [ ] Improve invite preview before generic signup.
- [ ] Remove empty-data/error-state conflation.
- [ ] Run the mobile physics and single-tester friction pass.

## 12. Bonus games — launch scope after core gates

### Shared platform

- [ ] Optional competition entry framework.
- [ ] Separate scoring/league boundaries from Original Predictor.
- [ ] Stored competition windows and per-kickoff locks.
- [ ] Shared knockout prediction store only where rules require it.
- [ ] Admin controls and full rehearsal fixtures.

### KO Predictor

- [ ] Final rules/design pass.
- [ ] Build and isolate scoring.
- [ ] Test every knockout state and correction.

### Last Man Standing

- [ ] Final rules/design pass.
- [ ] Build round survival/elimination state.
- [ ] Test edge cases and admin corrections.

### Predictor Cup

- [ ] Confirm rules against `docs/predictor-cup-rules.md`.
- [ ] Complete UI design.
- [ ] Build draw, group/knockout progression and tie-breaks.
- [ ] Test arbitrary entrant counts and full cup lifecycle.

The Sweepstake builder remains non-launch-blocking.

## 13. Official data and final readiness

- [ ] Re-verify official Euro 2028 regulations and best-third allocation.
- [ ] Load official qualifiers without deleting provisional records unsafely.
- [ ] Assign teams to draw slots after the official draw/play-offs.
- [ ] Replace provisional dates/times with confirmed per-match kickoffs.
- [ ] Verify venue/team source metadata.
- [ ] Run a full multi-game dress rehearsal through the final.
- [ ] Run final security, accessibility, performance and documentation sweeps.
- [ ] Remove provisional/internal labels from public UI.

## Completed repository foundations

- [x] React/TypeScript/Vite/Supabase/Netlify application spine.
- [x] Original Predictor group, tie, third-place and bracket UI.
- [x] Leagues, H2H, matches, profile and points views.
- [x] Scoring rule/config alignment.
- [x] Application CI.
- [x] Disposable database parity CI.
- [x] Canonical predicted group ordering.
- [x] RPC-only submission and derived group positions.
- [x] Authoritative result lifecycle.
- [x] Predicted bracket-tree replay and winner propagation.
- [x] Atomic bracket persistence.
- [x] Exact function privilege allowlists and closed future defaults.
- [x] Hosted development migration/security rehearsal through migration 34.
- [x] Live hosted audit and documentation reconciliation.