# Stage C governance amendment — C1 foundation and C2 deletion boundary

**Status:** Accepted owner decision  
**Date:** 30 July 2026  
**Issue authority:** [#303](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/303) for Stage C1 and [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) for Stage C2  
**Amends:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md) and [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md)

## Decision

The previously approved combined Stage C design is split into two independently governed implementation slices.

This amendment controls implementation order wherever the combined design or coverage manifest appears to require profile ownership and competition-season foundation changes in one migration. The original documents remain the detailed design record; this file defines which parts may now proceed and which remain blocked.

## Stage C1 — competition-season foundation

Stage C1 may progress through design reconciliation, contract updates and a separately reviewed development-only migration.

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

The seven landed pre-migration suites remain evidence and must not be weakened or removed.

Before C1 SQL:

1. classify each assertion as C1, C2 or shared before-state;
2. amend after-state expectations that assumed one combined migration;
3. keep all C2 assertions pinned to the current before-state;
4. add an executable guard proving the C1 migration does not alter the effective `auth.users` foreign-key action matrix or ownership RLS;
5. preserve the exact Stage C contract inventory in live status and roadmap documents.

## Promotion boundary

- Documentation and disposable/local proof may proceed.
- A C1 migration must be append-only and development-only in intent.
- No hosted development write occurs without separate explicit owner approval, preflight and rollback evidence.
- Production stays at contract 63 and its deployment pipeline remains paused until an intentional release milestone.
- This amendment authorises no C2 work and no hosted schema operation.
