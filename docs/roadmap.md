# Euro 2028 Predictor — Current Roadmap

**Status date:** 23 July 2026  
**Authority:** Future product sequence only. For current implementation and hosted state, use `docs/quality/current-status.md`.

The previous long-form roadmap described the position before the repository integrity PRs and before direct hosted inspection. Its detail remains available in Git history at audited commit `51d8ac6`, but it is no longer an accurate work order.

## Current position

The application is live at `euro28predictor.com` and `euro28predictor.netlify.app`. DNS is no longer an open work item.

Repository/local database work has completed:

- canonical TypeScript/PostgreSQL predicted group ordering;
- manual group and best-third tie decisions;
- RPC-only submission and server-derived predicted group positions;
- authoritative result lifecycle and revisions;
- serialized scoring recomputation;
- predicted bracket-tree replay and real winner propagation;
- atomic complete-bracket replacement;
- application CI and disposable database parity CI.

However, both hosted Supabase projects remain on the original 20-migration schema while the production client is deployed at PR #14. The roadmap therefore starts with release recovery, not new feature expansion.

## Stage 0 — Restore a compatible production release

**Hard gate before ordinary production promotion.**

1. Freeze non-recovery production deployment.
2. Choose a reviewed compatibility path:
   - temporarily restore a known-good application compatible with the 20-migration schema; or
   - stage and verify migrations 21–33 through development and then production.
3. Never point production at development Supabase.
4. Verify bracket save/reload against the chosen compatible pair.
5. Record the recovery decision and exact deployed app/schema versions.

## Stage 1 — Hosted integrity rollout

1. Isolate Netlify production deploy previews and branch deploys from production Supabase.
2. Review Supabase security-advisor findings:
   - revoke unnecessary browser execution of internal, trigger and maintenance `SECURITY DEFINER` functions;
   - fix mutable search paths;
   - review leaked-password protection.
3. Resolve development blockers:
   - 20 submitted entries use the legacy 16-row progression representation;
   - 12 matches contain old results;
   - decide reset versus deliberate remediation.
4. Run exact preflights for migrations 21–33.
5. Apply and verify development first.
6. Produce production backup/recovery evidence and a reviewed rollout plan.
7. Apply production only after explicit approval.
8. Verify policies, grants, RPCs, result lifecycle, scoring, winner propagation and atomic bracket persistence through real hosted behavior.

## Stage 2 — Close Original Predictor reliability gaps

1. `REL-003`: flush or await all pending score, tie, bracket and bonus writes before manual submission.
2. `DATA-005`: define and implement persisted score-clearing behavior.
3. `REL-002`: prevent independent late reads from overwriting newer state.
4. `REL-006`: make first-entry creation idempotent under two-tab races.
5. Finish wider same-tournament and immutable fixture/source constraints.
6. Implement automatic deadline submission for valid entries.
7. Add deadline reminder emails after Auth/SMTP configuration is re-verified.

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
- pending-write submission behavior;
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
- No hosted migration without explicit approval and evidence.
- No production-to-development rollback.
- No feature is “implemented” because it exists only in this roadmap or a component gallery.
- Official future facts remain provisional until verified from UEFA or another authoritative source.
