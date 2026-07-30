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
- production Netlify: ready deploy `6a6b84f20937ff0008c07ccd` from commit `ce17a7fd`. **Deploys are paused from contract 64 onward** by the prebuild contract gate until production Supabase receives the migration. The last good deploy stays live;
- Euro 2028: recoverable at `euro-2028-baseline` at contract 63, with remaining tournament work parked until January 2028;
- Stage B: complete through PR #226, with the retained checklist closed by PR #239;
- Stage C: **design baseline merged** (PR #236, 30 July 2026). Five of the seven pre-migration contract suites have landed. No Stage C migration exists and none is authorised.

## Delivered foundation

### Stage A — authority and control alignment

The platform ADRs, parent/child planning hierarchy, state architecture and domain controls are established. Brand clearance remains separately governed by ADR 0017.

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

PRs #245 and #246 remain before-state contracts. PR #252 is the application seam. PRs #250, #255, #258, #261, #264 and #265 are preservation invariants.

## Stage C design baseline

PR #236 — **merged 30 July 2026** — defines:

- stable competition identity and shared competition-season scope;
- additive in-place evolution of `tournaments`/`tournament_id` rather than a parallel season implementation;
- generic rounds/matchweeks and monotonic lock-transition evidence;
- composite same-season relationship safeguards;
- `profiles.id` as the durable pseudonymisable competitive anchor;
- persisted competition timezone wired through the landed seam, with viewer-local clock display;
- invalid competition-timezone rejection and explicit unavailable/fail-closed handling;
- deletion/archive consequences and the data-protection dependency;
- complete current table, function, trigger, RLS, grant and RPC coverage;
- Euro preservation, hostile cross-season and before/after characterisation tests.

It contains no migration or hosted write.

## Next executable sequence

1. ~~Intentionally approve and integrate PR #236 as the consolidated Stage C **design baseline only**.~~ **Done** — merged 30 July 2026. It authorises pre-migration contract-test planning, not SQL or a hosted schema operation.
2. Preserve safeguards `CS-001` through `CS-019` and the landed controls from PRs #245, #246, #250, #252, #255, #258, #261, #264 and #265.
3. Obtain the required data-protection review before implementing the auth-erasure/pseudonymised-history path. **This is the critical path.** Stages D through H all sit behind Stage C, and Stage C sits behind this review. It is a decision, not an engineering task.
4. Commit the remaining pre-migration contract tests first. Five of seven have landed:
   - ✅ complete season-sensitive object coverage — `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility`;
   - ⬜ **hostile cross-season relationship failures** — draft PR #286;
   - ⬜ **lock monotonicity and per-fixture late-write rejection** — not started; buildable against the current schema without waiting on anything;
   - ✅ RLS, grants, function exposure and direct Data API surface — PRs #250 and #265;
   - ✅ Euro identifier, score, rank, access and Stage B context preservation — `stageCEuroSeedPreservation`;
   - 🟡 account deletion preserving totals, ranks, league membership and settled outcomes — PR #246 pins the before-state and PR #271 declares the last undeclared action; the after-state waits on item 3;
   - 🟡 persisted competition timezone replacing viewer fallback — PR #252 landed the seam; persistence is Stage C itself.
5. Maintain an exact compatibility inventory for retained `tournament_id` columns, RPC parameters and application callers. Stage C exits when **zero unreviewed tournament-only assumptions** remain, not when intentional physical names disappear.
6. Review ACQ-R02 only on a material cap increase or adverse rehearsal/hosted concurrency evidence. The current benchmark does not justify folding a materialised standings table into Stage C.
7. Prepare one coherent append-only **development** migration only after the tests, migration plan and data-protection boundary are reviewed.
8. Before any hosted write, prove zero-to-current rebuild, database lint, pgTAP, full Database parity, generated TypeScript types, preservation and environment isolation on disposable infrastructure.
9. Obtain separate explicit owner approval before mutating hosted development or production schema.

## Parked Euro 2028 scope

The complete inventory remains in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028. It includes official data, final tournament presentation, administration fit-for-final verification, rehearsal, operational recovery and the published-release decision.

## Programme and stage navigation

- Product phases, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C proposed schema and coverage manifest: draft PR #236.
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When documents disagree, keep the conflict visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.