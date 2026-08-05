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
| [0003](0003-asynchronous-incremental-scoring.md) | Asynchronous incremental scoring | Accepted direction — not currently justified at the operating caps; later full-group/WAL/bloat/knockout/concurrency evidence supersedes the first 12-result sample and `DEC-009` remains deferred to dress rehearsal |
| [0004](0004-maintained-entry-standings.md) | Maintained entry standings | Accepted direction — table unbuilt; the pagination/current-user consequences shipped independently at contract 43 |
| [0005](0005-background-jobs.md) | Background jobs | Partially implemented — Original auto-submit, recurring Match Predictor processing and LMS settlement run as database jobs; provider custody exists without a live rehearsal; reminders, incremental scoring drain, maintained-standings reconciliation and general failure reporting remain |
| [0006](0006-admin-authorisation-and-audit.md) | Administrator authorisation and audit | Implemented (contracts 37–40) |
| [0007](0007-reference-data-caching.md) | Reference-data caching | Accepted direction — unimplemented |
| [0008](0008-live-updates.md) | Live result and standing updates | Accepted direction — unimplemented |
| [0009](0009-product-analytics.md) | Privacy-conscious product analytics | Accepted direction — unimplemented |
| [0010](0010-bonus-games-platform.md) | Bonus Games platform: one platform, three games | Implemented for the Euro 2028 Bonus Games platform (contracts 49–60); multi-competition generalisation is governed by ADR 0011 |
| [0011](0011-multi-competition-platform.md) | Multi-competition platform | Accepted direction — partially implemented: shared context/locks, competition-season/game catalogue, memberships and repeatable instances are merged; complete Hub and season journeys remain |
| [0012](0012-season-predictor-rules.md) | Season Predictor rules | Accepted direction — partially implemented: rules, storage, recurring processing, scoring and cumulative standings backend are merged; phone card and complete season surfaces remain |
| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — partially implemented: rules, storage, settlement/replay and the complete Contract-107–109 restart lifecycle are merged; complete private/managed-entry and player journeys remain |
| [0014](0014-predictor-cup-season-formats.md) | Predictor Cup season formats | Accepted direction — partially implemented: rules, neutral machinery, split persistence/ancestry, derived standings, the Contract-110 round calendar and the Contract-111 launch driver are merged; multi-group draw, phase driver, bounded read and Predictor Championship surfaces remain |
| [0020](0020-football-prediction-hub-product-model.md) §Ingestion | Provider ingestion and notifications | Accepted — **the identity map is merged at Contract 112 and the round window at Contract 113**; the automatic fixture import and administrative reassignment the ADR decides on remain unbuilt |
| [0020](0020-football-prediction-hub-product-model.md) §79, **amended 5 August 2026** | Rescheduled fixtures | **Closed by owner amendment, which reverses the section rather than choosing between readings of it.** A rescheduled fixture is NOT reassigned: it stays in the matchweek it was scheduled in, its prediction stays editable until its own kickoff, and a single moved match never creates a round. The per-match guard the ADR already names as the integrity floor becomes the operative rule. Supersedes `fixtureReassignment.ts`'s destination model and removes contract 113's original consumer |
| [0015](0015-commercial-and-social-model.md) | Commercial and social model | Accepted direction — unimplemented; concrete private-container model supplied by [0023](0023-hub-information-architecture.md) |
| [0016](0016-client-and-distribution.md) | Client and distribution strategy | Accepted direction — unimplemented |
| [0017](0017-brand-and-club-identity.md) | Brand and club identity | Brand half superseded by [0019](0019-brand-decision-deferred.md); the claim that the weekly results card is the most important external artefact superseded by [0021](0021-sharing-surface-priority.md); **club identity half accepted and in force** |
| [0018](0018-pre-launch-promotion-cadence.md) | Pre-launch promotion cadence | Accepted direction — activation requires owner verification |
| [0019](0019-brand-decision-deferred.md) | Brand decision deferred with a trigger | Product-positioning half superseded by [0020](0020-football-prediction-hub-product-model.md); the club-identity and clearance cautions remain in force for any later distinctive brand |
| [0020](0020-football-prediction-hub-product-model.md) | Football Prediction Hub product model | Accepted direction — partially implemented: competition/game identity, memberships, game-owned locks and season backends are merged; finished Hub shell, onboarding and game surfaces remain |
| [0021](0021-sharing-surface-priority.md) | Sharing surface priority | Accepted — standings sharing is primary, the weekly personal card secondary, the champion/bracket card tournament-only |
| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Implemented — presets/setup, the public launch threshold, competition-neutral PostgreSQL Cup machinery, season sources and parity/schedule authorities are merged |
| [0023](0023-hub-information-architecture.md) | Hub information architecture and private competition model | Accepted direction — partially implemented: backend competition/game/private-instance/membership/league authorities and Match Predictor naming exist; Hub shell, onboarding, managed entrants and full creation/journey surfaces remain |
| [0024](0024-development-environment-operating-model.md) | Development environment operating model | Implemented for the current pre-cohort mode — trailing non-production contracts report, ahead/production mismatches fail, additive fast lane and deterministic seed are active, proportionate gates are enforced and production controls remain separate |
| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Implemented — Contracts 99–109 close both tournament defects, Euro reveal scope, split persistence/derived standings and the complete idempotent LMS restart lifecycle including guarded successor scheduling |
