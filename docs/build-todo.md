# Euro 2028 Predictor — Current Build TODO

**Status date:** 25 July 2026  
**Purpose:** Near-term execution checklist. [`quality/current-status.md`](quality/current-status.md) is authoritative for current facts; [`roadmap.md`](roadmap.md) holds wider product sequencing.

## 0. Production compatibility incident — stop-the-line gate

- [x] Freeze ordinary production promotion in repository guidance/runbooks.
- [x] Confirm production application/Supabase mismatch at bracket and score-clear RPC boundaries.
- [x] Verify production lacks both `replace_predicted_progression` and `delete_match_prediction`.
- [x] Verify production retains old direct progression and match-prediction delete privileges.
- [x] Rehearse migrations 21–35 on hosted development using production-shaped data.
- [x] Prove production migration 1–20 structural effects.
- [x] Prepare exact 1–20 metadata-only history repair.
- [x] Commit fail-closed production preflight and post-rollout verification.
- [x] Add fail-closed backup creation tooling/checksums/restore runbook.
- [x] Add application/database contract 35 and keep production at contract 20.
- [x] Align development physical schema and canonical migration history through 35.
- [x] Rerun production baseline and source preflight on 25 July; require exact fingerprints.
- [x] Create fresh production roles/schema/data bundle.
- [x] Verify `auth.users`, `public.profiles`, permissions and all plaintext checksums.
- [x] Encrypt the source artifact and verify decryption/encrypted checksum.
- [x] Copy encrypted artifact/checksum off the working Mac.
- [ ] Retrieve the off-device artifact through the custody path.
- [ ] Verify encrypted and plaintext checksums after retrieval.
- [ ] Restore it to disposable project `eckuehkcmkhuhmsfxtxu`.
- [ ] Verify baseline/source counts, fingerprints, Auth users/profiles, Storage and signup trigger.
- [ ] Preferably rehearse 1–20 history repair and migrations 21–35 on the restored target.
- [ ] Record/accept the actual encryption method and complete recovery acceptance.
- [ ] Name/approve the production migration window and recovery decision owner.
- [ ] Freeze production writes/deployments for the approved window and refetch release identity.
- [ ] Rerun both production preflights immediately before history repair.
- [ ] Apply the prepared 1–20 metadata-only repair.
- [ ] Require `db push --dry-run` to show migrations 21–35 only.
- [ ] Obtain explicit approval and apply migrations 21–35 in strict order.
- [ ] Run post-verification, advisors and authenticated production smoke journeys.
- [ ] Change production contract 20 → 35 only after every database/application check passes.
- [ ] Publish and record the exact compatible release/schema pair.

Do **not** point production at development Supabase, add direct-table fallbacks, apply migrations 33–35 alone, include draft migration 36 or lift the production contract early.

## 1. Netlify environment and deployment controls

- [x] Scope production Supabase values to production context.
- [x] Point deploy-preview, branch-deploy and dev at development Supabase.
- [x] Add a fail-closed environment-context prebuild guard.
- [x] Add contract-version and migration-count deployment guard.
- [x] Set non-production contract to 35.
- [x] Keep production contract at 20 until rollout verification passes.
- [x] Verify current ready production deploy and context matrix.
- [x] Confirm PR #76 contract-36 preview failure is expected while preview declares 35.
- [ ] Recheck Turnstile domain/context behavior after dashboard configuration.
- [ ] Confirm/retire separately maintained legacy Netlify environment through issue #27.
- [ ] Confirm GitHub branch-protection/required-check enforcement through issue #33.

## 2. Development migration rehearsal — complete through contract 35

- [x] Apply migrations 21–35 in timestamp order.
- [x] Clone/reconstruct normalized production entry by stable references.
- [x] Regenerate 24 group positions and all eight R16 fixtures.
- [x] Replay complete predicted bracket and validate submission.
- [x] Rehearse result confirm/correct/clear and winner propagation.
- [x] Rehearse atomic bracket stale-snapshot rejection.
- [x] Verify exact function allowlists/search paths/advisor delta.
- [x] Verify version-safe score deletion, invalidation, idempotency and lock refusal.
- [x] Restore development to expected clean mirror.
- [x] Align migration history to exactly 35 canonical records.
- [x] Require empty final application-schema diff.
- [x] Pass migration rebuild, lint, pgTAP and TypeScript/PostgreSQL parity.

Do not run additional history repair against development. Migration 36 remains draft PR work.

## 3. Hosted security and Auth configuration

### Function/database privileges

