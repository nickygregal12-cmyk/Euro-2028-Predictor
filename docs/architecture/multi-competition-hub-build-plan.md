# Multi-competition hub — build plan

**Status:** Forward programme sequence.  
**Status date:** 29 July 2026  
**Decision authority:** [`docs/adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`docs/adr/0018-pre-launch-promotion-cadence.md`](../adr/0018-pre-launch-promotion-cadence.md).  
**Implementation authority:** [`docs/quality/current-status.md`](../quality/current-status.md).

This document owns the Stage A–L programme shape only. It does not restate competition, scoring, commercial, client, brand or promotion decisions; the ADRs above win wherever a planning note or older document differs.

## Programme framing

The repository is transitioning from a completed Euro 2028 tournament baseline into a year-round, multi-competition platform. The recoverable tournament reference is the annotated `euro-2028-baseline` tag. Euro-specific remaining work is parked in [`MASTER-TODO.md`](../../MASTER-TODO.md) and returns in **January 2028**.

The active programme spans three operating periods:

1. establish the platform seam and rehearse it against a live domestic-season calendar;
2. launch and operate the public domestic-season product;
3. return to Euro 2028 as one configured competition on the platform.

Exact competition dates, provider behaviour and hosted state remain evidence questions, not assumptions.

## Stage map

| Stage | Programme purpose | Primary authority |
| --- | --- | --- |
| **A** | Decisions, documentation reconciliation, brand clearance and current-control repair | ADRs 0011–0018; `docs/quality/` |
| **B** | Pure competition-context foundation, then behaviour-preserving surface migration | [ADR 0011](../adr/0011-multi-competition-platform.md); [`architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) |
| **C** | Competition-season data model and scoping | [ADR 0011](../adr/0011-multi-competition-platform.md) |
| **D** | Fixture/result ingestion and the headless rehearsal | [ADR 0011](../adr/0011-multi-competition-platform.md); current provider investigation evidence |
| **E** | Season Predictor | [ADR 0012](../adr/0012-season-predictor-rules.md) |
| **F** | Season Last Man Standing | [ADR 0013](../adr/0013-last-man-standing-season-rules.md) |
| **G** | Season Predictor Cup | [ADR 0014](../adr/0014-predictor-cup-season-formats.md) |
| **H** | Cross-competition hub, invitations, preferences, managed-entry and sharing surfaces | [ADR 0015](../adr/0015-commercial-and-social-model.md) |
| **I** | PWA, notifications and native distribution | [ADR 0016](../adr/0016-client-and-distribution.md) |
| **J** | Public-launch readiness and operational proof | quality controls and relevant operations runbooks |
| **K** | Public domestic-season operation | `docs/quality/current-status.md` and dated operational evidence |
| **L** | Euro 2028 return, final data, rehearsal and release | parked section in [`MASTER-TODO.md`](../../MASTER-TODO.md) |

## Stage A — decisions, documentation and control alignment

- land and index ADRs 0011–0018;
- reconcile forward-looking documents and agent instructions with the platform direction;
- reconcile the architecture contract with the ADRs before any surface consumes the new engine;
- repair silently inapplicable controls, including domain-wide Database parity triggering;
- bring the live baseline, risk and status authorities back into agreement;
- complete the brand-clearance work governed by [ADR 0017](../adr/0017-brand-and-club-identity.md);
- retain every historical control document and archive rather than delete superseded material.

**Exit:** the ADR stack is merged, current authority documents agree, open brand work is explicit, and no future agent is instructed to assume a single-tournament product.

## Stage B — competition-context foundation and migration

The pure foundation lives under `src/domain/competition/` and is governed by [ADR 0011](../adr/0011-multi-competition-platform.md). Surface migration remains separate work.

Sequence:

1. pure competition kinds, lock resolver, context resolver and match-state resolver;
2. deterministic fake-clock contract fixtures;
3. differential adapters for the existing entry lock;
4. Match Centre migration;
5. Matches migration;
6. Home migration;
7. remove duplicated timing authority only after each consumer has equivalent evidence.

