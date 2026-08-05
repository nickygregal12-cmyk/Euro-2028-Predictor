# Multi-competition hub — engineering workstream

**Status:** Child engineering plan within the product programme. Proposal, not implementation authority.  
**Status date:** 30 July 2026  
**Parent programme:** [`programme-plan.md`](programme-plan.md)  
**Decision authority:** the current index at [`../adr/README.md`](../adr/README.md); later ADRs amend the original 0011–0018 planning set.  
**Implementation authority:** [`../quality/current-status.md`](../quality/current-status.md).

This document owns the Stage A–L engineering sequence. Discovery, research, product design, instrumentation, go-to-market, operations and legal work are governed by the parent programme. Competition rules and strategic decisions are referenced rather than repeated here; the ADRs win wherever this plan or an older document differs.

> **Progress overlay — 5 August 2026.** The detailed findings below remain a dated 30 July planning record. Phrases such as “current `main`” inside §1 refer to that verification snapshot, not the repository now. Since then the shared context migration, Stage C/C1b, provider custody, the season Match Predictor/LMS/Championship backend foundations and the complete Contract 107–109 LMS wipeout restart lifecycle, including the past-window guard, successor-window scheduler the Contract 110 season Championship round calendar, the Contract 111 Championship launch driver the Contract 112 provider identity map, the Contract 113 round play window and the Contract 114 provider poll dispatch have landed. The remaining execution order is maintained only in [`../roadmap.md`](../roadmap.md), and exact implementation/hosted truth only in [`../quality/current-status.md`](../quality/current-status.md). Do not update historical rows piecemeal to mimic a live status page.

## 1. Repository verification and corrections

Repository assertions in the earlier engineering drafts were checked against `main` as it stood on 30 July 2026, at the `euro-2028-baseline` commit. That is a dated verification, not a claim about where `main` is now.

| Earlier claim | Verified position |
| --- | --- |
| Production and repository were at contract 60 | **Stale.** The repository and hosted contracts have all moved past 60. This row used to restate them and went stale in turn; the current values are in [`../quality/current-status.md`](../quality/current-status.md). |
| The context engine was unbuilt | **True for current `main`.** Open PR #201 proposes an isolated, unwired foundation; it is not merged implementation. |
| Automatic submission did not exist | **Stale.** Tournament-wide automatic valid-entry submission exists. Only recurring matchweek scheduling is unbuilt. |
| Bonus Games lacked Browser E2E | **Stale and corrected 30 July 2026.** PR #187 provides authenticated desktop/phone lifecycle coverage for KO Predictor, Last Man Standing and Predictor Cup. `TEST-GAP-01` is resolved in the risk register. |
| Both the feature baseline and risk register were several generations stale | **Partly stale.** The risk register is contract-63 aligned; the feature baseline still contains contract-60 classification text. |
| A fixed test-count snapshot was the current safety-net measure | **Not retained.** Test counts change with ordinary development. Current evidence belongs in [`../quality/current-status.md`](../quality/current-status.md), executable CI and dated validation records, not this planning document. |
| No fixture/results ingestion adapter existed | **Confirmed on current `main`.** Repository search found no football-data.org, Sportmonks or provider-ingestion implementation. |
| Browser result-entry administration remained unbuilt | **Stale.** Browser result and qualification administration is implemented and production-hosted. |

External provider, market, legal, season-date and cost claims from earlier drafts were not reclassified as repository facts. They require dated external evidence before implementation depends on them.

### 1a. Corrections forced by Phase 0 evidence — 30 July 2026

[`phase-0-world-cup-evidence.md`](phase-0-world-cup-evidence.md) is the first user evidence this programme has held: owner observation of a live World Cup predictor, roughly sixty users, across a full tournament. The corrections below are recorded rather than silently applied, because each reverses a position this plan previously stated.

