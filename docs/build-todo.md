# Euro 2028 Predictor — Current Build TODO

**Status date:** 25 July 2026  
**Purpose:** Near-term execution checklist. [`quality/current-status.md`](quality/current-status.md) is authoritative for current facts; [`roadmap.md`](roadmap.md) holds wider product sequencing.

## 0. Contract-35 production compatibility — complete

- [x] Freeze ordinary promotion while production application/database were incompatible.
- [x] Verify the missing atomic-bracket and score-clear RPC boundaries.
- [x] Rehearse migrations 21–35 on hosted development using production-shaped data.
- [x] Prove production migration 1–20 structural effects.
- [x] Prepare and verify the exact 1–20 metadata-only history repair.
- [x] Create and verify an encrypted off-device production backup.
- [x] Complete corrected empty-target restore and forward migration rehearsal.
- [x] Accept the executed OpenSSL AES-256-CBC/PBKDF2 recovery artifact.
- [x] Rerun production preflights and preserve source fingerprints.
- [x] Repair production history for exactly migrations 1–20.
- [x] Require the production dry run to show exactly migrations 21–35.
- [x] Apply migrations 21–35 in timestamp order.
- [x] Verify exactly 35 migration-history rows and zero pending migrations.
- [x] Pass all 63 production post-rollout checks.
- [x] Pass rollback-only atomic bracket, submission and result-lifecycle smoke checks.
- [x] Change only production `EURO28_DEPLOYED_DB_CONTRACT` from 20 to 35.
- [x] Publish approved commit `902a37aa6c50c967f8080d751147a5733b251fe3`.
- [x] Verify production deploy `6a652c3d3416d26d595ae2ef`.
- [x] Verify metadata, security headers, SPA routes, assets and anonymous browser journeys.
- [x] Verify no development Supabase endpoint/browser request in production.
- [x] Keep migration 36 and PR #76 outside the rollout.
- [x] Merge the complete production documentation reconciliation through PR #90.

Completed evidence: [`quality/reconciliations/2026-07-25-contract-35-production-promotion.md`](quality/reconciliations/2026-07-25-contract-35-production-promotion.md).

## 1. Production operations and monitoring — current hard gate

### Assurance foundation — issue #91 / PR #92

- [x] Add a single provider-neutral client-error boundary.
- [x] Capture React render, startup, global error and unhandled-rejection failures.
- [x] Redact emails, credentials, URL queries, local paths and raw database errors.
- [x] Ensure a reporter failure cannot prevent application startup/use.
- [x] Emit non-secret release identity at `/release.json`.
- [x] Add a fail-closed anonymous HTTP production smoke command.
- [x] Add an isolated anonymous Playwright production smoke command.
- [x] Document the contract-35 application rollback decision tree.
- [ ] Require final CI and Browser E2E on PR #92.
- [ ] Verify deploy-preview release identity reports `deploy-preview`, contract 35 and development Supabase.
- [ ] Run both smoke commands against the approved preview with explicit non-production flags.
- [ ] Merge and deploy only after the preview evidence passes.
- [ ] Run both anonymous smoke commands against the resulting production deployment.

### Monitoring delivery and ownership

- [ ] Select and approve a production error-reporting provider.
- [ ] Approve data-processing terms, data location and retention duration.
- [ ] Assign primary and backup alert recipients plus escalation path.
- [ ] Configure and verify a non-production reporter project first.
- [ ] Review required CSP/network changes before enabling delivery.
- [ ] Verify redaction using synthetic non-sensitive events.
- [ ] Enable production reporting only through a separate reviewed configuration action.
- [ ] Define critical-journey availability checks for login, entry loading, saves, submission, leagues and Match Centre.
- [ ] Define database health/advisor review cadence.
- [ ] Define production incident severity and communication rules.

### Rollback and recovery operations

