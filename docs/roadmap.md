# Euro 2028 Predictor — Current Roadmap

**Status date:** 26 July 2026  
**Authority:** Future product sequence only. For current implementation and hosted state, use `docs/quality/current-status.md`.

The previous long-form roadmap predates the repository integrity and hosted contract work. Its detail remains in Git history but is not the current execution order.

## Current position

The repository is at contract 36:

- migration 36 is merged through PR #76;
- the repository contains exactly 36 migrations;
- disposable CI, database parity and Browser E2E passed;
- PR #101 merged the contract-36 repository reconciliation;
- issue #72 (`DATA-003`) is closed as repository implementation complete.

Hosted environments remain at their last verified contract-35 evidence point:

- development Supabase `iouzoutneyjpugbbtdem` — contract 35;
- final-target Supabase `vkfnsqdyhvtwyqkisxhk` — contract 35;
- final-target Netlify declaration — contract 35.

The Netlify context historically named `production` is the controlled final-target environment. It is not supporting a live Euro 2028 tournament.

The application/schema compatibility gate is working correctly: contract-36 application builds must not deploy against a contract-35 hosted database.

Completed foundations include:

- canonical TypeScript/PostgreSQL predicted group ordering;
- manual group and best-third tie decisions;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle and revisions;
- serialized scoring;
- predicted bracket replay and real winner propagation;
- atomic complete-bracket replacement;
- exact function allowlists and zero anonymous application execution;
- manual-submission settlement across prediction write keys;
- version-safe persisted score clearing and derived-position invalidation;
- accepted encrypted backup and corrected clean restore proof;
- contract-36 same-tournament/reference integrity in the repository.

## Stage 0 — Contract-35 hosted baseline: complete

Completed on 25 July 2026:

1. accepted encrypted off-device backup and clean restore proof;
2. proved and repaired the hosted migration-history baseline where required;
3. applied and verified migrations through 35;
4. passed the 63-check verifier and rollback-only smoke;
5. verified application/database compatibility and environment isolation;
6. preserved the final-target environment as a controlled, non-live tournament target.

Historical evidence is recorded in `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`.

## Stage 1 — Contract-36 development alignment and preview restoration

1. Inspect development Supabase read-only.
2. Require a dry run showing only migration 36.
3. Apply migration 36 to development and verify all six guarded relationship areas.
4. Update preview/branch/dev contract declarations to 36 only after database verification.
5. Restore exact-head deploy previews on the current `euro28predictor` Netlify project.
6. Update release-identity smoke expectations to contract 36.
7. Verify HTTP/browser smoke and development-Supabase isolation.
8. Never use the legacy `euro28-predictor-dev` World Cup deployment as a preview target.

## Stage 2 — Final-target contract-36 upgrade

After development and preview evidence are accepted:

1. inspect final-target state read-only;
2. preserve recoverable pre-change evidence;
3. require a dry run showing only migration 36;
4. obtain explicit owner approval;
5. apply and verify migration 36;
6. change the final-target Netlify declaration from 35 to 36;
7. verify release identity, security headers, routes, assets and environment isolation;
8. record a dated final-target reconciliation.

No final-target contract lift occurs merely to unblock a build.

## Stage 3 — Production operations and security configuration

1. Approve monitoring retention, privacy and alert recipients.
2. Verify non-production Sentry delivery with synthetic non-sensitive events.
3. Enable final-target reporting only through a separate reviewed configuration action.
4. Define critical-journey monitoring and database health/advisor review cadence.
5. Rehearse a compatible Netlify application rollback without changing final-target Supabase.
6. Schedule periodic fresh backups, off-site verification and disposable restore rehearsal.
7. Verify GitHub branch protection and required checks.
8. Resolve the separate legacy `euro28-predictor-dev` owner decision.
9. Approve and verify the production/non-production Turnstile and development CAPTCHA model.
10. Review leaked-password protection as a separate Auth change.

## Stage 4 — Complete Original Predictor assurance gaps

1. Design a safe authenticated final-target smoke strategy that cannot damage retained predictions.
2. Verify score clear/reload, restore, stale conflict and post-lock refusal in a browser.
3. Verify multi-device bracket conflict/recovery.
4. Verify immediate final-edit submission settlement.
5. Repair frontend knockout-result consumption so Match Centre and H2H use authoritative winner/method/extra-time/penalty data.
6. Decide final closure of `DATA-005`, `REL-007` and remaining `TEST-001` scope from evidence.
7. Implement automatic valid-entry submission at deadline.
8. Add reminder emails after Auth/SMTP verification.

