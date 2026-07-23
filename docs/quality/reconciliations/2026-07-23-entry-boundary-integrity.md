# Entry-boundary integrity reconciliation

**Workstream:** `DB-INTEGRITY-ENTRY-BOUNDARY-1`  
**Pull request:** #9  
**Evidence boundary:** repository code plus disposable local Supabase only

This note is the current overlay for the entry-boundary workstream when present on `main`. It does not rewrite the dated 23 July 2026 audits.

## What changed

The database now treats submission state and predicted group-position scoring inputs as server-owned competition data rather than ordinary client-editable columns.

- Authenticated clients may select and create only their own entry. A new entry must begin with `submitted_at = null`; direct client update or deletion of `entries` is denied.
- `submit_entry()` is the only authenticated path that can stamp `submitted_at`. It checks ownership, requires a configured future lock, serialises against the entry row, runs the shared submission validator and preserves the first valid timestamp.
- `predicted_group_positions` is client-readable for the owner but not client-writable. The server derives the four positions from saved group scores plus exact valid manual group-tie decisions.
- Group-position snapshots refresh after relevant score or group-tie writes. Incomplete or unresolved groups have no trusted snapshot; restoring valid input recreates it.
- Group-position writes and match-prediction deletion are rejected after tournament lock.
- Match predictions, progression rows, Golden Boot rows, manual tie resolutions and derived group positions receive same-tournament validation at the database boundary.
- The legacy lock trigger functions now use fully qualified relations and fixed search paths.
- Existing submitted entries are checked non-destructively before the boundary changes. Invalid lock timing, incomplete predictions, unresolved groups, malformed progression or foreign-scope data fail the migration for explicit remediation.
- Existing derived group-position rows are scope-checked and rebuilt from authoritative saved inputs inside the main integrity migration.
- A shared private submission validator is used by fresh RPC submissions and the final legacy-submission revalidation, preventing two live copies of the submission rules.

## Executable evidence

The disposable local database workflow rebuilds the complete committed migration chain, lints the local database, runs all pgTAP files, executes the TypeScript/PostgreSQL group-order differential test and always deletes the local stack afterwards.

PR #9 adds adversarial coverage for:

- two authenticated users and two tournaments;
- direct `submitted_at` manipulation and pre-submitted entry insertion;
- direct group-position scoring-row forgery;
- owner and non-owner submission attempts;
- incomplete owner submission with no timestamp side effect;
- automatic position materialisation from ordinary resolved scores;
- score edits refreshing the snapshot before lock;
- unresolved groups remaining unsnapshotted;
- exact manual group-tie decisions creating and recreating the snapshot;
- pre-lock score deletion clearing stale derived positions;
- cross-tournament match, progression, Golden Boot and tie-resolution attacks;
- private helper/function permission denial;
- post-lock match-prediction deletion and manual submission rejection; and
- TypeScript/PostgreSQL resolver parity remaining intact.

The final PR-head verification passed both workflows:

- application CI: install, build/type-check, lint, unit/component tests and production dependency audit;
- database parity: local start, migration reset, database lint, all pgTAP tests, differential parity and clean local teardown.

## Finding reconciliation

| Finding | Repository/local result | Remaining boundary |
| --- | --- | --- |
| `DATA-001` — group positions not persisted | Implemented: positions are now server-derived, refreshed and submission-validated | Hosted migration application and real-data reconciliation remain unverified |
| `SECURITY-001` — group positions mutable after lock | Implemented: client DML is denied and server writes are lock-protected | Hosted policy/trigger parity remains unverified |
| `SECURITY-002` — direct submission timestamp bypass | Implemented: clients have no entry update privilege and submission is RPC-only | Hosted policy/function parity and legacy-data rollout remain unverified |
| `DATA-003` — same-tournament relationships | Partially addressed for all current user-owned prediction relationships in this batch | Broader reference-data/composite-constraint design and full bracket-tree validity remain open |
| `TEST-001` — database rules unexecuted | Materially narrowed: entry RLS, grants, triggers, submission RPCs, multi-user and multi-tournament attacks now execute locally | Hosted production, browser E2E and operational rollout tests remain open |

The dated risk register should not be silently rewritten from this note alone. A targeted post-merge verification may update finding statuses while preserving the hosted-evidence boundary.

## Deliberately not included

This batch does not implement:

- full knockout bracket-tree replay (`FUNC-001`);
- automatic deadline submission (`FUNC-002`);
- authoritative knockout winners, extra time or penalties (`DATA-002`);
- compound bracket-write atomicity (`REL-004`);
- result confirmation or score-recompute serialisation (`REL-001`);
- UI redesign, new routes or future game modes;
- scoring-value changes; or
- any hosted development or production Supabase query or mutation.

## Hosted rollout rule

Do not bypass a failing preflight. A failure means legacy submitted or cross-scope data must be inspected and repaired explicitly before applying the integrity boundary. No `supabase link`, remote reset, hosted migration or production query was used to create or verify this workstream.