- [ ] Rehearse a compatible Netlify application rollback while keeping production Supabase unchanged.
- [ ] Require release identity, headers, auth routing and environment-isolation smoke after rollback.
- [ ] Schedule periodic backup creation, off-site verification and disposable restore rehearsal.
- [ ] Record recovery artifact retention/expiry and secure plaintext cleanup policy.

## 2. Netlify, Auth and repository controls

### Environment/deployment controls

- [x] Scope production Supabase values to production context.
- [x] Point deploy-preview, branch-deploy and dev at development Supabase.
- [x] Add fail-closed environment-context and deployment-contract guards.
- [x] Align production, preview, branch and dev declarations at contract 35 while preserving Supabase isolation.
- [x] Verify current production deploy and exact source commit.
- [ ] Confirm GitHub branch-protection and required-check enforcement through issue #33.
- [ ] Confirm/retire the separately maintained legacy Netlify environment through issue #27.

### Auth/abuse configuration

- [ ] Configure and verify matching non-production Turnstile/development Supabase CAPTCHA pairing.
- [ ] Verify preview login, signup and recovery plus production regression.
- [ ] Review and approve leaked-password protection.
- [ ] Enable and verify leaked-password protection if approved.
- [ ] Replace count-then-insert rate limiting with atomic serialization.
- [ ] Complete invite/aggregate disclosure and abuse review.

## 3. Production database and reliability assurance

### Completed production contract

- [x] RPC-only submission and server-derived positions.
- [x] Authoritative result lifecycle, revisions and serialized scoring.
- [x] Predicted bracket replay and real winner propagation.
- [x] Atomic complete-bracket replacement.
- [x] Version-safe score deletion and derived-position invalidation.
- [x] Exact function allowlists and zero anonymous application execution.
- [x] Production migration history exactly 1–35.

### Remaining browser assurance

- [ ] Design a controlled authenticated production smoke account/data strategy that cannot damage retained user predictions.
- [ ] Browser-verify persisted score clear/reload, restore, stale conflict and post-lock refusal in production.
- [ ] Browser-verify multi-device bracket conflict/recovery in production.
- [ ] Browser-verify immediate final-edit submission settlement in production.
- [ ] Record production browser evidence and decide final closure of `DATA-005`, `REL-007` and remaining `TEST-001` scope.

## 4. Tournament/reference integrity

- [ ] Complete wider same-tournament/reference immutability work (`DATA-003`/`DATA-006`).
- [ ] Review draft PR #76 on its own merits; do not merge solely because CI is green.
- [ ] Keep migration 36 outside production until separately rehearsed and approved.
- [ ] Update deployment contract deliberately if migration 36 is merged.
- [ ] Implement transactional real R16 population from confirmed group standings.
- [ ] Use canonical group/best-third rules.
- [ ] Define and save authoritative actual tie decisions for unresolved standings.
- [ ] Fail closed at the best-third boundary.
- [ ] Never overwrite participants beneath confirmed downstream results.
- [ ] Add exhaustive pgTAP and correction coverage.

## 5. Submission automation and reminders

- [ ] Implement automatic valid-entry submission at lock.
- [ ] Record manual versus automatic submission.
- [ ] Keep incomplete entries out of standings.
- [ ] Add 48-hour and 24-hour reminders after SMTP/Auth verification.
- [ ] Test the exact lock boundary.
- [ ] Replace provisional `lock_at` with the official opening kickoff when confirmed.

## 6. Result administration

- [ ] Define a version-controlled administrator authorization model.
- [ ] Do not rely on nonexistent `profiles.role` without migration/tests.
- [ ] Add server-side/browser administration for confirm, correct and clear.
- [ ] Require correction/clear reasons and expose revision history safely.
- [ ] Cover regulation, extra time, penalties and correction propagation.
- [ ] Keep result RPCs unavailable to ordinary browser roles.
- [ ] Add result-administration Browser E2E after implementation.

## 7. Browser E2E and accessibility

### Completed

