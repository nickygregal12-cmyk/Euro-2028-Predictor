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
2. **Surface migration order:** Stage B followed the child plan's `homeDashboard → matchesTab → matchCentre → entryLock` sequence, each with pre-migration differential evidence.
3. **Design and instrumentation:** information architecture, prototype testing, visual direction and event-taxonomy definition belong to programme **Phase 1** before Stages E–H implement screens. Stage H implements validated output rather than designing alongside construction.
4. **Launch and acquisition:** Stage J is launch readiness **and go-to-market**, with the programme window beginning in **February 2027**.
5. **Bonus Games Browser E2E:** PR #187 already supplies authenticated desktop/phone lifecycle proof for all three Bonus Games; new work covers only new platform and season behaviour.
6. **Stage B status:** the complete competition-context adoption sequence merged through PR #226 as `2648540dc001c50305f1effa526fc16e43dcdb26`; the superseded Stage B PR stack is closed.
7. **Concurrent prerequisite:** PR #228 is independently green and unmerged. Its cross-tournament read scoping and guard repairs must be resolved before Stage C creates additional competition-season records.

## Delivered baseline

The completed Euro 2028 tournament product is preserved as the recoverable baseline. Its exact capabilities, contract and hosted-evidence boundary belong in [`quality/current-status.md`](quality/current-status.md), not in another roadmap inventory.

Remaining tournament-specific work is parked in Part I of [`../MASTER-TODO.md`](../MASTER-TODO.md) for the January 2028 return.

## Current position

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain-wide automated controls are established. Brand-clearance work remains separately governed by ADR 0017.

### Stage B — competition-context foundation and surface migration

Stage B is complete on `main`:

- foundation and deterministic clock/state tests merged through PR #212;
- Home migration merged through PR #219;
- Matches, Match Centre, entry lock and `MatchTemporalState` retirement integrated through PR #226;
- the clean-main candidate passed build/typecheck, lint, full Vitest, dependency audit, Database parity, exact preview smoke, authenticated journeys, signup and recovery;
- PR #226 merged as `2648540dc001c50305f1effa526fc16e43dcdb26`;
- the superseded Stage B PRs were closed.

### Active prerequisite — PR #228

PR #228 at `86a02ab1e7f44cb42718dada13de94e66ea0dcd6` is mergeable and fully green. It is not a Stage C implementation and adds no migration. It repairs production guard derivation, cross-tournament `group_teams` scoping, real 404 routing, RPC contract enforcement, browser-key validation and TypeScript/SQL parity coverage.

The `group_teams` fix is a direct prerequisite to introducing a second competition or season because the current `main` query can blend rows from multiple tournaments. Stage C must not work around or duplicate this pending fix.

## Next executable sequence

1. Review PR #228 against current `main` and confirm its exact head remains `86a02ab1e7f44cb42718dada13de94e66ea0dcd6` with green CI, Database parity, exact preview smoke and authenticated Browser E2E.
2. Obtain an intentional owner merge decision for PR #228. Merging to `main` automatically publishes Netlify and changes routing/environment guard behaviour, so it is not an implicit housekeeping merge.
3. After PR #228 lands, verify the exact `main` release identity and confirm the guard/scoping changes survived the merge without running a production database write.
4. Begin Stage C with a reviewed competition-season schema design covering identifiers, scoping, timezone authority, deletion/anonymisation consequences, independent entries/standings/history and existing relationship safeguards.
5. Implement Stage C as a coherent append-only **development** migration with canonical applied-state, environment-parity, relationship-safeguard and preservation evidence in the same change.
6. Do not mutate hosted development or production schema without the currently applicable approval, preflight and verification process.

## Programme and stage navigation

- Product phases, workstreams, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L, migration order and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Current implemented/hosted position: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Architecture and product decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