## Stage 5 — Complete real tournament progression and administration

1. Define a version-controlled administrator authorization and assignment model.
2. Treat draft PR #102 as a read-only UI/access foundation until server-authorized writes exist.
3. Add independently authorized result confirm/correct/clear functions for browser administration.
4. Add mandatory correction/clear reasons and safe revision-history access.
5. Add desktop/mobile Browser E2E for administrator journeys.
6. Populate the real Round of 16 transactionally from confirmed standings, authoritative best-third ranking and saved actual tie decisions.
7. Fail closed at unresolved fourth/fifth best-third boundaries.
8. Never overwrite a confirmed downstream result.
9. Add team/fixture assignment controls for the official draw and play-offs.

## Stage 6 — Browser E2E, accessibility and operational rehearsal

Retain and extend Browser E2E for:

- signup/login/password recovery;
- first-use welcome;
- complete group entry, ties, best thirds and bracket;
- immediate final-edit submission, save failure and conflict paths;
- persisted score clear/reload, restore, stale conflict and post-lock refusal;
- private league create/join/invite;
- regulation, extra-time and penalty result display;
- result confirm/correct/clear through the approved admin boundary;
- scoring/rank changes;
- production-like mobile and accessibility transitions.

Complete manual screen-reader review. Run a seeded full tournament rehearsal through pre-tournament, group days, end of groups, every knockout round and final completion. Rehearse backup, restore, application rollback and incident handling rather than documenting them only.

## Stage 7 — Core experience expansion

After operations and integrity gates:

- complete other-player profiles and richer H2H;
- add rank-over-time and bracket-health views;
- expand Match Centre and tournament states;
- add account/privacy/contact-admin surfaces;
- add post-lock prediction trends;
- improve trustworthy invite context before auth;
- finish unavailable/error/empty-state repairs;
- complete mobile physics, accessibility and funnel improvements;
- complete the final design-system consistency pass;
- generate Supabase types and increase TypeScript strictness around critical boundaries;
- profile league and scoring performance at representative scale.

The first phone viewport remains focused on rank and leagues. Groups remain primary until the real R16 is ready. Original Predictor and bonus modes remain visually and logically separate.

## Stage 8 — Bonus games launch scope

The established launch-scope games remain:

1. KO Predictor;
2. Last Man Standing;
3. Predictor Cup.

Before implementation:

- complete a dedicated rules/design pass for each;
- build the shared optional-competition/window model;
- keep Original Predictor scoring and leagues separate;
- share knockout-prediction storage only where rules require it;
- add each game’s administration with its schema;
- include every launch game in the full dress rehearsal.

The Sweepstake builder remains non-launch-blocking.

## Stage 9 — Official data and launch readiness

Before public tournament launch:

- replace provisional teams, fixtures, dates/times and lock instant with official data;
- reverify final Euro 2028 regulations, especially best-third allocation;
- verify Auth confirmation, SMTP, redirects and CAPTCHA dashboards;
- verify Netlify runtime, environment contexts and branch protection;
- enable monitoring and alert ownership;
- repeat backup/restore and application rollback rehearsal;
- run security, accessibility, performance and full competition rehearsals;
- remove internal/provisional labels from public UI and current docs.

## Non-negotiable rules

- Original Predictor and bonus competition points never combine.
- Predicted and real brackets never blend.
- Database rules, not UI state, protect locks and scoring inputs.
- Manual submission waits for all current prediction writes to settle successfully.
- Clearing a persisted score uses an expected-version server boundary; stale devices cannot delete newer work.
- Protected RPCs are never replaced by unsafe direct-table fallbacks.
- Public function execution is closed by default; every browser/service RPC requires an explicit reviewed grant.
- No hosted migration without explicit approval and evidence.
- No final-target-to-development rollback.
- No contract lift before the target database is migrated and verified.
- No current-project use of the legacy World Cup Netlify site.
- No feature is implemented because it appears only in a roadmap or gallery.
- Future official facts remain provisional until verified from UEFA or another authoritative source.
