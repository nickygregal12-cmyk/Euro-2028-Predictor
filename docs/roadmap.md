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

1. **Parent/child authority:** the programme plan, not the engineering plan, is identified as the parent programme.
2. **Surface migration order:** Stage B follows the child plan's `homeDashboard → matchesTab → matchCentre → entryLock` sequence, each with pre-migration differential evidence.
3. **Design and instrumentation:** information architecture, prototype testing, visual direction and event-taxonomy definition belong to programme **Phase 1** before Stages E–H implement screens. Stage H implements validated output rather than designing alongside construction.
4. **Launch and acquisition:** Stage J is launch readiness **and go-to-market**, with the programme window beginning in **February 2027**.
5. **Bonus Games Browser E2E:** PR #187 already supplies authenticated desktop/phone lifecycle proof for all three Bonus Games; new work covers only new platform and season behaviour.
6. **Stage B status:** the roadmap no longer says the context engine is unwired. The foundation and Home migration are merged, while Matches, Match Centre, entry lock and temporal-state retirement are implemented and validated in the remaining draft stack.

## Delivered baseline

The completed Euro 2028 tournament product is preserved as the recoverable baseline. Its exact capabilities, contract and hosted-evidence boundary belong in [`quality/current-status.md`](quality/current-status.md), not in another roadmap inventory.

Remaining tournament-specific work is parked in Part I of [`../MASTER-TODO.md`](../MASTER-TODO.md) for the January 2028 return.

## Current position

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain-wide automated controls are established. The current documentation slice reconciles live status and next-step wording with implementation reality. Brand-clearance work remains separately governed by ADR 0017.

### Stage B — competition-context foundation and surface migration

Implementation sequence:

- foundation and deterministic clock/state tests merged through PR #212;
- Home migration merged through PR #219;
- Matches migration validated in draft PR #216;
- Match Centre migration validated in draft PR #222;
- entry-lock migration validated in draft PR #223;
- `MatchTemporalState` retirement validated in draft PR #224.

All internal gates are green on the final Stage B heads: build/typecheck, lint, full Vitest, production dependency audit, disposable database rebuild/lint/pgTAP/parity and authenticated browser journeys. Exact Netlify PR-preview smoke remains blocked before application loading by the unavailable preview identity.

Stage B implementation is complete, but its exit is not yet recorded on clean `main`. The remaining task is deliberate integration of the validated draft stack and rerunning the applicable clean-head gates.

## Next executable sequence

1. Integrate the remaining Stage B draft stack to clean `main` in dependency order; do not merge or rewrite around conflicts without review.
2. Resolve the exact Netlify preview-identity blocker or approve a documented alternative preview path; do not misclassify the external 404 as an application failure.
3. Confirm the shared context consumers and `MatchTemporalState` retirement on clean `main` with the applicable automated gates.
4. Begin Stage C only from that clean baseline: design the competition-season schema, deletion/anonymisation consequences and timezone contract before dependent records exist.
5. Implement Stage C as a coherent append-only development migration with canonical applied-state, environment-parity, relationship-safeguard and preservation evidence in the same change.
6. Do not mutate hosted development or production schema without the currently applicable approval, preflight and verification process.
7. Continue to Stage D ingestion only after Euro 2028 is represented as one competition season without changing its existing rules, scores or access boundaries.

## Programme and stage navigation

- Product phases, workstreams, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L, migration order and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Current implemented/hosted position: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Architecture and product decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
