# Euro 2028 Predictor — Current Build TODO

**Status date:** 26 July 2026  
**Purpose:** Near-term execution checklist. [`quality/current-status.md`](quality/current-status.md) is authoritative for current facts; [`roadmap.md`](roadmap.md) holds wider product sequencing.

## 0. Contract-35 hosted baseline — complete

- [x] Align development and final-target hosted databases through migration 35.
- [x] Verify the final-target application/database pair at contract 35.
- [x] Pass the 63-check verifier and rollback-only bracket, submission and result smoke.
- [x] Preserve environment isolation between development and final-target Supabase.
- [x] Record recovery and contract-35 promotion evidence.

The environment named `production` is the controlled final-target environment. It is not supporting a live tournament, but its configuration and retained verification data remain protected.

## 1. Contract-36 repository reconciliation — complete

- [x] Merge migration 36 through PR #76.
- [x] Update `config/deployment-contract.json` to 36.
- [x] Confirm application CI passed on the final PR #76 head.
- [x] Confirm disposable migration rebuild, database lint, pgTAP and parity passed.
- [x] Confirm Browser E2E passed.
- [x] Audit migration 36 against issue #72 acceptance criteria.
- [x] Merge PR #101.
- [x] Close issue #72 as repository implementation complete.
- [x] Resolve broad `DATA-006` wording unless a concrete uncovered relationship is demonstrated.
- [x] Reconcile `AGENTS.md`, `CLAUDE.md`, current status, risk, feature baseline, TODO and roadmap with the contract-36 repository state.

## 2. Development Supabase contract-36 upgrade — current hard gate

- [ ] Inspect development migration history read-only.
- [ ] Inspect the six protected relationship areas for incompatible existing data.
- [ ] Run a dry run and require migration 36 to be the only pending migration.
- [ ] Apply migration 36 to development only.
- [ ] Verify migration history records exactly 36 canonical versions.
- [ ] Verify all six private trigger functions and six triggers exist.
- [ ] Verify fixed search paths and revoked browser-role execution.
- [ ] Prove valid same-tournament writes still work.
- [ ] Prove cross-tournament writes fail for each guarded relationship.
- [ ] Run application and browser regressions against development.
- [ ] Update preview/branch/dev deployment contract declarations to 36 only after database verification.
- [ ] Record dated development evidence.

## 3. Restore exact-head contract-36 deploy-preview smoke

- [ ] Keep the preview target on the current `euro28predictor` Netlify project.
- [ ] Do not use `euro28-predictor-dev.netlify.app`; it is the protected legacy World Cup deployment.
- [ ] Ensure Netlify publishes a resolvable exact-head preview for pull requests.
- [ ] Update release-identity expectations from contract 35 to contract 36 only after development verification.
- [ ] Require development Supabase project `iouzoutneyjpugbbtdem` in preview metadata and browser requests.
- [ ] Run HTTP smoke and browser smoke against the exact PR head.
- [ ] Preserve fail-closed behaviour when the preview is missing, stale or points at the wrong environment.

## 4. Final-target contract-36 preparation

- [ ] Leave final-target Supabase and Netlify at contract 35 until development and preview evidence are accepted.
- [ ] Inspect final-target migration/data state read-only.
- [ ] Prepare recoverable pre-change evidence.
- [ ] Require a dry run showing only migration 36.
- [ ] Confirm migration preflight finds no incompatible data.
- [ ] Prepare exact verification and rollback-safe smoke commands.
- [ ] Obtain explicit owner approval before applying SQL.
- [ ] Apply migration 36 and verify exactly 36 migration-history rows.
- [ ] Change the final-target Netlify declaration from 35 to 36 only after database verification.
- [ ] Verify release identity, headers, routes, assets and environment isolation.
- [ ] Record dated final-target reconciliation.

## 5. Operations, monitoring and environment controls

- [x] Add provider-neutral client-error capture and release identity.
- [x] Integrate Sentry React SDK with final-target reporting disabled.
- [x] Add repeatable anonymous HTTP/browser smoke tooling.
- [ ] Approve retention, privacy and alert recipients before final-target reporting.
- [ ] Verify non-production reporting with synthetic non-sensitive events.
- [ ] Rehearse a compatible static application rollback.
- [ ] Confirm GitHub branch protection and required checks through issue #33.
- [ ] Resolve Turnstile/development CAPTCHA pairing through issue #28.
- [ ] Confirm or retire the legacy Netlify environment through issue #27.

