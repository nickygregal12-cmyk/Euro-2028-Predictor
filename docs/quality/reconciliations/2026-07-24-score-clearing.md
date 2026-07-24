# Version-safe persisted score clearing

**Workstream:** `DATA-005`  
**Date:** 24 July 2026  
**Repository migration:** `20260724003000_delete_match_prediction_rpc.sql`  
**Development project:** `iouzoutneyjpugbbtdem`  
**Production project:** `vkfnsqdyhvtwyqkisxhk`

## Verdict

| Area | Result |
| --- | --- |
| Repository implementation | **Complete.** Clearing either score removes the complete match-prediction row through a version-safe RPC. |
| Hosted development | **Applied and verified.** Ownership, lock, scope, version conflict, idempotency and derived-position cleanup passed. |
| Application assurance | **Passed.** Provider tests cover loaded, unsaved and stale-device clear paths. |
| Disposable database assurance | **Passed.** The 35-migration rebuild, lint, pgTAP suites and TypeScript/PostgreSQL parity completed successfully. |
| Production | **Unchanged.** Migration 35 and the client clear path remain pending the approved production compatibility rollout. |

`DATA-005` is implemented and verified in repository/development. It remains open for production/browser verification.

## Original defect

A match prediction is stored only when both scores are present. The browser could clear one side locally, but the provider merely cancelled a pending timer and returned the card to an idle state. If the complete row had already reached Supabase, it remained stored.

Consequences included:

- Review and submission could see an old complete score after the user believed it was cleared;
- a reload could restore the stale score;
- derived predicted group positions could remain based on a prediction the user had removed locally;
- a stale device could not safely distinguish deleting its own known row from deleting newer work created elsewhere.

## Database contract

Migration 35 makes match-prediction deletion RPC-only.

It replaces the broad owner policy with separate owner-scoped select, insert and update policies, then removes direct `DELETE` privileges from browser and service API roles.

The protected RPC:

```text
delete_match_prediction(entry_id, match_id, expected_version)
```

verifies:

- the caller is authenticated;
- the entry belongs to the caller;
- the tournament lock is configured;
- the tournament is still pre-lock;
- the match exists;
- the match is a group fixture in the entry's tournament;
- the stored row version exactly matches the version read by the caller.

A row that is already absent returns `false`, making a repeated clear idempotent.

A row that exists when the caller passes an unknown or stale version raises SQLSTATE `PT409`. This prevents a device that never saw the row from deleting work created by another device.

The existing `AFTER DELETE` invalidation trigger removes the affected group's predicted-position snapshot. The existing delete lock trigger remains a second server-side lock guard.

## Client behavior

Match score upserts and deletions now share the same save-controller key.

When one side of a complete local score is cleared:

1. any unsent score-upsert debounce is cancelled;
2. the provider queues a delete operation on the same serialized match key;
3. a loaded row uses the exact version previously read;
4. a purely local, unsaved row passes an unknown version;
5. successful deletion removes the cached version;
6. a quick clear followed by re-entry remains ordered behind any in-flight operation;
7. a stale deletion enters the existing optimistic-concurrency conflict flow and is not retried automatically;
8. the manual-submission settlement barrier includes the deletion automatically.

Keeping deletion and upsert on one key prevents clear/re-entry races from crossing each other.

## Hosted development proof

A rollback-only rehearsal used one match from the normalized production-entry clone.

Observed results:

- direct table deletion by the authenticated owner: `42501`;
- deletion with an unknown expected version while the row existed: `PT409`;
- deletion with stale version `99`: `PT409`;
- prediction row remained after both conflicts;
- correct expected version removed the row;
- the affected group-position rows fell from four to zero;
- a second clear returned `false`;
- post-lock clear returned `23514` and preserved the row.

The transaction was rolled back, leaving the development clone unchanged.

A subsequent hosted-development post-state check confirmed:

- the deletion RPC exists;
- authenticated and service roles cannot delete the table directly;
- authenticated may execute the RPC;
- anonymous may not execute it;
- anonymous public-function count remains zero;
- authenticated/service allowlists have no missing or surplus function;
- 36 prediction rows, 24 group-position rows and eight progression rows remain;
- the submission timestamp and all three rollout-guard fingerprints remain unchanged.

## Executable coverage

### Provider tests

`tests/app/PredictionsProvider.clear.test.tsx` proves:

- clearing a loaded row sends its exact stored version;
- clearing an unsent local score cancels the pending upsert and sends an unknown version;
- a stale delete surfaces the existing conflict state and is not retried.

The existing submission tests mock the deletion wrapper and continue to prove that pending writes settle before `submit_entry`.

### Database tests

`supabase/tests/090_match_prediction_deletion.sql` proves:

- function grants and anonymous denial;
- direct table-delete denial;
- ownership enforcement;
- unknown/stale version conflict behavior;
- cross-tournament refusal;
- correct-version deletion;
- derived-position invalidation;
- idempotent repeated clearing;
- post-lock refusal and row preservation.

`supabase/tests/080_function_privileges.sql` and the production post-rollout verifier now include the deletion RPC in the exact authenticated/service allowlists.

The clean disposable workflow rebuilt all 35 migrations, passed database lint, every pgTAP suite, differential parity and teardown.

## Production boundary

Production was not changed.

Migration 35 is the fifteenth pending migration after the independently proven production baseline 1–20. It must be applied only after migrations 21–34 in the separately approved compatibility rollout.

Production closure requires:

1. verified backup/recovery evidence;
2. final baseline and source-data preflights;
3. history repair for proven migrations 1–20 only;
4. dry run showing migrations 21–35 only;
5. ordered migration application;
6. the exact post-rollout verifier passing;
7. authenticated browser clear/reload verification;
8. stale-device conflict verification;
9. post-lock clear refusal verification;
10. durable browser E2E coverage.

## Separate remaining work

This change does not address:

- independent late reads overwriting newer state (`REL-002`);
- concurrent first-entry creation (`REL-006`);
- automatic deadline submission (`FUNC-002`);
- production environment isolation (`OPS-007`);
- leaked-password protection;
- browser E2E infrastructure.