**Exit:** every signed-in surface consumes the shared context contract, while the tagged Euro 2028 behaviour remains unchanged.

## Stage C — competition-season schema

- introduce the competition-season scope without weakening existing relationship safeguards;
- preserve season history and independent standings;
- settle schema-level privacy, deletion/anonymisation and timezone consequences before entries depend on them;
- extend canonical applied-state and environment-parity verification in the same change as new objects;
- keep migrations append-only and production promotion milestone-only.

**Exit:** Euro 2028 is represented as one competition season without changing its rules or scoring.

## Stage D — ingestion and headless rehearsal

- establish provider adapters behind one internal fixture/result model;
- record raw responses from the first poll;
- keep feed data provisional and confirmation authoritative;
- audit fixture-time changes and correction signals;
- prove replay, idempotency, rescheduling, exception and stale-data behaviour;
- operate the provisional path without public users before the closed cohort.

Provider selection and exact mappings require dated evidence. Do not infer timezone or exceptional-state vocabulary.

**Exit:** a season-scale provisional pipeline has an evidence corpus and a zero-manual-intervention replay path.

## Stage E — season Predictor

Build the season Predictor governed by [ADR 0012](../adr/0012-season-predictor-rules.md), including its own scoring/parity authority, recurring lock/submission cadence and phone-first completion path.

**Exit:** a full simulated season covers late entry, incomplete rounds, reschedules, corrections and every decided season rule.

## Stage F — season Last Man Standing

Build the season Last Man Standing competition governed by [ADR 0013](../adr/0013-last-man-standing-season-rules.md), including public/private lifecycle, managed entrants, exception handling, presets and adversarial failure paths.

**Exit:** repeated competitions complete correctly across a simulated season.

## Stage G — season Predictor Cup

Re-plumb the existing Cup machinery to the season points source and formats governed by [ADR 0014](../adr/0014-predictor-cup-season-formats.md).

**Exit:** valid schedules and settlement evidence exist across supported field sizes and partial-season starts.

## Stage H — hub and social product

- build a cross-competition dashboard and weekly action model without combining entries or standings;
- implement preference as presentation while entry remains voluntary;
- provide invitations, rerun/copy flows, managed-entry operations and public read-only acquisition views;
- complete resilient loading, empty, partial, retry and hostile-data states;
- retain the existing separation, privacy and bounded-read controls.

Commercial and social boundaries are governed by [ADR 0015](../adr/0015-commercial-and-social-model.md).

## Stage I — client distribution

Deliver the PWA/native sequence governed by [ADR 0016](../adr/0016-client-and-distribution.md), preserving the web path as the fast operational path and proving notifications, deep links, authentication and rollback.

## Stage J — launch readiness

- close manual accessibility and assistive-technology evidence;
- prove monitoring, alerting, backup restore, rollback and incident ownership;
- verify authentication, email, abuse, support and administrator custody;
- test realistic concurrency and service ceilings;
- complete legal, privacy, data-provider and store disclosures;
- run exact-head release controls without weakening any gate.

## Stage K — public season operation

Operate the domestic-season platform. Current facts and incidents belong in `docs/quality/current-status.md` and dated quality/operations evidence, not in this plan.

## Stage L — Euro 2028 return

Return in **January 2028** to the parked inventory in [`MASTER-TODO.md`](../../MASTER-TODO.md). Complete final official data, tournament-only presentation slices, operational rehearsal and the release decision without bypassing the platform seam.

## Open programme decisions

The ADRs close the decisions they record. Remaining programme choices stay explicit:

- final brand clearance under [ADR 0017](../adr/0017-brand-and-club-identity.md);
- the close-season retention product;
- operational ownership and sustainable weekend coverage;
- provider and licensing decisions requiring dated evidence.

## Controls carried through every stage

- evolve rather than rewrite;
- time is injected into pure domain rules;
- feeds never become official truth;
- competition entries, scoring and standings remain independent;
- no development or simulation write path reaches production;
- hosted claims require target-specific evidence;
- process, intent or prepared tooling is not completion evidence;
- stable identifiers are assigned before implementation;
- superseded controls are archived, never deleted.