The distinction the evidence document draws is carried through here. **Observed** findings are treated as fact. **Stated** findings are the owner's hypothesis — valuable, but not the same thing.

| # | This plan previously assumed | Corrected position | Finding |
| --- | --- | --- | --- |
| 1 | Matchweek winners, monthly standings and form give **late joiners** something to win | They are the **primary retention mechanism for the whole field below the top few**. Late joiners are a subset, not the purpose | O1 (observed) |
| 2 | The weekly pick is the centre of the product | **The match is the event; the pick is the chore.** Live match viewing with league predictions visible is the primary engagement surface | O2 (observed) |
| 3 | A purpose-built weekly results card is the highest-leverage growth artefact | **The league table is already being shared unprompted.** Make the artefact people already share worth sharing | O3 (observed) |
| 4 | Competition separation is handled by the separation law | The law is architectural and was **visually invisible**. Separation must be legible on the surface | O4 (observed) |
| 5 | Per-match point transparency is a nicety | It is a **support-load feature**. The organiser burden was explaining scores, not collecting picks | O5 (observed) |
| 6 | Email signup is a barrier costing users | Those users are **out of segment**, and are served by managed entrants (ADR 0013). It is a segment boundary, not friction | S1 (stated) |

Corrections 1–5 rest on observed behaviour. Correction 6 rests on the owner's segmentation judgement and is marked accordingly — it is the one most worth revisiting if later evidence disagrees.

**Two ADR-level implications are reported here and deliberately not acted on**, because a substantive change to a decision requires a new ADR rather than an edit:

- **ADR 0012** records secondary rankings as a late-joiner mechanism. O1 makes them load-bearing for most of the field over thirty-eight weeks. That is a change of *purpose*, not emphasis, and plausibly warrants a new ADR.
- **ADR 0017** states the weekly shareable results card is *"the artefact most likely to be seen outside the product"*. O3 contradicts it: the league table already is. The `ClubIdentity` requirement attached to that consequence still stands whichever artefact wins. **Settled 1 August 2026 by [ADR 0021](../adr/0021-sharing-surface-priority.md)** — standings sharing is primary, the weekly personal card secondary, and the shipped champion/bracket renderer stays tournament-only. This report is retained as the record of how the contradiction was found; the decision lives in the ADR.

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
13. **Separation must be visible, not only enforced.** Principle 9 keeps competitions and games independent in the schema. That is necessary and it is not sufficient: with one extra game, players did not understand it was separate ([Phase 0 evidence](phase-0-world-cup-evidence.md), O4). A surface that does not make the boundary legible fails this principle even when the data model is correct.
14. **Evidence outranks reasoning.** Where [Phase 0 evidence](phase-0-world-cup-evidence.md) contradicts a position in this plan, the evidence wins and the position is corrected in writing — see §1a. Where it contradicts an ADR, that is reported and settled by a new ADR, never by editing this plan around it.

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

**Correction — 30 July 2026 (O1, observed):** this stage previously treated matchweek winners, monthly standings and form as a secondary view serving late joiners. Observed evidence reverses that. Low scorers churned over a **four-week** tournament and were the main retention failure; the season Predictor is a cumulative leaderboard over **thirty-eight**. A player sitting fortieth in October otherwise has seven months with nothing to play for, and that is most of the field, not an edge case.

These rankings are therefore **first-class retention features and must be built as such** — designed, surfaced and tested alongside the cumulative total rather than derived from it as an afterthought. The constraint from ADR 0012 is unchanged and still binding: they are computed from data the leaderboard already produces and **must never feed back into the canonical total**.

The ADR 0012 implication is reported in §1a, not resolved here.

**Exit:** late entry, incomplete rounds, reschedules, corrections and every ADR 0012 rule are proven across a full simulated season, **and the secondary rankings exist as designed surfaces rather than as data that happens to be derivable**.

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