- [x] Dedicated Playwright/Chromium gate against disposable Supabase.
- [x] Signup confirmation, password recovery and welcome journeys.
- [x] Complete entry, ties, bracket, submission, failures, conflicts and lock rejection.
- [x] Score clear/reload and protected deletion in disposable Browser E2E.
- [x] Desktop and phone-width authenticated/signed-out journeys.
- [x] Private league create/invite/join browser journey.
- [x] Route titles, live announcements, main focus and skip navigation.
- [x] Pending-invite continuation through signup confirmation and Welcome.
- [x] One-off anonymous production route, title, header, asset and environment verification.
- [x] Repository HTTP/browser production-smoke harness authored in PR #92.

### Remaining

- [ ] Pass the committed smoke harness against preview and production.
- [ ] Complete manual screen-reader review for `A11Y-001`.
- [ ] Add result-administration journey after implementation.
- [ ] Add controlled authenticated production mutation smoke.
- [ ] Preserve unavailable/error/empty distinctions across remaining remote-read consumers.

## 8. Core experience follow-ups

- [ ] Complete other-player profile states and richer H2H.
- [ ] Add rank graph and bracket-health-versus-real.
- [ ] Expand Match Centre pre/live/post/admin states.
- [ ] Add account/privacy/contact-admin surfaces.
- [ ] Add post-lock prediction trends.
- [ ] Add a privacy-reviewed trustworthy invite preview before auth.
- [ ] Complete mobile physics/friction pass.
- [ ] Run a final design-system consistency pass.

## 9. Architecture, typing and performance

- [ ] Generate Supabase database types.
- [ ] Enable TypeScript strictness incrementally around critical RPC/domain boundaries.
- [ ] Validate critical RPC payloads at compile/test boundaries.
- [ ] Split demonstrated provider/orchestration hotspots only where it reduces risk.
- [ ] Profile league summary requests at representative scale.
- [ ] Profile full-tournament scoring at 250-user capacity before optimization.
- [ ] Select licence and changelog policy.
- [ ] Replace package version `0.0.0` through an approved release-version policy.

## 10. Bonus games — after core gates

- [ ] Build optional competition framework with isolated scoring/league boundaries.
- [ ] Complete rules/design/build/test for KO Predictor.
- [ ] Complete rules/design/build/test for Last Man Standing.
- [ ] Complete rules/design/build/test for Predictor Cup.

Sweepstake builder remains non-launch-blocking. Fan Duels direct challenges remain superseded unless explicitly reopened.

## 11. Official data and final readiness

- [ ] Reverify official Euro 2028 regulations and best-third allocation.
- [ ] Load official qualifiers/draw assignments safely.
- [ ] Replace provisional dates, times and lock instant.
- [ ] Verify venue/team/player source metadata.
- [ ] Run a complete multi-game dress rehearsal through the final.
- [ ] Run final security, accessibility, performance and documentation sweeps.
- [ ] Remove provisional/internal labels from public UI.
- [ ] Confirm monitoring, rollback and recovery ownership before tournament launch.

## Completed foundations

- [x] React/TypeScript/Vite/Supabase/Netlify application spine.
- [x] Original Predictor group/tie/third-place/bracket UI.
- [x] Leagues, H2H, matches, profile and points views.
- [x] Scoring authority alignment.
- [x] Application CI, disposable database parity and substantial Browser E2E.
- [x] Canonical predicted group ordering.
- [x] Production RPC-only submission and server-derived positions.
- [x] Production authoritative result lifecycle and bracket replay.
- [x] Production atomic bracket persistence and version-safe score clearing.
- [x] Production exact function allowlists and closed future defaults.
- [x] Development and production schema/history aligned through 35.
- [x] Netlify production/non-production Supabase isolation.
- [x] Fail-closed application/database deployment contract.
- [x] Node `22.22.2` alignment.
- [x] Accepted encrypted off-device production recovery artifact and clean restore proof.
- [x] Contract-35 production database rollout and application promotion.
- [x] Provider-neutral release identity, redacting capture and production-smoke foundation authored.
