# Multi-competition hub — engineering workstream

**Status:** Child engineering plan within the product programme. Proposal, not implementation authority.  
**Status date:** 29 July 2026  
**Parent programme:** [`programme-plan.md`](programme-plan.md)  
**Decision authority:** [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0018-pre-launch-promotion-cadence.md`](../adr/0018-pre-launch-promotion-cadence.md).  
**Implementation authority:** [`../quality/current-status.md`](../quality/current-status.md).

This document owns the Stage A–L engineering sequence. Discovery, research, product design, instrumentation, go-to-market, operations and legal work are governed by the parent programme. Competition rules and strategic decisions are referenced rather than repeated here; the ADRs win wherever this plan or an older document differs.

## 1. Repository verification and discrepancies

Repository assertions in the earlier engineering drafts were checked against current `main` at `1fb8ffd36ad113079181829a8bcc47175c43b6da`.

| Earlier claim | Verified position |
| --- | --- |
| Production and repository were at contract 60 | **Stale.** Current `main`, the recorded hosted baseline and the published application are contract 63. |
| The context engine was unbuilt | **True for current `main`.** Open PR #201 proposes an isolated, unwired foundation; it is not merged implementation. |
| Automatic submission did not exist | **Stale.** Tournament-wide automatic valid-entry submission exists. Only recurring matchweek scheduling is unbuilt. |
| Bonus Games lacked Browser E2E | **Stale.** The current risk/feature evidence records authenticated Bonus Games lifecycle coverage. |
| Both the feature baseline and risk register were several generations stale | **Partly stale.** The risk register is contract-63 aligned; the feature baseline still contains contract-60 classification text. |
| `844` tests across `144` files were the current safety-net count | **Not retained.** The current quality record reports 149 Vitest files for the exact contract-63 PR head and does not support the earlier count as current. |
| No fixture/results ingestion adapter existed | **Confirmed on current `main`.** Repository search found no football-data.org, Sportmonks or provider-ingestion implementation. |
| Browser result-entry administration remained unbuilt | **Stale.** Browser result and qualification administration is implemented and production-hosted. |

External provider, market, legal, season-date and cost claims from earlier drafts were not reclassified as repository facts. They require dated external evidence before implementation depends on them.

## 2. Relationship to the product programme

The engineering stages map onto the parent phases:

| Engineering stage | Programme phase |
| --- | --- |
| A | Phase 0/1/2 enabling work |
| B–C | Phase 2 Platform, running in parallel with discovery and design |
| D | Phase 2 headless rehearsal, then Phase 4 closed-cohort evidence |
| E–H | Phase 3 Product build after the Phase 1 design gate |
| I–J | Phase 5 Launch readiness and go-to-market |
| K | Phase 6 Public domestic season |
| L | Phase 7 Euro 2028 peak |

**Phases 0 and 1 run in parallel with Stages B–C.** Discovery and design do not wait for the platform foundation, and feature screens do not start before the design gate.

## 3. Engineering principles

1. **Evolve, do not rewrite.** Each stage preserves the recoverable Euro 2028 baseline and keeps changes reviewable.
2. **ADRs are authority.** This plan links to ADR decisions rather than maintaining a second copy of rules.
3. **Design precedes build.** Stages E–H implement a Phase 1 prototype and design system; they do not invent the shell while coding it.
4. **Instrument before building.** The Phase 1 event taxonomy is a prerequisite for feature commits and the closed-cohort gate.
5. **Behaviour-preserving migrations need differential evidence.** Existing tests passing is necessary but not sufficient where ADR 0011 requires identical Euro behaviour.
6. **Time is an input.** Shared domain rules do not read the ambient clock.
7. **Feeds remain provisional.** Official confirmation remains the scoring/progression gate.
8. **Controls fail closed.** Unknown, stale or incompatible reference data cannot create an open or permissive state.
9. **Competition boundaries remain independent.** See ADRs 0011 and 0015; no combined entry, score or standings authority is introduced.
10. **No speculative abstraction.** Build a shared seam when a second implementation is imminent, not merely imaginable.
11. **Stable identifiers precede implementation.** New safeguards, surfaces and rules receive IDs before build.
12. **Superseded controls are archived, not deleted.**

## 4. Stage map

| Stage | Engineering purpose | Primary authority |
| --- | --- | --- |
| **A** | Authority, documentation and control alignment | ADRs 0011–0018; `docs/quality/` |
| **B** | Competition-context foundation and behaviour-preserving surface migrations | [ADR 0011](../adr/0011-multi-competition-platform.md) |
| **C** | Competition-season data model and scoping | [ADR 0011](../adr/0011-multi-competition-platform.md) |
| **D** | Provider ingestion, headless rehearsal and closed-cohort evidence | ADR 0011 plus the programme metrics |
| **E** | Season Predictor | [ADR 0012](../adr/0012-season-predictor-rules.md) |
| **F** | Season Last Man Standing | [ADR 0013](../adr/0013-last-man-standing-season-rules.md) |
| **G** | Season Predictor Cup | [ADR 0014](../adr/0014-predictor-cup-season-formats.md) |
| **H** | Implement the validated hub shell and social surfaces | [ADR 0015](../adr/0015-commercial-and-social-model.md) |
| **I** | PWA, notifications and native distribution | [ADR 0016](../adr/0016-client-and-distribution.md) |
| **J** | Launch readiness **and go-to-market**, beginning February 2027 | parent Phase 5 and relevant controls |
| **K** | Public domestic-season operation | live status and dated operational evidence |
| **L** | Euro 2028 return and peak | parked Euro inventory and tournament authorities |

## 5. Stage A — authority and control alignment

- land and index ADRs 0011–0018;
- maintain the parent/child planning hierarchy;
- reconcile architecture wording with the ADRs;
- repair controls that silently exclude new domain siblings;
- reconcile current status, risk and feature-baseline assertions;
- complete the brand-clearance work governed by ADR 0017;
- retain historical controls and evidence.

**Exit:** current authorities agree, planning hierarchy is discoverable, remaining contradictions are explicit and every applicable automated gate triggers.

## 6. Stage B — competition-context foundation and surface migration

The shared foundation lives under `src/domain/competition/`, governed by ADR 0011.

Sequence:

1. land the pure competition kinds, lock resolver, context resolver and match-state resolver;
2. land deterministic fake-clock coverage;
3. migrate `homeDashboard.ts` with a pre-migration differential fixture committed first;
4. migrate `matchesTab.ts` with identical-output evidence;
5. migrate `matchCentre.ts` with identical-output evidence;
6. migrate `entryLock.ts` with identical-output evidence;
7. retire `MatchTemporalState` only after all four consumers have migrated and that retirement has its own review.

No migration may weaken, skip or rewrite an existing test to manufacture equivalence.

**Exit:** every signed-in surface consumes the shared context/lock authority, duplicated timing decisions are removed, and Euro 2028 behaviour is identical to the captured pre-migration fixtures.

## 7. Stage C — competition-season schema

- introduce competition-season scoping without weakening existing relationship safeguards;
- preserve independent entries, standings, honours and history;
- settle deletion/anonymisation and timezone consequences before dependent records exist;
- extend canonical applied-state and environment-parity checks in the same change as new objects;
- keep migrations append-only and promotion subject to the currently effective control regime.

Competition shape, lock and separation decisions remain in ADR 0011.

**Exit:** Euro 2028 is represented as one competition season while retaining its current rules, scores and access boundaries.

## 8. Stage D — ingestion, rehearsal and closed-cohort gate

- implement provider adapters behind one provisional internal model;
- record raw provider responses from the first poll;
- audit fixture-time, state and correction changes;
- prove replay, idempotency, rescheduling, exception and stale-data behaviour;
- preserve manual confirmation as the official-result gate;
- operate the headless provisional path before user exposure;
- instrument every cohort action from the first exposed build.

**Correctness gate:** season-scale provisional ingestion/replay operates without normal manual intervention and every observed or constructed anomaly has evidence.

**Failable product gate:**

| Metric | Threshold | Required response if missed |
| --- | ---: | --- |
| Weekly Predictor completion | at least 70% by mid-season | Activate the ADR 0012 reduced-set fallback |
| Multi-game entry | at least 50% enter two or more games | Revisit the hub positioning; do not add features |
| Group formation | at least one organiser brings four or more people | Rework organiser and managed-entry assumptions |
| Week-four retention | at least 40% | Stop public-launch progression until the cause is understood |

Stage D does not pass merely because ingestion is technically correct.

## 9. Stage E — season Predictor

Implement ADR 0012, including recurring lock/submission cadence, an independent season scoring authority, SQL/TypeScript parity, phone-first completion and full-season simulation.

**Exit:** late entry, incomplete rounds, reschedules, corrections and every ADR 0012 rule are proven across a full simulated season.

## 10. Stage F — season Last Man Standing

Implement ADR 0013, including public/private lifecycle, managed-entry boundaries, exception handling, presets, anti-abuse controls and adversarial failure paths.

**Exit:** several consecutive competitions complete correctly across a simulated season, including exceptional and simultaneous-elimination cases required by the ADR.

## 11. Stage G — season Predictor Cup

Re-plumb the existing Cup machinery to the season points source and formats governed by ADR 0014.

**Exit:** supported field sizes, partial-season starts, published schedules and settlement rules have deterministic evidence.

## 12. Stage H — validated hub-shell implementation

**Rescope:** the earlier plan treated shell design and implementation as one `L` stage. That was an underestimate; combined, it was `XL`. Information architecture, prototyping, usability testing, visual direction and event-taxonomy design move to parent **Phase 1**. Stage H is the `L` implementation of validated output.

- implement the cross-competition dashboard and consolidated weekly actions;
- implement preference as prominence while entry remains voluntary;
- implement invitations, rerun/copy, managed entrants and public acquisition views;
- implement resilient loading, empty, partial, retry and hostile-data states;
- retain bounded reads, privacy and independent competition standings;
- emit the Phase 1 analytics events from the first commit.

**Exit:** the shell matches the tested prototype and a single-game/single-league user sees only their chosen product by default.

## 13. Stage I — client distribution

Deliver the sequence governed by ADR 0016, proving notifications, deep links, authentication, offline locked-entry reading and a rollback path that does not require a same-day store release.

## 14. Stage J — launch readiness and go-to-market

**Window:** February–August 2027.

Engineering and operations:

- close manual accessibility and assistive-technology evidence;
- prove monitoring, alerting, backup restore, rollback and incident ownership;
- verify authentication, reminder delivery, abuse controls and administrator custody;
- test realistic concurrency and service ceilings;
- complete legal, privacy, provider and store disclosures;
- run exact-head release controls without weakening a gate.

Go-to-market:

- implement instrumentation dashboards needed to judge launch;
- prepare store/web listing assets and acquisition landing surfaces;
- support the named first-thousand-user plan from the parent programme;
- provide rules/help/onboarding content and the agreed support route.

**Exit:** technical launch controls and the owned acquisition/support plan both pass. One cannot substitute for the other.

## 15. Stage K — public domestic-season operation

Operate, measure and learn. Current facts and incidents belong in `docs/quality/current-status.md` and dated evidence, not in this plan.

## 16. Stage L — Euro 2028 return

Return in January 2028 to the parked Euro inventory. Complete official data, tournament-only presentation work, full state rehearsal, recovery/rollback evidence and the release decision without bypassing the platform seam.

## 17. Roadmap reconciliation check

`docs/roadmap.md` was intentionally not changed in this task. The following differences must remain visible until a later roadmap reconciliation:

1. its header still calls this engineering plan the **programme map**, while the parent is now `programme-plan.md`;
2. its Stage B order is `entryLock → matchCentre → matchesTab → homeDashboard`, while the required migration order is now `homeDashboard → matchesTab → matchCentre → entryLock`;
3. its Stage H still carries design/acquisition/analytics decision work that the parent moves to Phase 1 before feature implementation;
4. its Stage J is framed only as public-launch readiness and does not identify go-to-market beginning in February 2027.

These are planning contradictions/omissions, not implementation defects. They are reported rather than silently resolved, as required.

## 18. What changed from the earlier long engineering draft

No authoritative rule was deleted. Detailed season Predictor, Last Man Standing, Cup, commercial, client and club-identity decision prose was **superseded by direct references to ADRs 0011–0018**, because maintaining the same decision in two documents creates competing authority.

The following material was genuinely removed from the engineering plan:

- unverified market-positioning and legal-analysis essays;
- provider pricing/free-tier claims and exact season-date claims not freshly verified in this repository task;
- obsolete instructions to write ADRs 0011–0018;
- obsolete contract-60, missing-Browser-E2E and `844/144` repository assertions.

They were removed because they are either external research requiring dated evidence, already governed elsewhere, or factually stale. Their removal does not change an accepted ADR or implemented capability.
