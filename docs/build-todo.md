# Euro 2028 Predictor — Current Build TODO

**Status date:** 23 July 2026  
**Purpose:** Near-term execution checklist. `docs/quality/current-status.md` is authoritative for facts; `docs/roadmap.md` holds the wider sequence.

## 0. Production compatibility incident — do first

- [ ] Freeze ordinary production promotion.
- [ ] Confirm production Netlify commit and production Supabase capability immediately before recovery work.
- [ ] Decide the reviewed recovery path:
  - [ ] compatible application rollback while keeping production Supabase unchanged; or
  - [ ] staged migration rollout through development then production.
- [ ] Do **not** point production at development Supabase.
- [ ] Verify live bracket save and reload after compatibility is restored.
- [ ] Record exact application commit, hosted migration state, operator and verification evidence.

## 1. Netlify environment isolation

- [ ] Scope production Supabase values to production deploys only.
- [ ] Ensure production-project deploy previews and branch deploys cannot access production Supabase.
- [ ] Confirm the separate development Netlify site uses development Supabase.
- [ ] Protect or disable production-project previews until isolation is verified.
- [ ] Re-check Turnstile domain/context behavior after the change.

## 2. Development migration preparation

Current blockers: 22 submitted entries, 20 legacy 16-row brackets and 12 stored results.

- [ ] Decide whether development data is disposable.
- [ ] Prefer a documented reset/reseed when preserving hostile fixtures has no value.
- [ ] Otherwise write an explicit remediation plan for:
  - [ ] legacy 16-row progression rows;
  - [ ] result-method classification for 12 scored matches;
  - [ ] submitted-entry preflight validity.
- [ ] Rebuild all 33 migrations in disposable local Supabase.
- [ ] Run database lint, all pgTAP suites and TypeScript/PostgreSQL parity.
- [ ] Apply migrations 21–33 to development only after explicit approval.
- [ ] Verify every grant, policy, function and critical behavior in hosted development.

## 3. Hosted security hardening

- [ ] Export and classify Supabase security-advisor findings for both hosted projects.
- [ ] Revoke browser execute from internal group-order helpers unless explicitly required.
- [ ] Revoke browser execute from trigger and maintenance helpers.
- [ ] Restrict score-recompute and rank-capture functions to their intended server paths.
- [ ] Set fixed safe `search_path` on remaining functions.
- [ ] Verify public/anon/authenticated grants after the later migration chain.
- [ ] Review enabling leaked-password protection.
- [ ] Re-run advisors and retain the before/after result.

## 4. Production migration preflight and rollout plan

- [ ] Preserve a production schema/data snapshot appropriate to the current plan.
- [ ] Run exact read-only equivalents of migrations 24, 25, 27, 28 and 32.
- [ ] Prove the existing submitted production entry:
  - [ ] has all 36 group predictions;
  - [ ] has exact valid tie decisions;
  - [ ] derives all 24 group positions;
  - [ ] resolves the best-third boundary;
  - [ ] replays one valid 15-match bracket tree.
- [ ] Confirm there are still no stored production results before result-lifecycle rollout.
- [ ] Prepare stop/rollback/remediation rules for every migration boundary.
- [ ] Review the plan before any production mutation.
- [ ] Apply in timestamp order only after explicit approval.
- [ ] Verify bracket save/reload, submission, result lifecycle, scoring and winner propagation.

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
- [x] Repository/local RPC-only submission and derived group positions.
- [x] Repository/local authoritative result lifecycle.
- [x] Repository/local predicted bracket-tree replay and winner propagation.
- [x] Repository/local atomic bracket persistence.
- [x] Live hosted audit and documentation reconciliation.
