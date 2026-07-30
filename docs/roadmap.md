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
6. **Stage B:** merged through PR #226 as `2648540dc001c50305f1effa526fc16e43dcdb26`; PR #239 closed the retained Stage B checklist with the satisfying PRs.
7. **Control and parity foundation:** PRs #228, #229, #232, #233 and #235 are on `main`.
8. **Stage C characterisation:** PR #245 pins timezone authority and the current device-dependent day grouping; PR #246 pins the effective account-deletion foreign-key matrix. Both are tests of the current state, not fixes.
9. **Current baseline:** `main` is `972febd017dbecf0ef3b02b16b55c07c74535038`; draft PR #236 is the active design baseline and no migration exists.

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
- the Stage B checklist is retained and closed in the master inventory through PR #239.

### Landed control, parity and Stage C before-state work

- PR #228: cross-tournament read scoping, production guard derivation, real 404 routing, RPC/browser-key/reachability contracts.
- PR #229: Original Predictor scoring parity.
- PR #232: all Database parity subjects execute under the disposable Supabase harness.
- PR #233: CSP/application resource parity.
- PR #235: complete `VITE_*` environment contract plus deployment-RPC/database-privilege parity.
- PR #245: lock and match-state timezone independence, the closed set of four device-timezone readers, current day-grouping divergence and invalid-zone fail-quiet behaviour.
- PR #246: effective account-deletion actions across every `auth.users` reference, including history-destroying cascades, deliberate league-owner restrict, audit set-null actions and the undeclared Predictor Cup winner action.

PRs #245 and #246 create the reviewable **before-side** of Stage C. Their current expectations must change visibly when the design is implemented.

### Stage C — active design

Draft PR #236 defines:

- stable competition identity and shared competition-season scope;
- additive in-place evolution of `tournaments`/`tournament_id` rather than a parallel season implementation;
- generic rounds/matchweeks and monotonic lock-transition evidence;
- composite same-season relationship safeguards;
- `profiles.id` as the durable pseudonymisable competitive anchor;
- UTC lock/outcome authority, competition-timezone calendar grouping and viewer-local clock display;
- deletion/archive consequences and the data-protection dependency;
- complete current table, function, trigger, RLS and RPC coverage;
- Euro preservation, hostile cross-season and before/after characterisation tests.

It contains no migration or hosted write.

## Next executable sequence

1. Review and intentionally approve draft PR #236 as the consolidated Stage C design baseline. The owner decisions on season tie-breaks, account deletion and timezone authority are already recorded; review now concerns completeness, safety and implementation boundaries.
2. Resolve design review comments without creating SQL or weakening safeguards `CS-001` through `CS-018`.
3. Treat the landed tests as mandatory before-state contracts:
   - PR #245 must change from device-dependent day grouping to competition-timezone grouping while preserving timezone-free locks and viewer-local displayed clocks;
   - invalid stored competition timezones must fail closed or surface an explicit unavailable state, not silently produce an empty day;
   - PR #246 must change from direct `auth.users` competitive ownership to the approved pseudonymised-profile model while preserving deliberate audit and housekeeping semantics;
   - every current and future `auth.users` reference must retain an explicit reviewed deletion action.
4. After design approval, commit the remaining pre-migration contract tests first:
   - complete season-sensitive object coverage;
   - hostile cross-season relationship failures;
   - lock monotonicity and per-fixture late-write rejection;
   - RLS/grant/function-exposure rules;
   - Euro identifier, score, rank, access and Stage B context preservation;
   - account deletion preserving totals, ranks, league membership and settled outcomes.
5. Maintain an exact compatibility inventory for retained `tournament_id` columns, RPC parameters and application callers. Stage C exits when **zero unreviewed tournament-only assumptions** remain, not when the intentional physical names disappear.
6. Obtain the required data-protection review before implementing the auth-erasure/pseudonymised-history schema path.
7. Create one coherent append-only **development** migration only after the tests and migration plan are reviewed.
8. Prove zero-to-current rebuild, database lint, pgTAP, full Database parity, generated TypeScript types, preservation and environment isolation on disposable infrastructure.
9. Do not mutate hosted development or production schema without a separate explicit approval, preflight and verification process.

## Programme and stage navigation

- Product phases, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C proposed schema: `docs/architecture/stage-c-competition-season-schema.md` in draft PR #236.
- Stage C coverage manifest: `docs/architecture/stage-c-schema-coverage.md` in draft PR #236.
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When these documents disagree, the conflict remains visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.