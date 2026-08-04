# Architecture decision records

> Decisions live here. **What the finished product should look like** lives in [`../design/README.md`](../design/README.md) — the target design authority. It is subordinate to these ADRs: it may organise presentation and delivery, and may not change a rule any ADR sets.

Decision records for platform-level directions derived from the 27 July 2026 acquisition technical audit and subsequent multi-competition planning. The series deliberately starts at **0003** — designations 0001 and 0002 were never issued; do not create records under those numbers.

## Status vocabulary

- **Accepted direction** — agreed target; no or partial implementation exists.
- **Accepted direction — partially implemented** — part of the decision has shipped; the status line names what exists and what remains.
- **Implemented** — the decision is fully realised in merged code/migrations; the status line cites the evidence.
- **Superseded** — replaced by a later decision; the record is retained for traceability.

Update a record's status line when merged work changes its truth — an ADR describing shipped behaviour as future intent is a documentation defect. The records themselves are otherwise stable; substantive changes to a decision get a new ADR, not a rewrite.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0003](0003-asynchronous-incremental-scoring.md) | Asynchronous incremental scoring | Accepted direction — first capacity evidence (28 July 2026) shows full recompute at ~354 ms for 250 entries; not currently justified at the operating caps (see `DEC-009`) |
| [0004](0004-maintained-entry-standings.md) | Maintained entry standings | Accepted direction — table unbuilt; the pagination/current-user consequences shipped independently at contract 43 |
| [0005](0005-background-jobs.md) | Background jobs | Partially implemented — `pg_cron` auto-submit shipped (contract 41); remaining jobs and the Edge Functions half unbuilt |
| [0006](0006-admin-authorisation-and-audit.md) | Administrator authorisation and audit | Implemented (contracts 37–40) |
| [0007](0007-reference-data-caching.md) | Reference-data caching | Accepted direction — unimplemented |
| [0008](0008-live-updates.md) | Live result and standing updates | Accepted direction — unimplemented |
| [0009](0009-product-analytics.md) | Privacy-conscious product analytics | Accepted direction — unimplemented |
| [0010](0010-bonus-games-platform.md) | Bonus Games platform: one platform, three games | Implemented for the Euro 2028 Bonus Games platform (contracts 49–60); multi-competition generalisation is governed by ADR 0011 |
| [0011](0011-multi-competition-platform.md) | Multi-competition platform | Accepted direction — context and lock generalisation unimplemented; lock-policy ownership amended by [0020](0020-football-prediction-hub-product-model.md) |
| [0012](0012-season-predictor-rules.md) | Season Predictor rules | Accepted direction — unimplemented; Joker count and postponement rules amended by [0020](0020-football-prediction-hub-product-model.md); public game name set to Match Predictor by [0023](0023-hub-information-architecture.md) |
| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — unimplemented; lock-buffer ownership amended by [0020](0020-football-prediction-hub-product-model.md), presets supplied by [0022](0022-season-preset-threshold-and-shared-cup-machinery.md), private creator limits clarified by [0023](0023-hub-information-architecture.md) |
| [0014](0014-predictor-cup-season-formats.md) | Predictor Cup season formats | Accepted direction — unimplemented; entry close amended and interface name set to Predictor Championship by [0020](0020-football-prediction-hub-product-model.md); launch threshold and shared machinery supplied by [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) |
| [0015](0015-commercial-and-social-model.md) | Commercial and social model | Accepted direction — unimplemented; concrete private-container model supplied by [0023](0023-hub-information-architecture.md) |
| [0016](0016-client-and-distribution.md) | Client and distribution strategy | Accepted direction — unimplemented |
| [0017](0017-brand-and-club-identity.md) | Brand and club identity | Brand half superseded by [0019](0019-brand-decision-deferred.md); the claim that the weekly results card is the most important external artefact superseded by [0021](0021-sharing-surface-priority.md); **club identity half accepted and in force** |
| [0018](0018-pre-launch-promotion-cadence.md) | Pre-launch promotion cadence | Accepted direction — activation requires owner verification |
| [0019](0019-brand-decision-deferred.md) | Brand decision deferred with a trigger | Product-positioning half superseded by [0020](0020-football-prediction-hub-product-model.md); the club-identity and clearance cautions remain in force for any later distinctive brand |
| [0020](0020-football-prediction-hub-product-model.md) | Football Prediction Hub product model | Accepted — amends five named rules in ADRs 0011–0014 and sets the Hub product model, domestic Joker, lock-policy and Predictor Championship decisions; navigation/onboarding and public Match Predictor name amended by [0023](0023-hub-information-architecture.md) |
| [0021](0021-sharing-surface-priority.md) | Sharing surface priority | Accepted — standings sharing is primary, the weekly personal card secondary, the champion/bracket card tournament-only |
| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Accepted — supplies the three LMS presets ADR 0013 mandated but left undefined and the 100-entrant public Cup threshold ADR 0014 left open (both now executable); **corrected 3 August 2026** on the Cup machinery — the machinery is PostgreSQL (`predictor_internal.cup_*`), not TypeScript, so there was nothing in `src/domain` to extract and the separation law was never at risk; sharing is a database rescoping sequenced after C1b, and the season Cup modules still lack parity coverage |
| [0023](0023-hub-information-architecture.md) | Hub information architecture and private competition model | Accepted direction — unimplemented; retires the tournament-era future navigation, sets Hub/competition shells, onboarding, Match Predictor naming, private creation/caps, standings visibility, managed LMS and administration/fixture-change boundaries |
| [0024](0024-development-environment-operating-model.md) | Development environment operating model | Accepted — the preview contract-mismatch change is **implemented** (non-production trailing builds and reports; production and ahead-of-application still fail); development data is disposable until a closed external cohort begins, additive development migrations use a fast lane, browser regression is targeted with full runs at boundaries, and development must be deterministically reseedable. Production stays frozen and fully guarded; no production control is relaxed |
| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Accepted — settles the four questions that were blocking forward work. The LMS `restart_all_reentered` endgame **creates a new competition row** rather than wiping the old one, behind a separate idempotent lock-protected lifecycle function, which first requires resolving `bonus_competitions`' availability/instance conflation and its `unique (tournament_id, game_key)` key. The Cup split becomes a **distinct persisted stage** with phase-aware groups and memberships, standings derived across both phases rather than carried forward as a starting total. Both tournament-path defects are corrected **now** — the `entry_automatic_submission_outcomes` three-valued-logic hole and REL-001 — with production promotion separately controlled as usual. Appendix D.2 and contract 95 are confirmed as **different scopes with no conflict**; neither boundary moves |
