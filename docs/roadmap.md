# Euro 2028 Predictor — Current Roadmap

**Status date:** 26 July 2026  
**Authority:** Future sequence only. Use `docs/quality/current-status.md` for current facts.

## Current position

Repository, development Supabase and all non-production Netlify contexts are verified at contract 36. The exact-head PR #105 preview passed release identity, HTTP smoke and anonymous browser smoke; CI run 582 and Browser E2E run 271 passed.

The final-target Supabase and Netlify production context remain a compatible, controlled contract-35 pair. They are not supporting a live tournament and were not changed during development promotion.

Completed foundations include:

- canonical TypeScript/PostgreSQL group ordering and manual tie decisions;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle/revisions and serialized scoring;
- predicted bracket replay and real winner propagation;
- atomic bracket persistence and version-safe score clearing;
- exact function allowlists;
- accepted backup/restore proof;
- contract-36 authoritative reference integrity in repository and development;
- exact-head contract-36 preview assurance on the current Netlify project.

## Stage 0 — Contract-35 hosted baseline: complete

Completed 25 July 2026:

1. encrypted off-device backup and clean restore proof;
2. canonical migration history through 35;
3. 63-check verifier and rollback-only smoke;
4. application/database compatibility and environment isolation;
5. controlled final-target baseline preserved.

## Stage 1 — Contract-36 development alignment and preview restoration: complete

Completed 26 July 2026:

1. restored and inspected development Supabase;
2. confirmed canonical history 1–35 before change;
3. proved six preflight groups contained no incompatible rows;
4. applied and verified canonical migration 36;
5. verified exact history, functions, triggers, privileges and rollback-only behaviour;
6. moved only dev/branch/preview Netlify declarations to 36;
7. restored exact-head preview release identity on `euro28predictor`;
8. passed HTTP/browser smoke and development-Supabase isolation;
9. made expected smoke contract explicit per target;
10. left the legacy World Cup site and final target untouched.

Evidence: `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md`.

## Stage 2 — Final-target contract-36 promotion

Current database gate:

1. inspect final-target migration/data state read-only;
2. preserve recoverable pre-change evidence;
3. establish migration 36 as the only canonical pending migration;
4. run all six fail-closed preflight checks;
5. prepare exact application, verification and rollback-safe smoke commands;
6. obtain explicit owner approval before any SQL;
7. apply and verify migration 36;
8. change production Netlify declaration to 36 only after database verification;
9. require exact-head production deploy, release identity, security headers, routes, assets and browser smoke;
10. restore exact-head production-smoke semantics;
11. record a dated final-target reconciliation.

No final-target contract lift occurs merely to unblock a build.

## Stage 3 — Production operations and security configuration

1. Review/fix `enforce_joker_rules` search path.
2. Review authenticated `SECURITY DEFINER` allowlist.
3. Evaluate missing FK indexes using representative queries.
4. Decide leaked-password protection.
5. Approve monitoring retention, privacy and alert recipients.
6. Verify non-production Sentry delivery with synthetic safe events.
7. Enable final-target reporting only by separate review.
8. Define critical-journey and database advisor cadence.
9. Rehearse compatible application rollback without changing Supabase.
10. Schedule fresh backups/off-site verification/disposable restore rehearsal.
11. Verify branch protection and required checks.
12. Resolve legacy environment and Turnstile/CAPTCHA decisions.

## Stage 4 — Original Predictor assurance gaps

1. Design safe authenticated final-target smoke that cannot damage retained predictions.
2. Verify score clear/reload, restore, stale conflict and post-lock refusal.
3. Verify multi-device bracket conflict/recovery.
4. Verify immediate final-edit submission settlement.
5. Repair frontend knockout-result consumption for authoritative winner/method/extra-time/penalties.
6. Close remaining `DATA-005`, `REL-007` and `TEST-001` scope from evidence.
7. Implement automatic valid-entry submission.
8. Add reminders after Auth/SMTP verification.

## Stage 5 — Real progression and administration

1. Rebase/fix draft PR #102 against current `main`, contract 36 and current preview host.
2. Define version-controlled administrator authorization/assignment.
3. Add independently authorized result confirm/correct/clear browser functions.
4. Require reasons and expose revision history safely.
5. Add desktop/mobile admin Browser E2E and hosted assignment proof.
6. Populate real R16 transactionally from confirmed standings and saved actual tie decisions.
7. Fail closed at unresolved best-third boundaries.
8. Never overwrite confirmed downstream results.
9. Add official draw/play-off team/fixture controls.

## Stage 6 — Browser E2E, accessibility and rehearsal

Retain/extend coverage for:

- auth/recovery/welcome;
- complete entry, ties, best thirds and bracket;
- save failure/conflict/lock paths;
- persisted score clear/restore/stale conflict;
- leagues/invites;
- regulation/extra-time/penalty result display;
- approved admin workflows;
- scoring/rank changes;
- mobile/accessibility transitions.

Complete manual screen-reader review and a seeded full tournament rehearsal through the final. Rehearse incident handling, backup/restore and application rollback.

## Stage 7 — Core experience expansion

After integrity/operations gates:

- complete other-player profiles and richer H2H;
- add rank-over-time and bracket health;
- expand Match Centre/tournament states;
- add account/privacy/contact-admin;
- add post-lock trends;
- improve invite trust and empty/error states;
- finish mobile/design/accessibility work;
- generate Supabase types and increase strictness;
- profile league/scoring performance.

Phone-first priorities remain rank/leagues first, Groups primary until real R16, and strict Original/bonus separation.

## Stage 8 — Bonus games

Launch scope remains:

1. KO Predictor;
2. Last Man Standing;
3. Predictor Cup.

Complete rules/design first, build isolated competition/window models, keep Original scoring/leagues separate, and include every mode in rehearsal. Sweepstake builder remains non-launch-blocking.

## Stage 9 — Official data and launch readiness

Before public launch:

- replace provisional teams, fixtures, dates/times and lock instant;
- reverify regulations/best-third allocation;
- verify Auth/SMTP/redirect/CAPTCHA dashboards;
- verify runtime contexts and branch protection;
- enable monitoring ownership;
- repeat recovery/rollback rehearsal;
- run security, accessibility, performance and full-competition rehearsal;
- remove provisional/internal public labels.

## Non-negotiable rules

- Original and bonus points/leagues never combine.
- Predicted and real brackets never blend.
- Database rules protect locks/scoring inputs.
- Submission waits for all current writes.
- Score clearing uses expected versions.
- Protected RPCs never gain unsafe direct-table fallbacks.
- Public function execution is closed by default.
- No hosted migration without approval/evidence.
- No final-target-to-development fallback.
- No contract lift before database verification.
- No current-project use of the legacy World Cup site.
- Smoke commands declare the target contract explicitly.
- Roadmap/gallery content is not implementation evidence.
- Future official facts remain provisional until authoritative verification.