**Correction — 30 July 2026:** earlier §12/launch-readiness wording treated Bonus Games Browser E2E as absent. That finding is resolved by PR #187 and the recorded authenticated desktop/phone Browser E2E run. Stage H must preserve that tournament proof and add coverage only for genuinely new hub and season behaviour.

**Correction — 30 July 2026 (O2, observed):** the information architecture behind this stage was reasoned from the weekly pick. Observed usage says otherwise. Peak engagement was **leagues and Match Centre during matches** — watching what everyone in your league predicted, live, with the table moving underneath — and point-change checking immediately after a match ended. Saturday at three, not Friday at the deadline.

**The match is the event; the pick is what earns eligibility for it.** Phase 1 information architecture must start from that position rather than arrive at it.

This records the correction and deliberately **does not redesign the navigation** — that is Phase 1 design work, and doing it here would be exactly the invent-the-shell-while-coding failure principle 3 exists to prevent. What this stage owes Phase 1 is that the corrected premise is written down *before* design begins.

**Correction — 30 July 2026 (O4, observed):** competition and game separation is architecturally enforced under ADRs 0011 and 0015, and this plan treated that as sufficient. It is not. With **one** additional game — KO Predictor in the World Cup product — players did not understand it was separate with separate scoring. The hub carries **three games per competition across two leagues**, so the same confusion multiplies with every competition added.

Separation must be **visible on the surface**, not only true in the schema. A correct separation law that a player cannot see is indistinguishable, to that player, from no separation at all. See also principle 13.

**Correction — 30 July 2026 (O5, observed):** per-match point transparency was treated as a nicety. The observed organiser burden was **explaining scores**, not collecting picks — point breakdowns were unclear enough that players asked a person instead of reading a screen. It is a support-load feature before it is a trust feature, and it should be scoped as one.

**Exit:** the shell matches the tested prototype; a single-game/single-league user sees only their chosen product by default; **a player can tell at a glance which game and which competition a score belongs to; and any score is explainable on screen without asking the organiser**.

## 13. Stage I — client distribution

Deliver the sequence governed by ADR 0016, proving notifications, deep links, authentication, offline locked-entry reading and a rollback path that does not require a same-day store release.

## 14. Stage J — launch readiness and go-to-market

**Window:** February–August 2027.

**Correction — 30 July 2026:** Bonus Games Browser E2E is not an open Stage J gap. `TEST-GAP-01` is resolved by PR #187, with CI `30442005168` and Browser E2E `30442002202`. Stage J requires future platform/season journeys and continued regression coverage; it does not recreate existing tournament proof.

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

## 17. Roadmap reconciliation — corrected 30 July 2026

The earlier version reported four roadmap contradictions without resolving them. [`../roadmap.md`](../roadmap.md) now:

1. identifies `programme-plan.md` as the parent programme and this file as its child engineering workstream;
2. points to the Home-first Stage B order instead of restating a conflicting sequence;
3. assigns discovery, design and event-taxonomy work to parent Phase 1 rather than Stage H implementation;
4. identifies Stage J as launch readiness and go-to-market beginning February 2027.

The roadmap is intentionally thin. It records the current position and next executable slice, while this file and the parent programme retain the actual sequencing authorities.

## 18. What changed from the earlier long engineering draft

No authoritative rule was deleted. Detailed season Predictor, Last Man Standing, Cup, commercial, client and club-identity decision prose was **superseded by direct references to ADRs 0011–0018**, because maintaining the same decision in two documents creates competing authority.

The following material was genuinely removed from the engineering plan:

- unverified market-positioning and legal-analysis essays;
- provider pricing/free-tier claims and exact season-date claims not freshly verified in this repository task;
- obsolete instructions to write ADRs 0011–0018;
- obsolete contract-60, missing-Browser-E2E and fixed test-count assertions.

They were removed because they are either external research requiring dated evidence, already governed elsewhere, or factually stale. Their removal does not change an accepted ADR or implemented capability.
