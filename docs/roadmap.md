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
6. **Stage B status:** the foundation and Home migration are merged, while Matches, Match Centre, entry lock and temporal-state retirement are assembled on the clean-main integration candidate.

## Delivered baseline

The completed Euro 2028 tournament product is preserved as the recoverable baseline. Its exact capabilities, contract and hosted-evidence boundary belong in [`quality/current-status.md`](quality/current-status.md), not in another roadmap inventory.

Remaining tournament-specific work is parked in Part I of [`../MASTER-TODO.md`](../MASTER-TODO.md) for the January 2028 return.

## Current position

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain-wide automated controls are established. Brand-clearance work remains separately governed by ADR 0017.

### Stage B — competition-context foundation and surface migration

Implementation sequence:

- foundation and deterministic clock/state tests merged through PR #212;
- Home migration merged through PR #219;
- Matches migration validated in draft PR #216;
- Match Centre migration validated in draft PR #222;
- entry-lock migration validated in draft PR #223;
- `MatchTemporalState` retirement validated in draft PR #224;
- clean-main integration candidate assembled in draft PR #226.

Stage B implementation is complete. Its exit now depends on green clean-main integration gates and an intentional merge decision; Stage C must not begin from the candidate branch alone.

## Next executable sequence

1. Run the full clean-main gate set on PR #226: build/typecheck, lint, full Vitest, dependency audit, Database parity, authenticated browser journeys and exact Netlify preview smoke.
2. Resolve only integration-attributable failures; do not weaken differential evidence or bypass the shared context authority.
3. Review the final PR #226 diff and exact release identity.
4. Obtain an intentional merge decision for PR #226; do not merge automatically.
5. After Stage B exists on clean `main`, begin Stage C by designing the competition-season schema, deletion/anonymisation consequences and timezone contract before dependent records exist.
6. Implement Stage C as a coherent append-only development migration with canonical applied-state, environment-parity, relationship-safeguard and preservation evidence in the same change.
7. Do not mutate hosted development or production schema without the currently applicable approval, preflight and verification process.

## Programme and stage navigation

- Product phases, workstreams, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L, migration order and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Current implemented/hosted position: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Architecture and product decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
