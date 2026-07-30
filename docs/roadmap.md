# Multi-competition platform — roadmap

**Status date:** 29 July 2026  
**Authority:** The only live execution sequence. Current facts live in [`quality/current-status.md`](quality/current-status.md); detailed active and parked inventory lives in [`../MASTER-TODO.md`](../MASTER-TODO.md).  
**Programme map:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).  
**Decision authority:** [`adr/0011-multi-competition-platform.md`](adr/0011-multi-competition-platform.md) through [`adr/0018-pre-launch-promotion-cadence.md`](adr/0018-pre-launch-promotion-cadence.md).

The Stage A–L programme supersedes the old single-destination sequence. No delivered item has been discarded: the completed Euro 2028 work below is the platform's first competition baseline, and every remaining Euro-specific item is preserved in the parked inventory for the January 2028 return.

## Delivered foundation carried into the platform

### Former Stage 0 — release and control foundation: complete

- branch/PR/CI discipline and deployment-contract guards;
- encrypted production backup and disposable restore rehearsal;
- milestone-only production promotion and exact-head smoke;
- administrator authorisation and protected application routes.

### Former Stage 1 — result and qualification control: complete

- result confirm, correct and clear with required review/reasons;
- immutable revisions and regulation/extra-time/penalty handling;
- actual group standings, best-thirds and Round-of-16 population;
- authorised exact-boundary tie resolution and transactional bracket replay;
- authorised/unauthorised desktop and mobile Browser E2E.

### Former Stage 2 — full tournament lifecycle: complete

- seeded complete 51-match tournament journey;
- valid/incomplete entries, predicted tables/brackets, lock and submission;
- automatic valid-entry submission at lock using the authoritative validator;
- all group and knockout results, corrections, clears and downstream replay;
- scoring recomputation, rank history, champion and revision evidence;
- clean canonical rebuild, pgTAP and authenticated browser reset journeys.

### Former Stage 3 — capacity, bounded reads and comparison surfaces: complete

- server-ranked keyset pagination for overall and private-league standings;
- independent caller context and bounded owner transfer search;
- operating-cap enforcement at signup and league creation;
- representative 250-entry and 250-member evidence;
- secure co-member profiles with pre/post-lock reveal boundaries;
- resilient own Profile/H2H, authoritative totals, rank history and bracket health.

### Former Stage 4 — core product experience: complete first production cut

Delivered through PRs #162 and #165–#178:

- resilient Match Centre states and deterministic fixture switching;
- Predict hero/journey map, 51-pick completion and always-forward stage flow;
- truthful Matches list states;
- private Account page for display name, password, email, reminders and sign-out;
- privacy/reveal explanation and configuration-driven Contact admin;
- race-safe pre-lock Original entry clearing that preserves accounts, leagues and Bonus Games;
- automated axe WCAG 2.2 AA coverage across key desktop/phone routes;
- Matches tournament-information sub-views for group tables, best thirds, authoritative knockout bracket and result-derived statistics.

The principal prediction, match, profile, comparison, Account and tournament-information journeys are implemented at the tagged contract-63 Euro baseline.

### Former Stage 5 — Bonus Games: complete tournament implementation

ADR 0010 B1–B7c is delivered for the tournament baseline:

1. **Platform:** competition lifecycle resolver, deny-all storage, bounded hub, voluntary registration/withdrawal and audit.
2. **Shared knockout store:** one versioned prediction per user/per knockout match with per-kickoff locking.
3. **KO Predictor:** its tournament scoring, rolling-entry banking and server-ranked standings.
4. **Last Man Standing:** tournament survival, one-use teams, deadline locking, correction re-derivation and wipeout handling.
5. **Predictor Cup:** deterministic groups, qualification, wildcards, seeding, playoff/byes, bracket, Penalty Numbers, settlement, champion and Golden Predictor.

Contracts 59–60 removed temporary-table implementation dependencies without changing rules or privileges. The visible cut includes More → Bonus Games navigation, the three-game catalogue and repeatable publication of competition/window/fixture reference data. Registration remained deliberately closed at the recorded baseline.

### Former Stage 6 — post-lock product experience: delivered core, residual work re-sequenced

Delivered at the tagged baseline:

- post-lock prediction consensus/trends;
- richer locked My Entry and reveal state;
- final authoritative standings and tie-break explanation;
- deterministic final ranking under equal-points cases;
- continued separation between Original and Bonus Games standings.

Residual former Stage 6 items are preserved below:

- loading, empty, partial and retry states move to **Stage H**;
- secondary comparison/loading/error states move to **Stage H**;
- manual keyboard/screen-reader/contrast review moves to **Stage J**;
- Predicted/Live table switching, mid-groups bracket projection and feed-gated top scorers remain **parked for Stage L**.

## Stage A — decisions, documentation and controls: current

