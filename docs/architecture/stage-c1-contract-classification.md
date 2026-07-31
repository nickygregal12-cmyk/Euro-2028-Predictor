# Stage C1 contract assertion classification

**Status:** Executable C1 after-state contract  
**Date:** 31 July 2026  
**Authority:** [`stage-c1-c2-governance.md`](stage-c1-c2-governance.md), issue [#303](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/303) and blocking C2 review [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272)

## Purpose

This document classifies every assertion in the seven Stage C1 executable suites and the supporting account-deletion before-state suite. The C1 suites now describe the contract-65 after-state; the shared C2 boundary remains frozen.

The classification is executable through `tests/scripts/stageC1ContractClassification.test.ts`. A suite cannot silently gain, lose or reclassify an assertion without changing this document in the same pull request.

## Classification rules

- **`C1`** — belongs to the competition-season foundation and proves the approved contract-65 after-state.
- **`C2`** — would assert a profile-ownership, erasure, pseudonymisation or ownership-RLS after-state. No such assertion is authorised while issue #272 remains open.
- **`shared-before-state`** — freezes current auth ownership and deletion behaviour. C1 must keep it unchanged so C2 retains an exact starting point.

Current totals:

| Classification | Assertions |
| --- | ---: |
| `C1` | 45 |
| `C2` | 0 |
| `shared-before-state` | 9 |

The absence of C2 after-state assertions is deliberate, not missing coverage. Issue #272 must first record the independent review and approved boundary.

## Assertion inventory

| Source | Classification | Assertion |
| --- | --- | --- |
| `stageCRelationCoverage.test.ts` | `C1` | keeps parser positive controls at the contract-65 schema boundary |
| `stageCRelationCoverage.test.ts` | `C1` | gives every effective public table/view one reviewed disposition |
| `stageCRelationCoverage.test.ts` | `C1` | implements exactly the four reviewed C1 relations |
| `stageCFunctionCoverage.test.ts` | `C1` | keeps parser positive controls at the effective function boundary |
| `stageCFunctionCoverage.test.ts` | `C1` | pins every live public p_tournament_id signature to the manifest inventory |
| `stageCFunctionCoverage.test.ts` | `C1` | keeps every function named for Stage C review effective in migration history |
| `stageCFunctionCoverage.test.ts` | `C1` | does not silently resolve a reviewed name to multiple schemas |
| `stageCTriggerBindingCoverage.test.ts` | `C1` | keeps the parser positive control at the contract-65 trigger boundary |
| `stageCTriggerBindingCoverage.test.ts` | `C1` | reviews every effective public-table trigger binding exactly once |
| `stageCTriggerBindingCoverage.test.ts` | `C1` | keeps every named Stage C trigger authority attached |
| `stageCTournamentIdCompatibility.test.ts` | `C1` | keeps the parser positive control at the contract-65 boundary |
| `stageCTournamentIdCompatibility.test.ts` | `C1` | reviews every effective direct tournament_id column exactly once |
| `stageCTournamentIdCompatibility.test.ts` | `C1` | keeps every current direct tournament_id column non-null UUID |
| `stageCEuroSeedPreservation.test.ts` | `C1` | pins the Euro tournament identity and bounded dates |
| `stageCEuroSeedPreservation.test.ts` | `C1` | pins six groups and twenty-four placeholder team slots |
| `stageCEuroSeedPreservation.test.ts` | `C1` | pins the 36-match group-stage shape |
| `stageCEuroSeedPreservation.test.ts` | `C1` | pins the knockout source graph and round distribution |
| `stageCEuroSeedPreservation.test.ts` | `C1` | pins all 51 fixture references and the complete canonical seed payload |
| `stageCEuroSeedPreservation.test.ts` | `C1` | keeps UUID preservation as a migration-rehearsal oracle, not a seed claim |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a group-team assignment cannot cross tournaments |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a match cannot reference another tournament group |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a match cannot reference another tournament home team |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a match cannot reference another tournament away team |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a player cannot reference another tournament team |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a predicted group position cannot mix entry, group and team tournaments |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a result revision cannot claim another tournament |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a score event cannot reference another tournament match |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a score event cannot reference another tournament team |
| `031_stage_c_reference_scope_before_state.sql` | `C1` | a tournament award cannot reference another tournament player |
| `032_stage_c_lock_before_state.sql` | `C1` | a score prediction is writable before the entry and fixture locks |
| `032_stage_c_lock_before_state.sql` | `C1` | a progression prediction is writable before the entry lock |
| `032_stage_c_lock_before_state.sql` | `C1` | crossing the entry deadline records one append-only lock event |
| `032_stage_c_lock_before_state.sql` | `C1` | the score lock is inclusive at the exact entry deadline |
| `032_stage_c_lock_before_state.sql` | `C1` | the generic entry lock is inclusive at the exact deadline |
| `032_stage_c_lock_before_state.sql` | `C1` | moving lock_at into the future cannot reopen an observed entry lock |
| `032_stage_c_lock_before_state.sql` | `C1` | recorded lock evidence cannot be edited |
| `032_stage_c_lock_before_state.sql` | `C1` | a missing entry deadline fails closed before an event exists |
| `032_stage_c_lock_before_state.sql` | `C1` | legacy tournament score predictions remain writable before the entry lock even when a kickoff is not yet known |
| `032_stage_c_lock_before_state.sql` | `C1` | crossing fixture kickoff records one match lock event |
| `032_stage_c_lock_before_state.sql` | `C1` | a pure score edit is rejected at the exact fixture kickoff |
| `032_stage_c_lock_before_state.sql` | `C1` | moving kickoff into the future cannot reopen an observed fixture lock |
| `032_stage_c_lock_before_state.sql` | `C1` | a joker remains unavailable until authoritative kickoff is known |
| `032_stage_c_lock_before_state.sql` | `C1` | a joker can be committed before its known fixture kickoff |
| `032_stage_c_lock_before_state.sql` | `C1` | a committed joker cannot be cleared at the exact fixture kickoff |
| `032_stage_c_lock_before_state.sql` | `C1` | the entry lock rejects a stale score write before optimistic versioning can mask it |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | pins every reference to auth.users |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | resolves the league references to the later migration |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | leaves no reference with an undeclared action |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | names the references that block deletion outright |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | keeps the documented rationale attached to the restricting reference |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | names the references that silently destroy settled history |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | keeps audit trails attributable-or-null rather than deleted |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | carries the entry cascade into every dependent competition table |
| `accountDeletionSemantics.test.ts` | `shared-before-state` | leaves profiles with no dependants of its own |

## C1 transition rule

The two pgTAP suites now prove the approved C1 after-state. Reference-scope protections remain hostile-write guards, while lock assertions prove fail-closed missing entry timing, append-only observed lock evidence, inclusive fixture and entry boundaries, and non-reopening reschedules.

The account-deletion suite is different: every one of its assertions remains unchanged through C1. Any edit to its expected foreign-key matrix, profile dependency state or ownership consequences belongs to C2 and is blocked by issue #272.
