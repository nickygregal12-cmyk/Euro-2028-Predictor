# Stage C governance amendment — C1 foundation and C2 deletion boundary

**Status:** Accepted owner decision  
**Date:** 30 July 2026  
**Issue authority:** [#303](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/303) for Stage C1 and [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) for Stage C2  
**Assertion classification:** [`stage-c1-contract-classification.md`](stage-c1-contract-classification.md)  
**C1 implementation overlay:** [`stage-c1-schema-overlay.md`](stage-c1-schema-overlay.md)  
**Amends:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md) and [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Decision

The previously approved combined Stage C design is split into two independently governed implementation slices.

This amendment controls implementation order wherever the combined design or coverage manifest appears to require profile ownership and competition-season foundation changes in one migration. The original documents remain the detailed design record. The C1 schema overlay is the implementation authority for relation, function, RLS, migration-order and evidence dispositions.

## Stage C1 — competition-season foundation

Stage C1 may progress through contract-protected migration planning and a separately reviewed development-only migration.

It includes:

- the stable `competitions` parent identity;
- additive `competition_id`, `season_key`, `kind`, validated `display_timezone` and lifecycle `status` fields on the existing `tournaments` root;
- generic competition rounds and matchweeks;
- append-only monotonic lock-transition evidence and per-fixture late-write rejection;
- same-competition-season constraints and validators that broaden current same-tournament safeguards without weakening them;
- persisted competition timezone through the landed competition/viewer timezone seam;
- Euro 2028 backfill and preservation of identifiers, rules, scores, ranks, entries, leagues, Bonus Games and access boundaries;
- generated database types, TypeScript/application compatibility and the full disposable Database parity evidence set.

Stage C1 must preserve the current auth-owned competitive record exactly. It may not introduce a temporary or partial profile-owned model.

## Stage C2 — profile ownership and account erasure

Stage C2 remains blocked by issue #272 and the required independent UK data-protection review.

It includes:

- nullable `profiles.auth_user_id` and the removal of the current `profiles.id -> auth.users` cascade;
- repointing competitive ownership from `auth.users` to `profiles`;
- the account-erasure, anonymisation or pseudonymisation routine;
- transfer/archive consequences for owned leagues;
- ownership RLS rewritten through `profiles.auth_user_id`;
- field-by-field retention, erasure, visibility, backup and former-player history rules;
- the final reviewed action for every `auth.users` foreign key.

No C2 schema, function, policy, ownership or deletion change may be included in C1 for convenience.

## Safeguard disposition

The stable safeguards remain valid, with implementation ownership divided as follows:

- **C1:** `CS-001`–`CS-008`, `CS-010`–`CS-017` and `CS-019`, except any test clause that explicitly assumes profile ownership;
- **C2:** `CS-009` and `CS-018`, plus the profile-ownership portions of `CS-008`, `CS-011`, `CS-012` and `CS-014`;
- **shared preservation:** C1 must keep the PR #246 deletion matrix and every current auth-owned behaviour unchanged so C2 still has a trustworthy before-state.

## Contract-test rule

The seven original Stage C suites remain evidence and must not be weakened or removed. The supporting `accountDeletionSemantics.test.ts` suite is the shared C2 before-state and must remain unchanged through C1.

The executable split is:

1. [`stage-c1-contract-classification.md`](stage-c1-contract-classification.md) classifies **40 C1 assertions, zero authorised C2 after-state assertions and nine shared-before-state assertions**;
2. `tests/scripts/stageC1ContractClassification.test.ts` proves that every assertion in those source suites appears exactly once under the correct classification;
3. `tests/database-parity/stageC1NonInterference.test.ts` freezes the 13 effective `auth.users` foreign keys, absence of profile-owned dependencies, 14 effective ownership-policy anchors and absence of a C2 deletion function;
4. [`stage-c1-schema-overlay.md`](stage-c1-schema-overlay.md) gives every original relation and reviewed function a C1/C2/shared disposition;
5. `tests/scripts/stageC1SchemaOverlayCoverage.test.ts` compares that overlay with the original coverage manifest and fails on an omitted relation/function or leaked C2 instruction;
6. `tests/scripts/stageCContractInventory.test.ts` keeps every discovered Stage C database contract named in the roadmap and current status.

The combined-design reconciliation required before C1 SQL is complete through the overlay. Any later C1 migration must keep all boundary and coverage tests green and may change only assertions classified as C1.

## Promotion boundary

- Documentation and disposable/local proof may proceed.
- A C1 migration must be append-only and development-only in intent.
- No hosted development write occurs without separate explicit owner approval, preflight and rollback evidence.
- Production stays at contract 63 and its deployment pipeline remains paused until an intentional release milestone.
- This amendment authorises no C2 work and no hosted schema operation.
