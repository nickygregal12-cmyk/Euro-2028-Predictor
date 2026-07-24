# Euro 2028 Predictor — Current Roadmap

**Status date:** 24 July 2026  
**Authority:** Future product sequence only. For current implementation and hosted state, use `docs/quality/current-status.md`.

The previous long-form roadmap described the position before the repository integrity PRs and direct hosted inspection. Its detail remains available in Git history, but it is no longer an accurate work order.

## Current position

The application is live at `euro28predictor.com` and `euro28predictor.netlify.app`. DNS is no longer an open work item.

Repository and hosted-development work has completed:

- canonical TypeScript/PostgreSQL predicted group ordering;
- manual group and best-third tie decisions;
- RPC-only submission and server-derived predicted group positions;
- authoritative result lifecycle and revisions;
- serialized scoring recomputation;
- predicted bracket-tree replay and real winner propagation;
- atomic complete-bracket replacement;
- exact authenticated/service function allowlists, no anonymous function execution and owner-only future defaults;
- manual-submission save barrier that flushes score/bracket debounces and waits for all prediction writes;
- application CI and disposable database parity CI;
- hosted development rehearsal through migration 34 using the exact normalized production entry.

Production Supabase remains on the original 20-migration schema while the production client is deployed at PR #14. The roadmap therefore starts with release recovery, not new feature expansion.

## Stage 0 — Restore a compatible production release

**Hard gate before ordinary production promotion.**

Completed preparation:

1. the exact production entry passed migrations 21–34 on hosted development;
2. production migrations 1–20 structural effects were independently proven;
3. the exact 1–20 history-only repair is documented;
4. production source-data preflights and post-rollout verification are committed;
5. migration 34 repairs function grants/search paths as the final pending database file;
6. pending-write manual submission is protected in repository code and tests.

Remaining execution:

1. obtain verified production backup/recovery evidence;
2. name the operator, recovery decision owner and change window;
3. rerun both production preflights;
4. apply the 1–20 metadata-only history repair;
5. require `db push --dry-run` to show migrations 21–34 only;
6. obtain explicit approval and apply the complete chain in timestamp order;
7. verify bracket save/reload, authenticated RPCs, result/scoring boundaries and exact function allowlists;
8. browser-verify immediate submission after the final score/bracket/tie/bonus edit and failure/conflict blocking;
9. record the exact deployed app/schema pair and retained evidence.

Never point production at development Supabase and never apply migration 33 or 34 alone.

## Stage 1 — Finish hosted operations and security configuration

1. Isolate Netlify production deploy previews and branch deploys from production Supabase (`OPS-007`).
2. Enable leaked-password protection through a separately reviewed Auth configuration change.
3. Re-run production security advisors after migration 34:
   - require no anonymous security-definer exposure;
   - require no mutable search paths;
   - retain only the intentional signed-in application RPC warnings.
4. Establish verified production backup and restore procedures.
5. Add production error reporting, alert ownership and critical-journey monitoring.
6. Verify Netlify runtime pinning, branch protection and required checks.

## Stage 2 — Close Original Predictor reliability gaps

1. `REL-003`: repository implementation and tests are complete; close only after compatible-production browser verification and durable E2E coverage.
2. `DATA-005`: define and implement persisted score-clearing behavior.
3. `REL-002`: prevent independent late reads from overwriting newer state.
4. `REL-006`: make first-entry creation idempotent under two-tab races.
5. Finish wider same-tournament and immutable fixture/source constraints.
6. Map raw internal failures to stable user-facing errors.
7. Implement automatic deadline submission for valid entries.
8. Add deadline reminder emails after Auth/SMTP configuration is re-verified.

## Stage 3 — Complete real tournament progression and administration

1. Populate the real Round of 16 transactionally from:
   - confirmed group standings;
   - authoritative best-third ranking;
   - exact saved real tie decisions where score criteria cannot separate teams.
2. Fail closed at unresolved fourth/fifth best-third boundaries.
3. Never overwrite a confirmed downstream result.
4. Add an authenticated server-side result-entry administration route or controlled adapter.
5. Add correction/clear flows, audit history and explicit reason capture in the admin interface.
6. Add team/fixture assignment controls for the official draw and play-offs.

## Stage 4 — Browser E2E and operational rehearsal

Add Playwright or equivalent critical journeys for:

- sign-up/login/password recovery;
- first-use welcome;
- complete group entry, ties, best thirds and bracket;
- pending-write submission after immediate final edits, including failure and conflict paths;
- private league create/join/invite;
- result confirm/correct/clear through the approved admin boundary;
- scoring and rank changes;
- production-like mobile layouts and accessibility transitions.

Run a full seeded tournament rehearsal through pre-tournament, group days, end of groups, every knockout round and final completion. Rehearse backup, restore and incident handling rather than documenting them only.

## Stage 5 — Core experience expansion

After the integrity/rehearsal gates:

- complete other-player profiles and richer H2H;
- rank-over-time and bracket-health views;
- expanded match centre and tournament-context states;
- account/privacy/contact-admin surfaces;
- prediction trends after lock;
- mobile physics, accessibility and funnel improvements from the design audit;
- final component/design-system consistency pass.

The first phone viewport remains focused on rank and leagues. Groups remain the primary navigation focus until the real R16 is ready. Original Predictor and any bonus mode remain visually and logically separate.

## Stage 6 — Bonus games launch scope

The established launch-scope bonus games remain:

1. KO Predictor;
2. Last Man Standing;
3. Predictor Cup.

Before implementation:

- complete a dedicated design/rules pass for each;
- build the shared optional-competition platform and competition-window model;
- keep Original Predictor scoring and leagues separate;
- share a knockout-prediction store only where the competition rules explicitly require it;
- add each game's admin controls with its schema;
- include every launch game in the full dress rehearsal.

The Sweepstake builder remains non-launch-blocking and must not delay the three established games.

## Stage 7 — Official-data and launch readiness

Before public tournament launch:

- replace provisional teams, fixtures, dates/times and lock instant with official data;
- re-verify final Euro 2028 regulations, especially best-third rules/allocation;
- verify Auth email confirmation, SMTP, redirect URLs and CAPTCHA dashboards;
- verify Netlify runtime, environment contexts and branch protection/required checks;
- enable monitoring/alert ownership;
- prove backup and restore;
- run security, accessibility, performance and full competition dress rehearsals;
- remove internal/provisional labels from public UI and docs.

## Non-negotiable rules

- Original Predictor and bonus competition points never combine.
- Predicted and real brackets never blend.
- Database rules, not UI state, protect locks and scoring inputs.
- Manual submission never crosses the server validator until current prediction writes settle successfully.
- Public function execution is closed by default; every browser/service RPC requires an explicit reviewed grant.
- No hosted migration without explicit approval and evidence.
- No production-to-development rollback.
- No feature is “implemented” because it exists only in this roadmap or a component gallery.
- Official future facts remain provisional until verified from UEFA or another authoritative source.