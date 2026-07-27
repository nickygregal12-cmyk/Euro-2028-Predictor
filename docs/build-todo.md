# Euro 2028 Predictor — Current Build TODO

**Status date:** 26 July 2026  
**Authority:** Near-term execution checklist. `docs/quality/current-status.md` is authoritative for facts.

## 0. Contract-35 hosted baseline — complete

- [x] Verify development and final-target through migration 35.
- [x] Verify the final-target application/database pair at contract 35.
- [x] Pass the 63-check verifier and rollback-only bracket, submission and result smoke.
- [x] Preserve development/final-target isolation.
- [x] Record recovery and promotion evidence.

The Netlify context named `production` is the controlled final target, not an active tournament.

## 1. Contract-36 repository/control-plane reconciliation — complete

- [x] Merge migration 36 through PR #76.
- [x] Update repository deployment contract to 36.
- [x] Pass application CI, Database parity and Browser E2E.
- [x] Merge PR #101 and close issue #72 as repository implementation complete.
- [x] Merge PR #103 to reconcile active agent/status/risk/roadmap authority.

## 2. Development Supabase contract-36 promotion — complete

- [x] Restore the paused development project and wait for the canonical schema/history to become available.
- [x] Verify migration history was exactly 1–35 before change.
- [x] Verify all six migration-36 preflight counts were zero.
- [x] Apply the exact canonical migration-36 SQL to development only.
- [x] Record and verify canonical version `20260725010000` and migration name.
- [x] Verify stored SQL MD5 matches the repository file.
- [x] Verify all six private functions, fixed search paths, privilege revocations and enabled triggers.
- [x] Prove legal same-tournament writes and rejection of all six cross-tournament relationship groups.
- [x] Prove rollback verification left no temporary rows.
- [x] Record the connected-tool limitation honestly rather than claiming a CLI dry run.

## 3. Contract-36 non-production Netlify and exact-head preview — complete

- [x] Keep previews on the current `euro28predictor` project.
- [x] Leave the legacy `euro28-predictor-dev` World Cup site untouched.
- [x] Change only `dev`, `branch-deploy` and `deploy-preview` contract declarations to 36.
- [x] Preserve development Supabase isolation.
- [x] Make smoke contract expectations explicit per target.
- [x] Prove exact PR head, 36/36 release identity and development Supabase ref.
- [x] Pass HTTP smoke and anonymous browser smoke.
- [x] Pass standard CI run 585 and both Browser E2E jobs in run 274.
- [x] Record dated development promotion evidence.
- [x] Merge PR #105 without moving the production deploy or contract.

## 4. Final-target contract-36 preparation — approval gate

- [x] Leave final-target Supabase and production Netlify at contract 35 during development promotion.
- [x] Inspect final-target migration history and relevant data read-only.
- [ ] Create and accept a fresh recoverable pre-change source bundle after the quiet window begins.
- [x] Establish migration 36 as the only canonical pending migration.
- [x] Run all six fail-closed preflight checks; each returned zero incompatible rows.
- [x] Capture fresh counts, timestamps and non-sensitive fingerprints.
- [x] Confirm current production deploy remains ready on the retained 35/35 pair.
- [x] Prepare exact migration application, verification, failure and rollback-safe smoke commands.
- [x] Review current Supabase security/performance advisor findings separately.
- [ ] Rerun history, preflight, counts and fingerprints immediately before the write.
- [ ] Require `supabase db push --dry-run` to list exactly migration 36.
- [ ] Obtain explicit owner approval before any final-target SQL.
- [ ] Apply migration 36 and verify exactly 36 canonical history versions.
- [ ] Verify functions, triggers, privileges and rollback-only behaviour.
- [ ] Require zero pending migrations after application.
- [ ] Change production Netlify declaration to 36 only after database verification.
- [ ] Restore exact-head production-smoke semantics at contract 36.
- [ ] Require exact-head production deploy, release identity, HTTP/browser smoke and environment isolation.
- [ ] Verify privacy-safe Sentry production tracing remains healthy.
- [ ] Record a dated final-target promotion reconciliation.

Preparation evidence: `docs/quality/reconciliations/2026-07-26-contract-36-final-target-preparation.md`.

## 5. Operations, monitoring and environment controls

