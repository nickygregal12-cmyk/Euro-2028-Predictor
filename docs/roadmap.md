# Multi-competition platform — roadmap

**Status date:** 30 July 2026  
**Purpose:** current delivery position and next executable slice.  
**Current facts:** [`quality/current-status.md`](quality/current-status.md)  
**Parent programme:** [`architecture/programme-plan.md`](architecture/programme-plan.md)  
**Engineering workstream:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)  
**Detailed inventory:** [`../MASTER-TODO.md`](../MASTER-TODO.md)  
**Decision authority:** [`adr/README.md`](adr/README.md)

This roadmap does **not** duplicate the programme phases or Stage A–L engineering plan. It records where delivery is now and the next executable sequence.

## Current baseline

- `main`: read the current commit from git rather than from this line. The previous hand-copied SHA stayed here through roughly twenty-five subsequent merges, which is what a pinned SHA in a live document does;
- repository contract: **64**, development Supabase **64**, production Supabase **63**;
- production Netlify: ready deploy `6a6b84f20937ff0008c07ccd` from commit `ce17a7fd`. **Deploys are paused from contract 64 onward** by the prebuild contract gate until an intentional production migration/release milestone. The last good deploy stays live;
- Euro 2028: recoverable at `euro-2028-baseline` at contract 63, with remaining tournament work parked until January 2028;
- Stage B: complete through PR #226, with the retained checklist closed by PR #239;
- Stage C: **design baseline merged** (PR #236), all seven original pre-migration suites landed, and the C1 assertion/non-interference boundary is executable. The owner-approved governance amendment splits implementation into C1 and C2. No Stage C migration exists and no hosted schema write is authorised.

## Delivered foundation

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain controls are established. Brand selection is deferred with a trigger under ADR 0019 and is not on the engineering critical path.

### Stage B — competition-context foundation and surface migration

Complete on `main`:

- pure context, lock and match-state foundation through PR #212;
- Home migration through PR #219;
- Matches, Match Centre, entry lock and `MatchTemporalState` retirement through PR #226;
- clean application, database, preview and authenticated-browser gates before integration;
- retained inventory closure through PR #239.

### Landed control and Stage C preparation

- PR #228: cross-tournament read scoping, production guard derivation, real 404 routing and deployment-contract controls.
- PR #229: Original Predictor scoring parity.
- PR #232: complete Database parity directory execution.
- PR #233: CSP/application resource parity.
- PR #235: environment and deployment-RPC/database-privilege parity.
- PR #245: timezone-authority before-state.
- PR #246: effective account-deletion action before-state.
- PR #250: exhaustive public-table RLS and security-definer `search_path` guard.
- PR #252: `competitionTimeZone`/`viewerTimeZone` seam with temporary viewer fallback.
- PR #255: TypeScript test project and corrected timezone fixtures.
- PR #258: Playwright/e2e, TypeScript tool and config coverage.
- PR #261: production-smoke coverage, explicit strictness and exhaustive committed TS/TSX project guard.
- PR #264: typechecking for the three JavaScript deploy gates and an explicit deferred JavaScript inventory.
- PR #265: exhaustive public-view and direct browser relation-grant guard.
- PR #266: disposable-local leaderboard scale evidence; ACQ-R02 remains open and no standings migration was introduced.
- PR #286: hostile cross-season/reference before-state pgTAP.
- PR #292: lock monotonicity and per-fixture late-write before-state pgTAP.
- C1 boundary: `stageC1ContractClassification.test.ts` enforces the 40/0/9 assertion split; `stageC1NonInterference` freezes auth ownership, deletion FKs and ownership RLS.

PRs #245 and #246 remain before-state contracts. PR #252 is the application seam. PRs #250, #255, #258, #261, #264 and #265 are preservation invariants.

## Stage C design and governance

PR #236 — **merged 30 July 2026** — records the combined design for:

- stable competition identity and shared competition-season scope;
- additive in-place evolution of `tournaments`/`tournament_id` rather than a parallel season implementation;
- generic rounds/matchweeks and monotonic lock-transition evidence;
- composite same-season relationship safeguards;
- a proposed profile-owned pseudonymisable competitive anchor;
- persisted competition timezone wired through the landed seam;
- complete object coverage and Euro preservation evidence.

The accepted [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md) amendment controls implementation order:

- **Stage C1:** competition-season identity, fields, rounds, timezone, locks, same-season safeguards and Euro preservation. C1 keeps current auth-owned competitive rows unchanged and is tracked by issue #303.
- **Stage C2:** profile ownership, account erasure, pseudonymisation and related RLS. C2 remains blocked by the independent data-protection review in issue #272.

[`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md) makes the test boundary explicit: 40 C1 assertions, zero authorised C2 after-state assertions and nine shared-before-state assertions.

None of these documents authorises a migration or hosted write.

## Next executable sequence

1. ~~Approve and integrate PR #236 as the Stage C design baseline.~~ **Done.**
2. ~~Land the original pre-migration contract inventory and C1 boundary guard.~~ **Done.** The inventory remains pinned by `tests/scripts/stageCContractInventory.test.ts`:
   - ✅ season-sensitive object coverage — `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility`;
   - ✅ hostile cross-season/reference failures — `031_stage_c_reference_scope_before_state.sql` (PR #286);
   - ✅ lock monotonicity and per-fixture rejection — `032_stage_c_lock_before_state.sql` (PR #292);
   - ✅ RLS, grants, function exposure and direct Data API surface — PRs #250 and #265;
   - ✅ Euro identifier, score, rank, access and Stage B context preservation — `stageCEuroSeedPreservation`;
   - ✅ C1/C2 non-interference — `stageC1NonInterference`;
   - ✅ assertion classification — `stageC1ContractClassification.test.ts` and the 40/0/9 classification document;
   - 🟡 account-deletion after-state — deliberately absent, owned by C2 and blocked by issue #272;
   - 🟡 persisted competition timezone after-state — owned by C1 migration work.
3. ~~Choose whether the legal review blocks all of Stage C or only deletion/profile ownership.~~ **Done — split C1/C2.** The decision is recorded in the governance amendment, issue #303 and issue #272.
4. **Reconcile the detailed combined Stage C design and coverage manifest.** Assertion classification, PR #246 preservation and the executable non-interference guard are complete. Remaining work is to rewrite each combined after-state disposition as C1, C2 or shared-before-state without changing the approved C1 scope.
5. Maintain the exact compatibility inventory for retained `tournament_id` columns, RPC parameters and application callers. C1 exits when zero unreviewed tournament-only assumptions remain, not when intentional physical names disappear.
6. Prepare one coherent append-only **development-intent C1 migration** only after item 4 is reviewed. It must contain no profile ownership, erasure, pseudonymisation or C2 RLS change.
7. Before any hosted write, prove zero-to-current rebuild, database lint, pgTAP, full Database parity, generated TypeScript types, Euro preservation and environment isolation on disposable infrastructure.
8. Obtain action-specific owner approval before mutating hosted development. Production remains at contract 63 and paused.
9. Complete C2 only after issue #272 records an independent review and the approved retention/erasure boundary is reflected in design and tests.
10. Review ACQ-R02 only on a material cap increase or adverse rehearsal/hosted concurrency evidence; no materialised standings table belongs in C1 by default.

## Parked Euro 2028 scope

The complete inventory remains in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028. It includes official data, final tournament presentation, administration fit-for-final verification, rehearsal, operational recovery and the published-release decision.

## Programme and stage navigation

- Product phases, discovery, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C implementation split: [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md).
- Stage C assertion boundary: [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md).
- Detailed Stage C design and coverage: [`architecture/stage-c-competition-season-schema.md`](architecture/stage-c-competition-season-schema.md) and [`architecture/stage-c-schema-coverage.md`](architecture/stage-c-schema-coverage.md).
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When documents disagree, keep the conflict visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
