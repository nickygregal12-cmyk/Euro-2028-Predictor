# Multi-competition platform — roadmap

**Status date:** 2 August 2026  
**Purpose:** current delivery position and next executable slice.  
**Current facts:** [`quality/current-status.md`](quality/current-status.md)  
**Parent programme:** [`architecture/programme-plan.md`](architecture/programme-plan.md)  
**Engineering workstream:** [`architecture/multi-competition-hub-build-plan.md`](architecture/multi-competition-hub-build-plan.md)  
**Detailed inventory:** [`../MASTER-TODO.md`](../MASTER-TODO.md)  
**Decision authority:** [`adr/README.md`](adr/README.md)

This roadmap does **not** duplicate the programme phases or Stage A–L engineering plan. It records where delivery is now and the next executable sequence.

## Current baseline

- `main`: read the current commit from git rather than from this line. The previous hand-copied SHA stayed here through roughly twenty-five subsequent merges, which is what a pinned SHA in a live document does;
- repository contract: **65** (Stage C1 merged), development Supabase **64** (Stage C1 hosted apply owner-gated on the `SUPABASE_DEV_DB_URL` Session pooler secret), production Supabase **63**;
- production Netlify: ready deploy `6a6b84f20937ff0008c07ccd` from commit `ce17a7fd`. **Deploys are paused from contract 64 onward** by the prebuild contract gate until an intentional production migration/release milestone. The last good deploy stays live;
- Euro 2028: recoverable at `euro-2028-baseline` at contract 63, with remaining tournament work parked until January 2028;
- Stage B: complete through PR #226, with the retained checklist closed by PR #239;
- Stage C: design baseline, assertion classification, C2 non-interference and the detailed C1 schema overlay are complete. The Stage C1 migration is merged at repository contract 65 (PRs #317, #349) with hosted rollout tooling and a guarded GitHub workflow (PRs #350, #351); the hosted development apply awaits the owner secret fix. No production write is authorised;
- lock policy is **game-owned** (ADR 0020, PR #353): the competition supplies identity, calendar and structure; each game supplies its own explicit lock policy, failing closed when missing or incompatible.

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
- C1 lock-function consistency: `stageC1LockFunctionConsistency.test.ts` compares the entry-lock trigger definitions to each other. The migration defines each twice because the season-scope backfill writes to lock-guarded tables, and the second definition of the generic guard had drifted to `security definer` + `session_user` — which left the trusted automatic-submission refresh permanently unreachable. `pg_proc` cannot see this, because the live database only shows the last definition.
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

## Next executable sequence

1. ~~Approve and integrate PR #236 as the Stage C design baseline.~~ **Done.**
2. ~~Land the original pre-migration contract inventory and C1 boundary guard.~~ **Done.**
3. ~~Split C1 from C2 and keep the legal review scoped to profile ownership/deletion.~~ **Done.**
4. ~~Reconcile every combined Stage C relation, function, RLS and evidence instruction.~~ **Done through the C1 schema overlay and `stageC1SchemaOverlayCoverage.test.ts`.** The overlay covers 35 current relations/view, four proposed C1 relations and 51 reviewed functions, while preserving PR #246 unchanged.
5. ~~Prepare and review the exact append-only development-intent C1 migration.~~ **Done — merged at contract 65 (PRs #317, #349), proven on disposable infrastructure (rebuild, lint, pgTAP, parity, Euro preservation).**
6. ~~Move lock policy from the competition to the selected game per ADR 0020.~~ **Done — PR #353.**
7. **Complete the guarded Stage C1 development rollout** (workflow from PR #351): prepare mode (preflight, encrypted backup, restore rehearsal, one-migration dry run), then apply mode, hosted postflight and authenticated smoke. **Blocked on one owner action:** replace `SUPABASE_DEV_DB_URL` with the raw Session pooler PostgreSQL URI for `iouzoutneyjpugbbtdem`. After postflight, align non-production Netlify (Development, branch deploys, deploy previews) to contract 65; production Netlify stays 63.
8. **C1b — persistent game catalogue and memberships as contract 66** (after development is hosted at 65): game definitions, per-competition-season availability, one entry per competition-season game with joined/left/disqualified state and append-only join/leave/rejoin evidence; separate membership for Main Predictor, LMS and Predictor Championship; seeds for Premier League 2026/27, Scottish Premiership 2026/27 and Euro 2028. Extend the existing `bonus_competition_*`/`entries` structures where safe rather than duplicating them. No C2 content.
9. **Provider-ingestion custody as contract 67**: recreate PR #352's strict decoders, archive-before-decode custody, server-only Edge Function and canonical identity mapping on top of C1b; do not merge its stale contract-66 migration.
10. **Domestic Main Predictor vertical slice** (ADR 0012 as amended by ADR 0020): one generic implementation serving Premier League and Scottish Premiership — entries, matchweeks, score predictions, ten whole-matchweek Jokers split five/five, zero-buffer matchweek locks, automatic submission, separate domestic scoring authority with TypeScript/PostgreSQL parity, standings, audited fixture reassignment.
11. Keep production at contract 63 and paused. Production promotion is a separate intentional release milestone.
12. Complete C2 only after issue #272 records an independent review and the approved retention/erasure boundary is reflected in design and tests.
13. Review ACQ-R02 only on a material cap increase or adverse rehearsal/hosted concurrency evidence.

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