- [x] Add provider-neutral client-error capture and release identity.
- [x] Integrate the official Sentry React SDK.
- [x] Verify privacy-safe deploy-preview error delivery and production trace delivery.
- [x] Keep Replay, logs, profiling, automatic user context, breadcrumbs, fetch/XHR tracing, trace propagation and source maps disabled.
- [x] Add target-specific anonymous HTTP/browser smoke tooling.
- [ ] Record the actual Sentry retention setting.
- [ ] Confirm server-side/IP scrubbing settings.
- [ ] Name a backup alert recipient and escalation path.
- [ ] Retain push-triggered production-smoke evidence where accessible.
- [ ] Perform the owner-approved Netlify rollback promotion rehearsal.
- [ ] Fix or formally accept the mutable search path on `public.enforce_joker_rules`.
- [ ] Review authenticated `SECURITY DEFINER` functions against the intended allowlist.
- [ ] Review missing foreign-key indexes with representative query evidence.
- [ ] Decide leaked-password protection.
- [ ] Confirm branch protection/required checks through issue #33.
- [ ] Resolve Turnstile/development CAPTCHA through issue #28.
- [ ] Confirm or retire the legacy environment through issue #27.

## 6. Result administration — next major functional workstream

- [ ] Rebase/fix draft PR #102 onto current `main`, contract 36 and the current Netlify preview host.
- [ ] Treat PR #102 as a read-only UI/access foundation until server-authorized writes exist.
- [ ] Define a version-controlled administrator authorization and assignment model.
- [ ] Do not rely on nonexistent `profiles.role`.
- [ ] Add independently authorized browser-safe confirm/correct/clear functions.
- [ ] Require reasons for correction and clearing.
- [ ] Expose revision history safely.
- [ ] Cover regulation, extra time, penalties and correction propagation.
- [ ] Keep authoritative result functions unavailable to ordinary users.
- [ ] Add desktop/mobile Browser E2E and hosted assignment/access evidence.

## 7. Authoritative knockout-result consumption

- [ ] Extend frontend read models with result state/method, authoritative winner, 90-minute score, 120-minute score and penalties.
- [ ] Make Match Centre and H2H consume authoritative winner data.
- [ ] Cover regulation, extra time, penalties, correction, clear and unresolved states.
- [ ] Ensure a penalty-decided tied public score never produces `actualWinner = null`.

## 8. Tournament integrity and progression

- [ ] Populate real R16 transactionally from confirmed standings.
- [ ] Use canonical group/best-third rules and authoritative actual tie decisions.
- [ ] Fail closed at unresolved boundaries.
- [ ] Never overwrite participants beneath confirmed downstream results.
- [ ] Add correction/replay coverage.

## 9. Submission automation

- [ ] Implement automatic valid-entry submission at lock.
- [ ] Record manual versus automatic submission.
- [ ] Keep incomplete entries out of standings.
- [ ] Add reminders after SMTP/Auth verification.
- [ ] Test exact lock boundary and replace provisional lock time when official.
- [ ] Keep docs clear that auto-submit is target behaviour until implemented.

## 10. Core experience

- [ ] Complete other-player profiles and richer H2H.
- [ ] Add rank graph and bracket-health-versus-real.
- [ ] Complete Match Centre lifecycle/admin states.
- [ ] Add account, privacy and contact-admin surfaces.
- [ ] Add post-lock trends.
- [ ] Complete unavailable/error/empty-state and phone/design consistency passes.

## 11. Accessibility, typing and performance

- [ ] Complete manual screen-reader review.
- [ ] Generate Supabase database types.
- [ ] Increase TypeScript strictness around critical boundaries.
- [ ] Validate RPC payloads at compile/test boundaries.
- [ ] Profile league summaries and full-tournament scoring at representative scale.
- [ ] Select licence, changelog and release-version policy.

## 12. Bonus games — after core gates

- [ ] Build isolated optional-competition framework.
- [ ] Complete KO Predictor.
- [ ] Complete Last Man Standing.
- [ ] Complete Predictor Cup.

Bonus games never combine scoring/leagues with the Original Predictor.

## 13. Official data and final readiness

- [ ] Reverify official regulations and best-third allocation.
- [ ] Load official qualifiers/draw safely.
- [ ] Replace provisional dates/times/lock instant.
- [ ] Verify source metadata.
- [ ] Run full tournament, security, accessibility, performance, monitoring, rollback and recovery rehearsals.
- [ ] Remove provisional/internal labels before public launch.
