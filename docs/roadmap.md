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
- Stage C: design baseline, assertion classification, C2 non-interference and the detailed C1 schema overlay are complete. No Stage C migration exists and no hosted schema write is authorised.

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
- Original Stage C TypeScript contracts: `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility` and `stageCEuroSeedPreservation`.
- Hostile reference before-state: `031_stage_c_reference_scope_before_state.sql` (PR #286).
- Lock and late-write before-state: `032_stage_c_lock_before_state.sql` (PR #292).
- C1 boundary: `stageC1ContractClassification.test.ts` enforces the 40/0/9 assertion split; `stageC1NonInterference` freezes auth ownership, deletion FKs and ownership RLS.
- C1 overlay: `stageC1SchemaOverlayCoverage.test.ts` proves every original relation and reviewed function has a current C1/C2/shared disposition.
- PRs #319–#340 (31 July 2026): gate integrity and accessibility enforcement. CI refuses to pass a suite that discovered no test files; the browser-suite path filter now watches what its jobs read, including the deployment contract; the deploy smoke compares served security headers against the committed ones rather than checking four of thirteen directives; every `e2e` spec is proven to run under exactly one Playwright config with a project gate that exists. Accessibility moved from a scan over 11 of 34 routes to every declared route plus the component gallery, component states no route renders, the design-token contrast matrix and the declared CSS pairings — with axe's `incomplete` results counted, not discarded. Thirteen real defects were found and fixed, and the palette was raised so every text pairing meets AA (`--gold-strong` added; the light muted ramp rebalanced). Two accessibility deferrals remain, both "covered elsewhere" rather than gaps.

PRs #245 and #246 remain before-state contracts. PR #252 is the application seam. PRs #250, #255, #258, #261, #264 and #265 are preservation invariants.

## Stage C design and governance

PR #236 — **merged 30 July 2026** — remains the original combined design record.

The accepted implementation authority is now:

- [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md) — C1/C2 split;
- [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md) — 40 C1, zero authorised C2 after-state and nine shared-before-state assertions;
- [`architecture/stage-c1-schema-overlay.md`](architecture/stage-c1-schema-overlay.md) — relation, function, RLS, migration-order and evidence dispositions for C1.

Stage C1 keeps current auth-owned competitive rows unchanged and is tracked by issue #303. Stage C2 remains blocked by the independent data-protection review in issue #272.

None of these documents authorises a migration or hosted write.

## Owner-approved delivery order — 1 August 2026

The owner set the following order for the hub conversion. Items 1 and 2 are done.

1. ~~Amending ADR resolving the five conflicting domestic rules.~~ **Done** — ADR 0020, PR #346.
2. ~~Hub shell: stale E2E assertions, My competitions and Discover.~~ **Done** — PR #346.
3. **Blocked.** Complete the PR #317 migration and recovery review, then merge. The review found two defects. The PostgREST embed defect is fixed on the branch and took the browser suite from 37 failures to 6. The remaining six are one unresolved defect: the migration makes the entry lock irreversible, so a tournament whose `lock_at` has ever passed can never accept a prediction again. Resolving that is a lock-semantics decision and needs owner direction — see the entry-lock row in [`quality/current-status.md`](quality/current-status.md). Reconciling the branch with `main` is separately required and has been proven to merge cleanly with all checks green locally.
4. Apply contract 65 to **development only**, under a separate approved preflight. Production stays at 63 and paused.
5. Refactor lock policy to be game-owned, including per-game `bufferMinutes`.
6. Stage C1b: competition membership, game catalogue, game availability, game membership, active/inactive state and join/leave/rejoin audit history.
7. Seed Premier League 2026/27 and Scottish Premiership 2026/27.
8. Build the domestic Main Predictor, then domestic Jokers.
9. Provider adapters with one provisional primary and two shadow comparators.
10. Predictor Championship on the existing ADR 0014 format model.
11. Domestic Last Man Standing on ADR 0013.

Two product decisions remain genuinely open and block none of the above: which football API becomes the long-term primary provider, and the future public hub domain.

## Next executable sequence

1. ~~Approve and integrate PR #236 as the Stage C design baseline.~~ **Done.**
2. ~~Land the original pre-migration contract inventory and C1 boundary guard.~~ **Done.**
3. ~~Split C1 from C2 and keep the legal review scoped to profile ownership/deletion.~~ **Done.**
4. ~~Reconcile every combined Stage C relation, function, RLS and evidence instruction.~~ **Done through the C1 schema overlay and `stageC1SchemaOverlayCoverage.test.ts`.** The overlay covers 35 current relations/view, four proposed C1 relations and 51 reviewed functions, while preserving PR #246 unchanged.
5. **Prepare and review the exact append-only development-intent C1 migration.** It must follow the overlay sequence, retain all physical compatibility names, and contain no profile ownership, erasure, pseudonymisation or C2 RLS change.
6. Maintain the exact compatibility inventory for retained `tournament_id` columns, RPC parameters and application callers. C1 exits when zero unreviewed tournament-only assumptions remain, not when intentional physical names disappear.
7. Prove the proposed migration before any hosted write: zero-to-current rebuild, database lint, all pgTAP, full Database parity, generated TypeScript types, Euro preservation and environment isolation.
8. Review the exact migration diff and rollback/recovery evidence, then obtain action-specific owner approval before mutating hosted development.
9. Keep production at contract 63 and paused. Production promotion is a separate intentional release milestone, not part of C1 development completion.
10. Complete C2 only after issue #272 records an independent review and the approved retention/erasure boundary is reflected in design and tests.
11. Review ACQ-R02 only on a material cap increase or adverse rehearsal/hosted concurrency evidence; no materialised standings table belongs in C1 by default.

## Parked Euro 2028 scope

The complete inventory remains in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028. It includes official data, final tournament presentation, administration fit-for-final verification, rehearsal, operational recovery and the published-release decision.

## Programme and stage navigation

- Product phases, discovery, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C implementation split: [`architecture/stage-c1-c2-governance.md`](architecture/stage-c1-c2-governance.md).
- Stage C assertion boundary: [`architecture/stage-c1-contract-classification.md`](architecture/stage-c1-contract-classification.md).
- Stage C1 implementation overlay: [`architecture/stage-c1-schema-overlay.md`](architecture/stage-c1-schema-overlay.md).
- Original combined Stage C design and coverage: [`architecture/stage-c-competition-season-schema.md`](architecture/stage-c-competition-season-schema.md) and [`architecture/stage-c-schema-coverage.md`](architecture/stage-c-schema-coverage.md).
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When documents disagree, keep the conflict visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
