# Administrator migration version reconciliation

**Date:** 27 July 2026
**Scope:** Canonical repository migration versions for administrator result authorization
**Branch:** `agent/admin-control-room-current-main`
**Pre-rebase head:** `4abfde18d046021c39e58fee4a6548bd7ee44d13`

## Trigger

The branch introduced two administrator-result migrations under timestamps that did
not match the canonical versions already recorded by the hosted development database.

The hosted development database had already applied the same SQL under the canonical
versions `20260727075922` and `20260727080159`. Leaving the branch filenames unchanged
would cause the repository migration chain to report two pending migrations even
though their DDL was already present.

The hosted version, length and hash values in this record were supplied from the
verified 27 July 2026 development inspection. This reconciliation did not connect to
or modify any hosted database.

## Content-identity verification

Each repository file ended with one LF byte. The verification removed exactly that
single trailing LF before calculating MD5, matching the recorded hosted
`applied_sql_md5` convention.

| Migration | Repository bytes | Hosted canonical version | Normalized repository MD5 | Recorded `applied_sql_md5` | Result |
| --- | ---: | --- | --- | --- | --- |
| Administrator result authorization | 4,225 | `20260727075922` | `3ee6879dd2a8d8607ae437ba56787853` | `3ee6879dd2a8d8607ae437ba56787853` | Exact match |
| Result-revision timestamp | 858 | `20260727080159` | `b478b3eaadf0897e5985346075ca0a9e` | `b478b3eaadf0897e5985346075ca0a9e` | Exact match |

The one-byte repository/hosted length difference for each migration is therefore the
single trailing LF only.

## Repository reconciliation

The files were renamed to the canonical paths, without changing their contents:

- `supabase/migrations/20260727075922_admin_result_authorization.sql`;
- `supabase/migrations/20260727080159_admin_result_revision_timestamp.sql`.

Whole-file MD5 values, including the trailing LF, remained byte-identical across each
rename:

- administrator authorization: `0f4a62a618bdf061aee5cde2e56b5c93`;
- revision timestamp: `1236b818737df7af11515c447800e288`.

No SQL statement, whitespace byte or final newline changed.

## Reference and contract checks

After the rename, repository search for both obsolete versions must return no
matches. The exact command and empty output are retained in the pull-request
description.

`config/deployment-contract.json` remains contract 38 with 38 required migrations.
The matching-hosted-contract fixture in
`tests/scripts/deploymentContractGuard.test.ts` was aligned to contract 38. All 11
deployment-contract guard tests then passed against the renamed 38-file chain.

The final database-free application verification also passed:

- `npm run build`;
- `npm run lint` (two pre-existing warnings);
- `npm run test` (106 test files and 653 tests passed; one file and 15 tests skipped);
- `npm audit --omit=dev --audit-level=high` (zero vulnerabilities).

The disposable database-parity suite remains the responsibility of pull-request CI.

## Rule reaffirmation

Hosted application must always use the exact canonical migration version committed
in the repository. A migration's SQL identity alone does not make a different
timestamp interchangeable: repository filenames and hosted migration-history
versions must agree exactly.

Migration repair, duplicate SQL application and hosted metadata mutation were neither
required nor performed. The repository remains canonical and now records the
versions that were actually applied to development.
