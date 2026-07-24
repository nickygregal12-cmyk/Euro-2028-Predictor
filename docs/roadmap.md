# Euro 2028 Predictor — Current Roadmap

**Status date:** 24 July 2026  
**Authority:** Future product sequence only. For current implementation and hosted state, use `docs/quality/current-status.md`.

The previous long-form roadmap predates the repository integrity work and hosted inspection. Its detail remains in Git history but is not the current work order.

## Current position

The application is live at `euro28predictor.com` and `euro28predictor.netlify.app`. DNS is not an open item.

Repository and hosted-development work has completed:

- canonical TypeScript/PostgreSQL predicted group ordering;
- manual group and best-third tie decisions;
- RPC-only submission and server-derived positions;
- authoritative result lifecycle and revisions;
- serialized scoring;
- predicted bracket replay and real winner propagation;
- atomic complete-bracket replacement;
- exact function allowlists, no anonymous execution and owner-only future defaults;
- manual-submission settlement across every prediction write key;
- version-safe persisted score clearing with derived-position invalidation;
- application CI and disposable database parity CI;
- hosted development rehearsal through migration 35 using the normalized production entry.

Production Supabase remains on the original 20-migration schema while the deployed client includes PR #14. The roadmap starts with release recovery, not feature expansion.

## Stage 0 — Restore a compatible production release

**Hard gate before ordinary production promotion.**

Completed preparation:

1. the normalized production entry passed migrations 21–35 on hosted development;
2. production migrations 1–20 structural effects were independently proven;
3. the exact 1–20 history-only repair is documented;
4. production source preflights and post-rollout verification are committed;
5. migration 34 repairs function grants/search paths;
6. migration 35 adds protected persisted score clearing;
7. pending-write submission and deletion ordering are protected in code and tests.

Remaining execution:

1. obtain verified production backup/recovery evidence;
2. name the operator, recovery decision owner and change window;
3. rerun both production preflights;
4. apply the 1–20 metadata-only history repair;
5. require `db push --dry-run` to show migrations 21–35 only;
6. obtain explicit approval and apply the complete chain in timestamp order;
7. verify bracket save/reload, authenticated RPCs, results/scoring and exact function allowlists;
8. browser-verify immediate final-edit submission plus error/conflict blocking;
9. browser-verify score clear/reload, restore, stale conflict and post-lock refusal;
10. record the exact deployed app/schema pair and evidence.

Never point production at development Supabase and never apply migration 33, 34 or 35 alone.

## Stage 1 — Hosted operations and security configuration

1. Isolate production Netlify previews and branch deploys from production Supabase (`OPS-007`).
2. Enable leaked-password protection through a separate approved Auth change.
3. Rerun production security advisors after migrations 21–35:
   - no anonymous security-definer exposure;
   - no mutable search paths;
   - only intentional signed-in application RPC warnings.
4. Establish verified backup and restore procedures.
5. Add production error reporting, alert ownership and critical-journey monitoring.
6. Verify Netlify runtime pinning, branch protection and required checks.

## Stage 2 — Close Original Predictor reliability gaps

1. `REL-003`: repository/development complete; close after compatible-production browser and durable E2E verification.
2. `DATA-005`: repository/development complete; close after production clear/reload/conflict/lock browser and durable E2E verification.
3. `REL-002`: prevent independent late reads from overwriting newer state.
4. `REL-006`: make first-entry creation idempotent under two-tab races.
5. Finish wider same-tournament and immutable fixture/source constraints.
6. Map raw internal failures to stable user-facing errors.
7. Implement automatic deadline submission for valid entries.
8. Add reminder emails after Auth/SMTP verification.

## Stage 3 — Complete real tournament progression and administration

1. Populate the real Round of 16 transactionally from confirmed standings, authoritative best-third ranking and saved actual tie decisions.
2. Fail closed at unresolved fourth/fifth best-third boundaries.
3. Never overwrite a confirmed downstream result.
4. Add an authenticated server-side result-entry administration route or controlled adapter.
5. Add correction/clear UI, revision history and mandatory reason capture.
6. Add team/fixture assignment controls for the official draw and play-offs.

## Stage 4 — Browser E2E and operational rehearsal

Add Playwright or equivalent critical journeys for:

- signup/login/password recovery;
- first-use welcome;
- complete group entry, ties, best thirds and bracket;
- immediate final-edit submission, save failure and conflict paths;
- persisted score clear/reload, restore, stale conflict and post-lock refusal;
- private league create/join/invite;
- result confirm/correct/clear through the approved admin boundary;
- scoring/rank changes;
- production-like mobile and accessibility transitions.

Run a seeded full tournament rehearsal through pre-tournament, group days, end of groups, every knockout round and final completion. Rehearse backup, restore and incident handling rather than documenting them only.

## Stage 5 — Core experience expansion

After integrity/rehearsal gates:

- complete other-player profiles and richer H2H;
- rank-over-time and bracket-health views;
- expanded Match Centre and tournament states;
- account/privacy/contact-admin surfaces;
- post-lock prediction trends;
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
- prove backup and restore;
- run security, accessibility, performance and full competition rehearsals;
- remove internal/provisional labels from public UI and docs.

## Non-negotiable rules

- Original Predictor and bonus competition points never combine.
- Predicted and real brackets never blend.
- Database rules, not UI state, protect locks and scoring inputs.
- Manual submission waits for all current prediction writes to settle successfully.
- Clearing a persisted score uses an expected-version server boundary; stale devices cannot delete newer work.
- Public function execution is closed by default; every browser/service RPC requires an explicit reviewed grant.
- No hosted migration without explicit approval and evidence.
- No production-to-development rollback.
- No feature is implemented because it appears only in a roadmap or gallery.
- Future official facts remain provisional until verified from UEFA or another authoritative source.