- [x] Revoke anonymous/browser execution from internal helpers in repository/development.
- [x] Restrict trigger/signup/maintenance functions.
- [x] Restrict scoring, rank and result administration to service role.
- [x] Preserve exact authenticated application RPC allowlist.
- [x] Add protected prediction-delete RPC to allowlists.
- [x] Fix mutable helper search paths and close future defaults.
- [ ] Apply complete migrations 21–35 to production through controlled rollout.
- [ ] Verify exact production ACL/advisor result.

### Auth/abuse configuration

- [ ] Configure/verify matching non-production Turnstile and development Supabase CAPTCHA pair.
- [ ] Verify preview login, signup and recovery plus production regression.
- [ ] Review and approve leaked-password protection.
- [ ] Enable and verify signup/reset behavior if approved.
- [ ] Replace count-then-insert rate limiting with atomic serialization.
- [ ] Complete invite/aggregate disclosure and abuse review.

## 4. Production backup and restore evidence

### Source artifact — complete

- [x] Create roles, schema and COPY-format data dumps.
- [x] Confirm `auth.users` and `public.profiles`.
- [x] Capture inventory, tool versions, repository commit and migration list.
- [x] Include Auth/Storage drift and signup-trigger restore statement.
- [x] Apply owner-only permissions.
- [x] Generate/verify recursive plaintext checksums.
- [x] Encrypt artifact using OpenSSL AES-256-CBC/PBKDF2.
- [x] Verify decryptability and encrypted checksum.
- [x] Copy encrypted archive/checksum off the Mac.

### Recovery proof — pending

- [ ] Explicitly accept executed encryption method or create replacement artifact.
- [ ] Retrieve artifact from off-device custody.
- [ ] Verify encrypted checksum after retrieval.
- [ ] Decrypt into restricted temporary location and verify plaintext checksums.
- [ ] Restore roles/schema/data/managed Auth trigger to disposable target.
- [ ] Run baseline 1–20 verifier and production preflight against restore.
- [ ] Verify Auth users/profiles, Storage and signup/profile trigger behavior.
- [ ] Preferably forward-rehearse history repair plus migrations 21–35.
- [ ] Retain non-secret recovery record and cleanup confirmation.

## 5. Production rollout verification

- [x] Prove current submitted production source shape and fingerprints.
- [x] Prove migration 1–20 structural effects.
- [x] Confirm production history table is absent.
- [x] Confirm both client-required RPCs are absent.
- [x] Prepare exact history repair, dry-run expectations and failure rules.
- [ ] Complete recovery acceptance.
- [ ] Review fresh preflight/history/dry-run output.
- [ ] Apply only after explicit approval.
- [ ] Run post-rollout verifier and security advisors.
- [ ] Run bracket save/reload, submission settlement and score clear/reload/conflict/lock smoke checks.
- [ ] Update production contract to 35 only after all checks pass.
- [ ] Verify approved production deployment becomes current.

## 6. Original Predictor reliability

### Completed repository/disposable work

- [x] `REL-002` — prevent late reads overwriting newer state.
- [x] `REL-003` — settle pending score/tie/bracket/Golden Boot/delete writes before submission.
- [x] `REL-004` — atomic complete-bracket snapshot RPC in contract 35.
- [x] `REL-005` — refresh stale open pages on genuine foreground return.
- [x] `REL-006` — idempotent concurrent first entry creation.
- [x] `REL-007` — versioned complete-snapshot conflict protection in repository/development.
- [x] `DATA-005` — version-safe persisted score deletion in repository/development.
- [x] Add disposable browser journeys for final edits, failures, conflicts, score clearing and lock rejection.
- [x] Map raw infrastructure failures to stable safe user-facing copy (`SEC-002`).

### Production closure pending

- [ ] Apply migrations 21–35.
- [ ] Browser-verify final-edit submission settlement in production.
- [ ] Browser-verify bracket snapshot conflict behavior in production.
- [ ] Browser-verify score clear/reload, restore, stale conflict and post-lock refusal.
- [ ] Close production-dependent reliability findings only after evidence passes.

## 7. Tournament/reference integrity

- [ ] Complete wider same-tournament/reference immutability work (`DATA-003`/`DATA-006`).
- [ ] Review draft PR #76; do not merge solely because its CI is green.
- [ ] Keep migration 36 outside production contract-35 rollout.
- [ ] Implement transactional real R16 population from confirmed group standings.
- [ ] Use canonical group/best-third rules.
- [ ] Define/save authoritative actual tie decisions for unresolved standings.
- [ ] Fail closed at best-third boundary.
- [ ] Never overwrite participants beneath confirmed downstream results.
- [ ] Add exhaustive pgTAP/correction coverage.

## 8. Submission automation and reminders

