# Atomic predicted-bracket persistence reconciliation

**Workstream:** `REL-004-ATOMIC-BRACKET-PERSISTENCE`  
**Primary finding:** `REL-004`  
**Evidence boundary:** repository and disposable local Supabase/PostgreSQL only

This note records the repository position after replacing independent predicted-progression row writes with one complete server transaction. It does not rewrite the dated 23 July 2026 audits or silently change the historical risk register.

## Previous failure mode

The bracket screen already treated the knockout picks as one logical winner tree, but the persistence service translated a save into separate insert, update and delete requests for individual `predicted_progression` rows.

The save controller serialized bracket saves in the browser, but it could not make those separate database requests atomic. A network, permission or validation failure after only some requests completed could therefore leave a partially replaced server bracket.

## Server replacement boundary

`public.replace_predicted_progression(entry_id, desired, expected_versions)` now owns the complete persisted progression set.

The function:

1. accepts the full desired team-to-stage map;
2. requires the complete row-version snapshot last read by the caller;
3. locks the owner entry row;
4. takes an entry-scoped advisory transaction lock;
5. verifies ownership and the configured tournament lock time;
6. rejects any added, removed or changed server row not represented by the expected snapshot with SQLSTATE `PT409`;
7. validates team UUIDs, stages, tournament membership and partial stage cardinality;
8. deletes removed rows, updates changed rows and inserts new rows in the same transaction;
9. replays a complete 1 champion / 1 final / 2 semi-final / 4 quarter-final snapshot through the existing `FUNC-001` bracket-tree validator; and
10. returns the authoritative stored rows and versions.

Any error rolls back the entire replacement. The previous valid bracket remains unchanged.

## Permission boundary

Authenticated users retain own-entry read access to `predicted_progression`, but direct client insert, update and delete privileges are removed.

The public application write path is the owner-checked replacement RPC. Private validation helpers remain unavailable to authenticated clients.

The service role remains able to construct hostile database fixtures and perform controlled operational work. That capability is not exposed to the browser.

## Client integration

`src/services/supabase/progression.ts` preserves the existing provider-facing functions so the bracket screen and save controller do not require a large behavioural rewrite.

For one bracket save, the service:

- starts from the complete last-read stage and version snapshot;
- coalesces the synchronous per-team upsert and delete calls into one microtask batch;
- calls `replace_predicted_progression` exactly once;
- advances its local baseline only from the authoritative successful RPC response; and
- maps `PT409` into the existing `VersionConflictError` flow.

The current conflict banner therefore continues to offer the established reload-latest or keep-mine resolution without allowing a stale snapshot to overwrite another device silently.

## Executable evidence

Application tests cover:

- multiple changed upserts and deletes producing one replacement RPC;
- the exact complete desired and expected-version payload;
- the returned server snapshot becoming the next save baseline; and
- `PT409` mapping into the existing typed conflict path.

The disposable pgTAP suite covers:

- authenticated RPC execution;
- denial of direct authenticated progression insert, update and delete;
- initial replacement from an empty bracket;
- mixed update, delete and insert in one transaction;
- server row-version advancement;
- stable versions for an identical no-op replacement;
- stale and incomplete expected-snapshot rejection;
- malformed expected versions;
- impossible partial-stage shapes;
- cross-tournament teams;
- non-owner replacement;
- post-lock replacement; and
- preservation of the complete prior snapshot after every rejected write.

Earlier entry and bracket-tree suites were adapted only in their hostile-data setup: they use `service_role` to construct invalid progression rows, then return to the authenticated user to prove the production validation boundary still rejects them. The assertions themselves are not weakened.

## Finding reconciliation

| Finding | Repository/local result | Remaining boundary |
| --- | --- | --- |
| `REL-004` — compound bracket writes are not atomic | Complete predicted-progression replacement is now one owner-checked, version-checked server transaction | Hosted migration application, authenticated browser journey and targeted finding-status review remain open |
| `TEST-001` — no database or browser integration assurance | Further narrowed by executable client batching, permissions, conflict and rollback coverage | Browser E2E and hosted authenticated execution remain open |
| `REL-003` — pending client writes may not be flushed before submit | No change | Submission still needs an explicit flush/wait boundary across pending debounced saves |
| `DATA-003` — incomplete reference constraints | Desired progression teams are checked against the entry tournament | Wider immutable reference-data constraints remain open |

## Explicitly not included

This work does not provide:

- automatic population of the real R16 from confirmed group standings and the authoritative best-third table;
- automatic deadline submission;
- an explicit flush of every pending debounced write before manual submission;
- browser result administration;
- browser end-to-end tests;
- hosted migration or legacy-data verification; or
- any scoring-value or visual-design change.

## Hosted boundary

No development or production Supabase project was linked, queried or modified. The migration remains a repository change until an explicitly approved hosted rollout, read-only preflight, backup/remediation plan and authenticated verification are completed. A failing preflight must not be bypassed.
