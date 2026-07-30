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
- Stage C: **design baseline and all seven non-deletion pre-migration contracts are merged**. No Stage C migration exists and none is authorised. Issue #272 is the implementation critical path.

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

## Stage C design and contract baseline

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

The seven non-deletion pre-migration contracts have landed:

1. PR #274 — complete season-sensitive relation coverage;
2. PR #277 — function/RPC compatibility coverage;
3. PR #280 — retained `tournament_id` compatibility inventory;
4. PR #282 — trigger-binding coverage;
5. PR #283 — Euro structural seed preservation and same-database preservation oracle;
6. PR #286 — hostile cross-tournament relationship failures;
7. PR #292 — inclusive lock/joker boundaries and the current null-lock, reopening and per-fixture score-write defects.

They contain no Stage C implementation migration or hosted write.

## Next executable sequence

1. Preserve safeguards `CS-001` through `CS-019` and every landed before-state/preservation contract.
2. Obtain the independent data-protection review in issue #272 before implementing the auth-erasure/pseudonymised-history path. **This is the critical path.** It must record the lawful basis, erasure boundary, retention schedule, user-facing transparency, DPIA/LIA decision and technical conditions.
3. Until issue #272 is complete, do not create the Stage C migration, repoint competitive ownership, implement account deletion/anonymisation or rewrite ownership RLS. Non-destructive migration sequencing and rehearsal planning may continue only where it does not assume the review outcome.
4. After an approved or conditionally approved review, update the design and acceptance tests for any required changes, then commit the account-deletion after-state contract before SQL.
5. Maintain the exact compatibility inventory for retained `tournament_id` columns, RPC parameters and application callers. Stage C exits when **zero unreviewed tournament-only assumptions** remain, not when intentional physical names disappear.
6. Wire `tournaments.display_timezone` through the landed PR #252 seam in the Stage C implementation, remove authoritative viewer fallback and preserve viewer-local displayed kickoff times.
7. Review ACQ-R02 only on a material cap increase or adverse rehearsal/hosted concurrency evidence. The current benchmark does not justify folding a materialised standings table into Stage C.
8. Prepare one coherent append-only **development** migration only after issue #272, the final account-deletion contract and the migration plan are reviewed.
9. Before any hosted write, prove zero-to-current rebuild, database lint, pgTAP, full Database parity, generated TypeScript types, preservation and environment isolation on disposable infrastructure.
10. Obtain separate explicit owner approval before mutating hosted development or production schema.

## Parked Euro 2028 scope

The complete inventory remains in [`../MASTER-TODO.md`](../MASTER-TODO.md) for January 2028. It includes official data, final tournament presentation, administration fit-for-final verification, rehearsal, operational recovery and the published-release decision.

## Programme and stage navigation

- Product phases, discovery, design, instrumentation, cohort thresholds and go-to-market: [`architecture/programme-plan.md`](architecture/programme-plan.md).
- Engineering Stages A–L and engineering gates: [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md).
- Stage C schema design: [`architecture/stage-c-competition-season-schema.md`](architecture/stage-c-competition-season-schema.md).
- Stage C coverage manifest: [`architecture/stage-c-schema-coverage.md`](architecture/stage-c-schema-coverage.md).
- Current implementation and hosted facts: [`quality/current-status.md`](quality/current-status.md).
- Detailed active and parked tasks: [`../MASTER-TODO.md`](../MASTER-TODO.md).
- Decisions: [`adr/README.md`](adr/README.md).

When documents disagree, keep the conflict visible until deliberately reconciled. ADRs decide architecture and rules; current code/tests and verified hosted evidence decide implementation truth.
