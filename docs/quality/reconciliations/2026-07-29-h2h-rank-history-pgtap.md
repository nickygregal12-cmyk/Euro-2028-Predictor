# H2H rank-history behavioural pgTAP reconciliation

**Date:** 29 July 2026  
**Audit finding:** `TEST-GAP-02`  
**Implementation PR:** #189  
**Implementation merge:** `a36c7231c201be34042c56a533620571e0e2058f`  
**Database contract:** unchanged at 60

## Finding

The 29 July full website/repository audit found that `public.capture_rank_history(uuid)` appeared only in function-privilege coverage. The application already used bounded H2H rank-history reads, but no database test directly proved when checkpoints were created, which entries were included, how tied ranks behaved or whether an existing checkpoint could be overwritten.

## Implementation

PR #189 added `supabase/tests/115_rank_history_capture.sql` with an isolated rollback-only tournament fixture:

- one complete MD1 match;
- one initially incomplete MD2 match;
- three submitted entries and one unsubmitted entry;
- controlled canonical totals of 12, 8 and 8 for MD1;
- revised totals of 3, 20 and 10 for MD2.

The 17 pgTAP assertions prove:

1. matchdays complete through the authoritative result writer;
2. capture succeeds only for completed stages;
3. incomplete MD2 does not create a checkpoint;
4. only submitted entries are included;
5. canonical `entry_totals` values are stored;
6. equal totals receive shared PostgreSQL `rank()` positions;
7. recapturing an existing checkpoint is safe;
8. later total changes do not overwrite the original checkpoint;
9. the original `captured_at` timestamp is preserved;
10. a newly completed MD2 creates a separate checkpoint with revised totals and ranks;
11. no unexpected checkpoint keys are created.

## Automatic-capture behaviour

The pre-commit development dry-run exposed and confirmed an important production behaviour: authoritative result confirmation automatically invokes rank-history capture after score recomputation. When MD2 was confirmed, an MD2 snapshot was therefore created before the controlled test totals were inserted.

The permanent test removes only that automatically generated MD2 fixture snapshot, then invokes `capture_rank_history()` against the controlled totals. MD1 remains untouched throughout and continues to prove the function's `ON CONFLICT ... DO NOTHING` idempotency boundary.

## Validation

Exact implementation head `ddb9b3abef74c8073ed186af4f5137105188f965` passed:

- hosted development transaction dry-run with full assertions and rollback;
- **Database parity run `30444229090`:** clean 60-migration rebuild, database lint, all pgTAP suites including the new 17 assertions, TypeScript/PostgreSQL scoring parity and disposable cleanup;
- **CI run `30444229102`:** build, lint, complete Vitest suite and production dependency audit;
- **Browser E2E run `30444229106`:** full authenticated desktop/phone journeys, signup/password recovery and exact deploy-preview HTTP/Chromium smoke.

Supabase's supported database-testing model is SQL pgTAP executed through the local CLI test runner, which is the repository's existing Database parity gate. The hosted development project does not install pgTAP, so the hosted validation used equivalent procedural assertions inside a rolled-back transaction; the authoritative pgTAP execution occurred in disposable local Supabase.

## Safety

- test-only repository change;
- no migration, function, privilege or database-contract change;
- hosted development dry-run rolled back;
- committed fixture data rolls back at test completion;
- production database and application data were not touched.

## Closure verdict

`TEST-GAP-02` is resolved. H2H rank-history capture now has direct behavioural database proof in addition to privilege, bounded-read, Profile/H2H unit and browser coverage.

The next focused audit finding is `RESULT-AUDIT-01`: asserting the exact before/after content appended to `match_result_revisions` by confirm, correct and clear operations.