## 6. Result administration — next major functional workstream

- [ ] Define a version-controlled administrator authorization and assignment model.
- [ ] Do not rely on a nonexistent `profiles.role` column.
- [ ] Treat draft PR #102 as a read-only UI/access foundation only.
- [ ] Remove any preview workflow dependency on the legacy Netlify site before PR #102 can merge.
- [ ] Add independently authorized browser-safe functions for confirm, correct and clear.
- [ ] Require reasons for correction and clearing.
- [ ] Expose revision history safely.
- [ ] Cover regulation, extra time, penalties and correction propagation.
- [ ] Keep authoritative result functions unavailable to ordinary users.
- [ ] Add desktop/mobile Browser E2E for result administration.
- [ ] Record hosted admin assignment and access evidence before enabling writes.

## 7. Authoritative knockout result consumption

- [ ] Extend the tournament frontend read model with result state, result method, authoritative winner, 90-minute score, 120-minute score and penalties.
- [ ] Make Match Centre use the authoritative winner rather than infer it from the public score.
- [ ] Make H2H elimination and bracket comparisons use the authoritative winner.
- [ ] Cover regulation, extra-time, penalty, corrected, cleared and unresolved knockout results.
- [ ] Ensure a tied public score decided on penalties never produces `actualWinner = null` after confirmation.

## 8. Tournament integrity and progression

- [ ] Implement transactional real R16 population from confirmed group standings.
- [ ] Use canonical group and best-third rules.
- [ ] Define authoritative actual tie decisions.
- [ ] Fail closed at unresolved best-third boundaries.
- [ ] Never overwrite participants beneath confirmed downstream results.
- [ ] Add correction and replay coverage.

## 9. Submission automation

- [ ] Implement automatic valid-entry submission at lock.
- [ ] Record manual versus automatic submission.
- [ ] Keep incomplete entries out of standings.
- [ ] Add reminders only after SMTP/Auth verification.
- [ ] Test the exact lock boundary.
- [ ] Replace provisional lock time when official kickoff is confirmed.
- [ ] Until implementation lands, label auto-submit in `docs/scoring-rules.md` as an approved target rule rather than current behaviour.

## 10. Core experience follow-ups

- [ ] Complete other-player profile states and richer H2H.
- [ ] Add rank graph and bracket-health-versus-real.
- [ ] Complete remaining Match Centre lifecycle/admin states.
- [ ] Add account, privacy and contact-admin surfaces.
- [ ] Add post-lock prediction trends.
- [ ] Complete unavailable/error/empty-state audit.
- [ ] Complete phone interaction and design-system consistency passes.

## 11. Accessibility, typing and performance

- [ ] Complete manual screen-reader review.
- [ ] Generate Supabase database types.
- [ ] Enable TypeScript strictness incrementally around critical boundaries.
- [ ] Validate RPC payloads at compile/test boundaries.
- [ ] Profile league summaries at representative scale.
- [ ] Profile full-tournament scoring at the intended user cap.
- [ ] Select licence, changelog and release-version policy.

## 12. Bonus games — after core gates

- [ ] Build optional competition framework with isolated scoring and league boundaries.
- [ ] Complete KO Predictor rules, design, build and tests.
- [ ] Complete Last Man Standing rules, design, build and tests.
- [ ] Complete Predictor Cup rules, design, build and tests.

Bonus games remain separate from the Original Predictor. Their appearance in roadmap or design files is not implementation evidence.

## 13. Official data and final readiness

- [ ] Reverify official Euro 2028 regulations and best-third allocation.
- [ ] Load official qualifiers and draw assignments safely.
- [ ] Replace provisional dates, times and lock instant.
- [ ] Verify venue, team and player source metadata.
- [ ] Run a complete multi-game dress rehearsal through the final.
- [ ] Run final security, accessibility, performance and documentation sweeps.
- [ ] Remove provisional/internal labels from public UI.
- [ ] Confirm monitoring, rollback and recovery ownership before tournament launch.
