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

### Approved product direction — two separate paths

**Amendment, 6 August 2026.** The owner has approved the product shape Stage C2 must implement. **This is a product decision, not a legal one.** It changes nothing about the block below: no hosted C2 change is authorised, and no independent data-protection approval is claimed or implied by this section. What it does is stop the design being reinvented each time the subject is reopened, and stop the two paths being conflated — which is the specific error that makes pseudonymisation get described as erasure.

They are **two different journeys with different obligations**, and the product must not offer one while calling it the other.

#### Ordinary Close Account (`PRIV-003`, `PRIV-004`)

The routine account-closure path a user takes from their account page:

- delete the Auth identity, credentials, email and direct profile identifiers;
- clear private preferences and reminder settings;
- transfer or archive owned leagues and competitions first, so no container is orphaned;
- retain only the **minimum pseudonymised competitive history** justified by a documented legitimate-interests assessment.

**No permanent public cross-competition former-player identifier** (`PRIV-004`). A stable label such as `Former player 1847` appearing beside the same person's rows in every competition is a persistent pseudonymous identity, not a removal of one — it re-identifies by correlation across the competitions it spans. A generic or competition-specific placeholder is required instead.

Closure of this kind **must not be described to the user as erasure.** It is not.

#### Formal erasure request (`PRIV-005`, `PRIV-006`)

A separate data-rights workflow, not a button on the account page:

- assess each request individually;
- delete granular competitive history where required;
- recompute ordinary standings deterministically where removal requires it;
- retain only the minimum settled-outcome evidence where a legal basis genuinely remains.

**Settled Cup and Last Man Standing outcomes are preserved deterministically** (`PRIV-006`). Removing a person must not resurrect an eliminated entrant, alter a settled winner or reopen a concluded competition — the outcome is a fact about other people's competitions as much as about the person leaving. Neutral settled-outcome placeholders are the mechanism; the former player's identity is not retained to achieve it.

#### What remains blocked (`PRIV-007`)

Documentation, architecture and test planning may proceed. **Hosted implementation may not**, until qualified independent UK data-protection review and the resulting work are complete:

- amended Stage C2 architecture and schema coverage documents;
- a field-by-field retention schedule;
- a legitimate-interests assessment;
- a proportionate DPIA and a processor/transfer inventory;
- designed closure, export, erasure, restriction and objection workflows;
- backup deletion or "put beyond use" handling;
- neutral settled-outcome placeholders for Cup and LMS;
- deterministic recomputation and audit tests;
- published privacy and complaints procedures;
- **independent qualified UK data-protection sign-off before any public deployment.**

Issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) stays open until those conditions are met. An AI-assisted review may inform the design and test planning above; **it does not substitute for the sign-off and no part of this document claims that it does.**

The first external cohort is separately restricted to adults aged 18 or over (`AGE-001`, [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md)). That restriction stands alongside this work rather than being satisfied by it, and it remains until a Children's Code and age-risk assessment supports a different model.

Each identifier above is tracked in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md).

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
- The 6 August 2026 product-direction amendment above authorises **documentation, architecture and test planning only**. It authorises no migration, no hosted change, no user-facing deletion or export capability, and it is not a legal approval.
