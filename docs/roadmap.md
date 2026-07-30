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

1. **Parent/child authority:** the programme plan, not the engineering plan, is the parent programme.
2. **Stage B order:** the implemented sequence was `homeDashboard → matchesTab → matchCentre → entryLock`, each with pre-migration differential evidence.
3. **Design and instrumentation:** information architecture, prototype testing, visual direction and event taxonomy belong to programme Phase 1 before Stages E–H implement screens.
4. **Launch and acquisition:** Stage J is launch readiness and go-to-market, with the programme window beginning in February 2027.
5. **Bonus Games Browser E2E:** PR #187 already supplies authenticated desktop/phone lifecycle proof for all three Bonus Games.
6. **Stage B:** merged through PR #226 as `2648540dc001c50305f1effa526fc16e43dcdb26`; the superseded Stage B stack is closed and its completed checklist remains in `MASTER-TODO.md`.
7. **Control and parity foundation:** PRs #228, #229, #232, #233 and #235 are on `main` through `2c57898d2eefed943a24bfe342d6da227bdd5267`.
8. **Stage C:** draft PR #236 is the active design baseline. No migration exists.

## Delivered baseline

The completed Euro 2028 tournament product is preserved as the recoverable baseline. Exact implementation and hosted evidence belong in [`quality/current-status.md`](quality/current-status.md). Remaining tournament-specific work stays parked in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028.

## Current position

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain-wide controls are established. Brand clearance remains separately governed by ADR 0017.

### Stage B — competition-context foundation and surface migration

Complete on `main`:

- foundation and deterministic clock/state tests through PR #212;
- Home migration through PR #219;
- Matches, Match Centre, entry lock and `MatchTemporalState` retirement through PR #226;
- full clean-main application, database, preview and authenticated-browser gates passed before merge;
- the Stage B checklist is retained and closed in the master inventory.

### Landed control and parity work

- PR #228: cross-tournament read scoping, production guard derivation, real 404 routing, RPC/browser-key/reachability contracts.
- PR #229: Original Predictor scoring parity.
- PR #232: all Database parity subjects execute under the disposable Supabase harness.
- PR #233: CSP/application resource parity.
- PR #235: complete `VITE_*` environment contract plus deployment-RPC/database-privilege parity.

### Stage C — active design

Draft PR #236 defines:

- stable competition identity and shared competition-season scope;
- in-place evolution of the existing tournament tables rather than a parallel season implementation;
- generic rounds/matchweeks and monotonic lock events;
- composite same-season relationship safeguards;
- timezone authority;
- durable anonymisable competitor identity and deletion/archive consequences;
- complete current table, function, trigger, RLS and RPC coverage;
- Euro preservation and hostile cross-season exit tests.

It contains no migration or hosted write.

## Next executable sequence

1. Review draft PR #236 as the Stage C design baseline. Decide whether the shared root, competitor identity, round/lock model, deletion/archive rules and in-place rename strategy are accepted.
2. Resolve design review comments without creating SQL or weakening safeguards `CS-001` through `CS-014`.
3. After design approval, commit pre-migration contract tests first:
   - complete season-sensitive object coverage;
   - hostile cross-season relationship failures;
   - lock monotonicity and per-fixture late-write rejection;
   - RLS/grant/function-exposure rules;
   - Euro identifier, score, rank, access and Stage B context preservation.
4. Define the exact compatibility allowlist for existing `tournament_id` columns, RPC parameters and application callers; the allowlist must be empty before Stage C exits.
5. Create one coherent append-only **development** migration only after the tests and migration plan are reviewed.
6. Prove zero-to-current rebuild, database lint, pgTAP, full Database parity, generated TypeScript types, preservation and environment isolation on disposable infrastructure.
7. Do not mutate hosted development or production schema without a separate explicit approval, preflight and verification process.

## Programme and stage navigation

- Product phases, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C proposed schema: `docs/architecture/stage-c-competition-season-schema.md` in draft PR #236.
- Stage C coverage manifest: `docs/architecture/stage-c-schema-coverage.md` in draft PR #236.
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
