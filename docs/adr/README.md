# Architecture decision records

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
| [0012](0012-season-predictor-rules.md) | Season Predictor rules | Accepted direction — unimplemented; Joker count and postponement rules amended by [0020](0020-football-prediction-hub-product-model.md) |
| [0013](0013-last-man-standing-season-rules.md) | Last Man Standing season rules | Accepted direction — unimplemented; lock-buffer ownership amended by [0020](0020-football-prediction-hub-product-model.md) |
| [0014](0014-predictor-cup-season-formats.md) | Predictor Cup season formats | Accepted direction — unimplemented; entry close amended and interface name set to Predictor Championship by [0020](0020-football-prediction-hub-product-model.md) |
| [0015](0015-commercial-and-social-model.md) | Commercial and social model | Accepted direction — unimplemented |
| [0016](0016-client-and-distribution.md) | Client and distribution strategy | Accepted direction — unimplemented |
| [0017](0017-brand-and-club-identity.md) | Brand and club identity | Brand half superseded by [0019](0019-brand-decision-deferred.md); the claim that the weekly results card is the most important external artefact superseded by [0021](0021-sharing-surface-priority.md); **club identity half accepted and in force** |
| [0018](0018-pre-launch-promotion-cadence.md) | Pre-launch promotion cadence | Accepted direction — activation requires owner verification |
| [0019](0019-brand-decision-deferred.md) | Brand decision deferred with a trigger | Product-positioning half superseded by [0020](0020-football-prediction-hub-product-model.md); the club-identity and clearance cautions remain in force for any later distinctive brand |
| [0020](0020-football-prediction-hub-product-model.md) | Football Prediction Hub product model | Accepted — amends five named rules in ADRs 0011–0014 and sets the hub product model, domestic Joker, lock-policy and Predictor Championship decisions |
| [0021](0021-sharing-surface-priority.md) | Sharing surface priority | Accepted — settles the ADR 0017 / Phase 0 O3 contradiction: standings sharing is primary, the weekly personal card secondary, the champion/bracket card tournament-only. No sharing code changed |
| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Accepted — supplies the three LMS presets ADR 0013 mandated but left undefined and the 100-entrant public Cup threshold ADR 0014 left open (both now executable); resolves the ADR 0014 / ADR 0011 separation-law contradiction by extracting shared Cup machinery to `src/domain/competition/`, which is **not yet done** and requires differential evidence |
