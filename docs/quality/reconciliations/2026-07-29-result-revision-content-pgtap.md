# Result-revision content behavioural pgTAP reconciliation

**Date:** 29 July 2026  
**Audit finding:** `RESULT-AUDIT-01`  
**Implementation PR:** #191  
**Implementation merge:** `ec635f12fedfc87b492ff0cf8a70882ab5963bd9`  
**Database contract:** unchanged at 60

## Finding

The 29 July full website/repository audit confirmed that result confirmation, correction and clearing were already behaviourally tested and that `match_result_revisions` was protected from direct client/service-role mutation. It also identified one remaining gap: no test directly asserted the exact `previous_result` and `new_result` JSON written to the private revision log.

That distinction matters because immutable rows are only useful audit evidence when their content faithfully represents the authoritative match state before and after each operation.

## Implementation

PR #191 added `supabase/tests/116_result_revision_content.sql` with an isolated final and authenticated audit actor. The test drives the fixture through:

1. **Confirm:** regulation result, home 2–0 away;
2. **Correct:** 1–1 at 90 minutes, 2–2 after extra time, home wins the shootout 5–4;
3. **Clear:** official result withdrawn and the match returned to scheduled state.

The 17 pgTAP assertions prove:

- exactly three revision rows are appended;
- revision numbers and actions are `1/confirm`, `2/correct`, `3/clear`;
- confirmation `previous_result` is the complete scheduled-state snapshot;
- confirmation `new_result` stores method, displayed/final score, 90-minute score, null extra-time/shootout fields, winner, version, reason and confirmation timestamp;
- correction `previous_result` exactly equals confirmation `new_result`;
- correction `new_result` stores all 90-minute, 120-minute and penalty fields, the authoritative winner, version and reason;
- correction preserves the original confirmation timestamp and adds a correction timestamp;
- clear `previous_result` exactly equals correction `new_result`;
- clear `new_result` is the complete scheduled reset snapshot with version 3 and withdrawal reason;
- operation reasons are retained in revision order;
- every row retains the correct tournament and authenticated actor;
- the final authoritative match row matches the clear snapshot.

## Validation

Before commit, the complete confirm/correct/clear sequence and equivalent exact-content assertions ran successfully against development Supabase inside a transaction and rolled back.

Exact implementation head `9d43bc0256aa6ad918c8b27c362d65a871aaadf8` passed:

- **Database parity run `30445747235`:** clean 60-migration rebuild, database lint, all pgTAP suites including the new 17 assertions, TypeScript/PostgreSQL parity and disposable cleanup;
- **CI run `30445747255`:** build, lint, complete Vitest suite and production dependency audit;
- **Browser E2E run `30445747236`:** authenticated desktop/phone journeys, signup/password recovery and exact deploy-preview HTTP/Chromium smoke.

## Safety

- test-only repository change;
- no migration, function, privilege or database-contract change;
- hosted development validation rolled back;
- committed fixture data rolls back at test completion;
- production database and application data were not touched.

## Closure verdict

`RESULT-AUDIT-01` is resolved. The private result-revision log now has direct behavioural proof for exact content and state chaining, in addition to existing privilege, immutability, lifecycle and administrator-browser coverage.

The remaining audit work is no longer concentrated around missing critical lifecycle proof. The next product stage remains the post-lock consensus/My-entry experience rebuilt from current `main`, followed by final standings activation and the remaining manual accessibility/operational rehearsal work.
