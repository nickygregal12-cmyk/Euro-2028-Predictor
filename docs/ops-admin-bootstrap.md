# Ops note — Administrator bootstrap status

## Current status: authorization model not implemented

Do **not** run the former `update profiles set role = 'admin' ...` instruction.

Current verified facts:

- no repository migration defines `profiles.role`;
- neither development nor production Supabase contains that column;
- no current browser result-entry administration page exists;
- the protected result lifecycle functions are deployed in development and production at contract 35;
- those functions are service-role-only and do not create an end-user administrator model;
- direct browser execution and direct revision-table access remain denied.

The previous production cutover record stating that the admin bootstrap had been run was inaccurate. This is not evidence of an untracked production column. The administrator model remains missing and is tracked as `OPS-002`.

## Required design before any grant

A future administrator boundary must be version-controlled and tested. The implementation batch must define:

1. where authorization is stored, preferably a dedicated membership/role table or a deliberately designed profile field;
2. allowed role values and uniqueness/minimum-backup rules;
3. server-side checks for every privileged operation;
4. RLS/function grants preventing self-promotion and ordinary-user execution;
5. an auditable bootstrap and revocation path;
6. behaviour when the last administrator is removed;
7. development and production verification queries;
8. a server-side adapter that holds privileged credentials outside the browser;
9. browser/admin tests for result confirm, correct and clear;
10. operational logging, reason capture and incident/recovery handling.

UI route hiding is cosmetic and must never be the authorization boundary.

## Interim result operation

The contract-35 result lifecycle is live. Until an approved administrator adapter exists, a privileged database owner or separately controlled service-role operator may use the protected functions only during an explicitly authorized operation following `docs/ops-result-entry.md`.

That interim operation must:

- verify exact production/project/match identity;
- verify the result from an authoritative source;
- use only `confirm_match_result`, `correct_match_result` or `clear_match_result`;
- retain operator, reason, source and post-verification evidence;
- never expose the service-role credential to browser code;
- never grant ordinary users direct result-function execution;
- never treat possession of database credentials as the permanent admin model.

## Future bootstrap rule

When the authorization schema exists, add its migration, pgTAP permission tests, server adapter, bootstrap/revocation runbook and hosted verification in the same reviewed workstream.

Never document or execute a grant against a column, table or role value that is not present in the current schema. Never add migration 36 or later to production merely as part of an admin shortcut; it requires its own contract and rollout process.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-result-entry.md`
- `docs/ops-pending-migrations.md`