- land ADRs 0011–0018 and keep ADR 0010 as the tournament Bonus Games authority;
- add the programme map and reframe roadmap, status, agent instructions and detailed TODO;
- reconcile `architecture-and-tournament-states.md` with ADRs 0011–0013;
- broaden Database parity triggering to all `src/domain/**` changes and record the control gap;
- reconcile stale live authorities without editing historical evidence;
- complete the brand-clearance work governed by ADR 0017;
- retain every superseded document under the governed history directories.

**Exit:** future agents no longer assume a single tournament, the architecture agrees with the ADRs, and every applicable gate actually triggers.

## Stage B — competition-context foundation and surface migration: current

The isolated pure foundation is the first deliverable. It does not change rendered behaviour.

Remaining sequence:

1. land the pure engine and deterministic fake-clock suite;
2. migrate `entryLock.ts` through a behaviour-preserving adapter and differential test;
3. migrate `matchCentre.ts`;
4. migrate `matchesTab.ts`;
5. migrate `homeDashboard.ts`;
6. remove duplicated timing authority only after all consumers are proven equivalent.

The implementation contract is [ADR 0011](adr/0011-multi-competition-platform.md) plus [`architecture-and-tournament-states.md`](architecture-and-tournament-states.md).

## Stage C — competition and season schema

- represent competitions and seasons without weakening existing same-reference safeguards;
- preserve independent entries, standings, honours and history;
- settle deletion/anonymisation, season tie-break and timezone consequences before dependent data exists;
- extend canonical applied-state and environment-parity checks with the schema;
- use append-only migrations and milestone-only hosted promotion.

## Stage D — fixture and result ingestion

- implement provider adapters behind one provisional internal model;
- record raw responses from the first poll;
- prove idempotency, correction replay, time changes, postponement, abandonment, cancellation/void semantics and stale-data failure;
- retain human confirmation as the official-result gate;
- run the headless rehearsal before inviting the closed cohort.

## Stage E — season Predictor

Build and prove the season Predictor under [ADR 0012](adr/0012-season-predictor-rules.md), including recurring lock/submission cadence, parity coverage, full-season replay and phone-first completion evidence.

## Stage F — season Last Man Standing

Build and prove the season Last Man Standing competition under [ADR 0013](adr/0013-last-man-standing-season-rules.md), including adversarial lifecycle, exception, managed-entry and abuse paths.

## Stage G — season Predictor Cup

Re-plumb the existing Cup machinery to the season source and formats governed by [ADR 0014](adr/0014-predictor-cup-season-formats.md).

## Stage H — hub and social product

- cross-competition dashboard and consolidated weekly actions;
- preferences that shape prominence without changing entry;
- invitations, rerun/copy, managed entrants and sharing;
- trustworthy pre-auth invite context and aggregate-disclosure review;
- loading, empty, unavailable, retry and hostile-data states;
- landing/acquisition surfaces, legal/footer content, account deletion/export and analytics decisions;
- live match strip, season table experiences and remaining profile/H2H extensions where still evidenced.

Commercial/social boundaries are governed by [ADR 0015](adr/0015-commercial-and-social-model.md).

## Stage I — PWA, notifications and native distribution

Deliver the PWA and native-shell sequence governed by [ADR 0016](adr/0016-client-and-distribution.md), including reminder reliability, push, deep links, authentication round-trip, offline locked-entry reading and web-first rollback.

## Stage J — public-launch readiness

Preserved former Stage 7/8 operational items that are platform-wide:

- complete-volume recomputation, correction and rollback measurement;
- application rollback rehearsal and current backup restore repeat;
- monitoring, backup, Cron and incident ownership;
- Auth/SMTP ownership and reminder-delivery reliability;
- final Turnstile and leaked-password decisions;
- official support/administrator ownership;
- branch protection and required-check verification;
- final security, accessibility and phone-first product sweep;
- load/concurrency and service-ceiling proof;
- release controls, legal/privacy and operational runbooks.

## Stage K — public domestic-season operation

Operate the platform, keep current facts in `quality/current-status.md`, and use dated evidence for incidents, releases and hosted verification.

## Stage L — Euro 2028 return: January 2028

Return to the complete parked inventory in [`../MASTER-TODO.md`](../MASTER-TODO.md).

Preserved former Stage 7/8 tournament items:

- replace provisional teams, fixtures, regulations and lock instant with official sources;
- verify source provenance/effective dates and remove provisional labels;
- run the full time-travel rehearsal from pre-tournament through final/awards;
- run the exact production dress rehearsal and release freeze;
- decide and execute the published-release plan;
- complete the remaining tournament-only table, bracket and scorer presentation slices.

Euro 2028 is Stage L rather than the programme destination. Its rules remain governed by the existing tournament authorities; the platform ADRs govern only the shared direction and seam.
