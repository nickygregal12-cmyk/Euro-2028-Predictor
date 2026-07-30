# Multi-competition platform — roadmap

**Status date:** 30 July 2026  
**Purpose:** current delivery position and next executable slice.  
**Current facts:** [`quality/current-status.md`](quality/current-status.md)  
**Parent programme:** [`architecture/programme-plan.md`](architecture/programme-plan.md)  
**Engineering workstream:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)  
**Detailed inventory:** [`../MASTER-TODO.md`](../MASTER-TODO.md)  
**Decision authority:** [`adr/README.md`](adr/README.md)

This roadmap does **not** maintain another copy of the programme phases or Stage A–L engineering plan. The parent programme owns phases, workstreams and product gates. The child engineering plan owns stage sequence and engineering exit evidence. This file records where delivery is now and what can execute next.

## Correction record — 30 July 2026

The previous roadmap was inconsistent with the reconciled planning hierarchy. The following corrections are explicit rather than silent:

1. **Parent/child authority:** the programme plan, not the engineering plan, is now identified as the parent programme.
2. **Surface migration order:** the roadmap no longer carries the former `entryLock → matchCentre → matchesTab → homeDashboard` order. Stage B follows the child plan's `homeDashboard → matchesTab → matchCentre → entryLock` sequence, each with pre-migration differential evidence.
3. **Design and instrumentation:** information architecture, prototype testing, visual direction and event-taxonomy definition belong to programme **Phase 1** before Stages E–H implement screens. Stage H implements validated output rather than designing alongside construction.
4. **Launch and acquisition:** Stage J is launch readiness **and go-to-market**, with the programme window beginning in **February 2027**.
5. **Bonus Games Browser E2E:** earlier readiness wording treated this coverage as absent. PR #187 already supplies authenticated desktop/phone lifecycle proof for all three Bonus Games; new work covers only new platform and season behaviour.

## Delivered baseline

The completed Euro 2028 tournament product is preserved as the recoverable baseline. Its exact capabilities, contract and hosted-evidence boundary belong in [`quality/current-status.md`](quality/current-status.md), not in another roadmap inventory.

Remaining tournament-specific work is parked in Part I of [`../MASTER-TODO.md`](../MASTER-TODO.md) for the January 2028 return.

## Current position

### Stage A — authority and control alignment

The active pull-request stack contains the platform ADRs, pure context foundation, forward-document reconciliation, state-architecture reconciliation, domain-wide Database parity correction, programme hierarchy and this evidence correction.

Stage A is complete only after the intended stack has landed, contradictions are reconciled on `main`, and applicable controls run on the final heads.

### Stage B — competition-context foundation

The pure engine exists on the open foundation branch but is not on `main` and no rendered surface has migrated. The existing Euro 2028 behaviour remains the baseline contract.

## Next executable sequence

1. Resolve the open documentation and engine stack under the reviewed merge plan; do not begin a surface migration from an intermediate stack head.
2. Confirm the final competition-context engine and planning authorities are present on clean `main` with green checks.
3. Migrate `homeDashboard.ts`, committing its pre-migration differential fixtures before implementation.
4. Migrate `matchesTab.ts`, then `matchCentre.ts`, then `entryLock.ts`, each with unchanged fixtures and no weakened test.
5. Retire `MatchTemporalState` only after all four surfaces have migrated, in a separate pull request.
6. Continue through the child engineering plan while programme discovery, design and data work proceed according to the parent phases.

## Programme and stage navigation

- Product phases, workstreams, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L, migration order and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Current implemented/hosted position: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Architecture and product decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