- [ ] Implement automatic valid-entry submission at lock.
- [ ] Record manual versus automatic submission.
- [ ] Keep incomplete entries out of standings.
- [ ] Add 48-hour and 24-hour reminders after SMTP/Auth verification.
- [ ] Test exact lock boundary.
- [ ] Replace provisional `lock_at` with official opening kickoff when confirmed.

## 9. Result administration

- [ ] Define version-controlled admin authorization model.
- [ ] Do not rely on nonexistent `profiles.role` without migration/tests.
- [ ] Add server-side/browser administration for confirm, correct and clear.
- [ ] Require reasons and expose revision history.
- [ ] Cover regulation, extra time, penalties and correction propagation.
- [ ] Keep result RPCs unavailable to ordinary browser roles.

## 10. Browser E2E, accessibility and operations

- [x] Dedicated Playwright/Chromium gate against disposable Supabase.
- [x] Cover signup confirmation, password recovery, welcome, full entry, ties, bracket and submission.
- [x] Cover save failure, optimistic conflicts, score clear/reload and post-lock rejection.
- [x] Run authenticated/signed-out phone-width journeys.
- [x] Run Browser E2E as a path-scoped PR workflow.
- [x] Implement route titles, live announcements, main focus and skip navigation.
- [x] Replace league-options ARIA menu mismatch with disclosure semantics (`A11Y-002`).
- [x] Add private league creation/invitation/join browser journey.
- [x] Add retained keyboard and route-announcement browser evidence (`A11Y-001`).
- [ ] Complete manual screen-reader review for `A11Y-001`.
- [ ] Add result-administration journey after implementation.
- [ ] Add production error reporting, alert ownership and critical-journey monitoring.
- [ ] Periodically repeat backup/restore/application rollback rehearsals.

## 11. Core experience follow-ups

After integrity/recovery gates:

- [ ] Complete other-player profile states and richer H2H.
- [ ] Add rank graph and bracket-health-versus-real.
- [ ] Expand Match Centre pre/live/post/admin states.
- [ ] Add account/privacy/contact-admin surfaces.
- [ ] Add post-lock prediction trends.
- [ ] Improve trustworthy invite preview before auth and remove render-time pending-join mutation.
- [ ] Preserve unavailable/error/empty distinctions.
- [ ] Complete mobile physics/friction pass.

## 12. Architecture, typing and performance

- [ ] Generate Supabase database types.
- [ ] Enable TypeScript strictness incrementally around critical RPC/domain boundaries.
- [ ] Validate critical RPC payloads at compile/test boundaries.
- [ ] Split demonstrated provider/orchestration hotspots only where it reduces risk.
- [ ] Profile league summary requests at representative scale.
- [ ] Profile full-tournament scoring at 250-user capacity before optimization.
- [ ] Select licence and changelog policy.
- [ ] Replace package version `0.0.0` through an approved release-version policy.

## 13. Bonus games — after core gates

- [ ] Build optional competition framework with isolated scoring/league boundaries.
- [ ] Complete rules/design/build/test for KO Predictor.
- [ ] Complete rules/design/build/test for Last Man Standing.
- [ ] Complete rules/design/build/test for Predictor Cup.

Sweepstake builder remains non-launch-blocking. Fan Duels direct challenges remain superseded unless explicitly reopened.

## 14. Official data and final readiness

- [ ] Reverify official Euro 2028 regulations and best-third allocation.
- [ ] Load official qualifiers/draw assignments safely.
- [ ] Replace provisional dates, times and lock instant.
- [ ] Verify venue/team/player source metadata.
- [ ] Run complete multi-game dress rehearsal through the final.
- [ ] Run final security, accessibility, performance and documentation sweeps.
- [ ] Remove provisional/internal labels from public UI.

## Completed foundations

- [x] React/TypeScript/Vite/Supabase/Netlify application spine.
- [x] Original Predictor group/tie/third-place/bracket UI.
- [x] Leagues, H2H, matches, profile and points views.
- [x] Scoring authority alignment.
- [x] Application CI, disposable database parity and substantial Browser E2E.
- [x] Canonical predicted group ordering.
- [x] RPC-only submission and server-derived positions in contract 35.
- [x] Authoritative result lifecycle and bracket replay in contract 35.
- [x] Atomic bracket persistence and version-safe score clearing in contract 35.
- [x] Exact function allowlists and closed future defaults in contract 35.
- [x] Hosted development schema/history aligned through 35.
- [x] Netlify production/non-production Supabase isolation.
- [x] Fail-closed application/database deployment contract.
- [x] Node `22.22.2` alignment.
- [x] Fresh encrypted off-device production source artifact created.
- [x] `2026-07-25R` full repeat audit and authority-document reconciliation merged.
