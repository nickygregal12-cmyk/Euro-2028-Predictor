# Euro 2028 Predictor — Current Roadmap

**Status date:** 25 July 2026  
**Authority:** Future product sequence only. For current implementation and hosted state, use `docs/quality/current-status.md`.

The previous long-form roadmap predates the repository integrity work and hosted inspection. Its detail remains in Git history but is not the current work order.

## Current position

The application is live at `euro28predictor.com` and `euro28predictor.netlify.app`.

Repository, development and production are aligned at contract 35. The completed production pair is:

- source commit `902a37aa6c50c967f8080d751147a5733b251fe3`;
- Netlify deploy `6a652c3d3416d26d595ae2ef`;
- production Supabase `vkfnsqdyhvtwyqkisxhk`;
- exactly migrations 1–35;
- zero pending migrations through 35.

The former bracket/score-clear RPC mismatch is resolved. The production verifier, rollback-only database smoke and anonymous live application checks passed. Migration 36 remains draft-only in PR #76.

Completed contract-35 capabilities include:

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
- compatible production application/database promotion.

The roadmap now starts with operational readiness rather than compatibility recovery.

## Stage 0 — Contract-35 production recovery and promotion: complete

Completed on 25 July 2026:

1. accepted encrypted off-device backup and clean restore proof;
2. proved production migration 1–20 effects;
3. repaired exactly versions 1–20 as metadata;
4. dry-ran and applied exactly migrations 21–35;
5. passed the 63-check verifier, advisors and rollback-only smoke;
6. verified zero pending migrations and unchanged source fingerprints;
7. changed only production Netlify contract 20 → 35;
8. published the approved source commit;
9. verified metadata, security headers, routes, assets and environment isolation;
10. kept migration 36 and PR #76 outside the operation.

Historical evidence is recorded in `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`.

## Stage 1 — Production operations and security configuration

1. Add production error reporting and alert ownership.
2. Define critical-journey monitoring and database health/advisor review cadence.
3. Rehearse a compatible Netlify application rollback without changing production Supabase.
4. Schedule periodic fresh backups, off-site verification and disposable restore rehearsal.
5. Verify GitHub branch protection and required checks.
6. Resolve the separate legacy `euro28-predictor-dev` owner decision.
7. Approve and verify the production/non-production Turnstile and development CAPTCHA model.
8. Review leaked-password protection as a separate Auth change.
9. Retain the app/schema compatibility gate for every future migration.

## Stage 2 — Close remaining Original Predictor assurance gaps

1. Design a safe authenticated production smoke strategy that cannot damage retained user predictions.
2. Verify production score clear/reload, restore, stale conflict and post-lock refusal in a browser.
3. Verify production multi-device bracket conflict/recovery.
4. Verify immediate final-edit submission settlement in production.
5. Decide final closure of `DATA-005`, `REL-007` and remaining `TEST-001` scope from evidence.
6. Finish wider same-tournament and immutable fixture/source constraints.
7. Implement automatic valid-entry submission at deadline.
8. Add reminder emails after Auth/SMTP verification.

## Stage 3 — Complete real tournament progression and administration

1. Populate the real Round of 16 transactionally from confirmed standings, authoritative best-third ranking and saved actual tie decisions.
2. Fail closed at unresolved fourth/fifth best-third boundaries.
3. Never overwrite a confirmed downstream result.
4. Define a version-controlled administrator authorization model.
5. Add an authenticated server-side/browser result-entry route or controlled adapter.
6. Add correction/clear UI, revision history and mandatory reason capture.
7. Add team/fixture assignment controls for the official draw and play-offs.
8. Review PR #76/migration 36 separately; do not treat prior green CI as production approval.

## Stage 4 — Browser E2E, accessibility and operational rehearsal

Retain and extend Browser E2E for:

- signup/login/password recovery;
- first-use welcome;
- complete group entry, ties, best thirds and bracket;
- immediate final-edit submission, save failure and conflict paths;
- persisted score clear/reload, restore, stale conflict and post-lock refusal;
- private league create/join/invite;
- result confirm/correct/clear through the approved admin boundary;
- scoring/rank changes;
- production-like mobile and accessibility transitions.

Complete manual screen-reader review. Run a seeded full tournament rehearsal through pre-tournament, group days, end of groups, every knockout round and final completion. Rehearse backup, restore, application rollback and incident handling rather than documenting them only.

## Stage 5 — Core experience expansion

After operations/integrity gates:

- complete other-player profiles and richer H2H;
- rank-over-time and bracket-health views;
- expanded Match Centre and tournament states;
- account/privacy/contact-admin surfaces;
- post-lock prediction trends;
- privacy-reviewed trustworthy invite context before auth;
- remaining unavailable/error/empty data-state repairs;
- mobile physics, accessibility and funnel improvements;
- final design-system consistency pass.

The first phone viewport remains focused on rank and leagues. Groups remain primary until the real R16 is ready. Original Predictor and bonus modes remain visually and logically separate.

## Stage 6 — Bonus games launch scope

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

## Stage 7 — Official data and launch readiness

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
- No production-to-development rollback.
- No contract lift before the target database is migrated and verified.
- No feature is implemented because it appears only in a roadmap or gallery.
- Future official facts remain provisional until verified from UEFA or another authoritative source.