# Ops note — Administrator bootstrap status

## Current status: not implemented

Do **not** run the former `update profiles set role = 'admin' ...` instruction.

The `2026-07-23L` live audit confirmed that:

- no repository migration defines `profiles.role`;
- neither development nor production Supabase contains that column;
- no current browser result-entry administration page exists;
- the protected result lifecycle functions introduced by the repository are intended for a future server-side adapter and are not applied to either hosted database.

The previous production cutover record stating that the admin bootstrap had been run was inaccurate. This is not evidence of an untracked production column; the administrator model is still missing and remains tracked as `OPS-002`.

## Required design before any grant

A future administrator boundary must be version-controlled and tested. The implementation batch must define:

1. where authorization is stored, preferably a dedicated membership/role table or a deliberately designed profile field;
2. allowed role values and uniqueness/minimum-backup rules;
3. server-side checks for every privileged operation;
4. RLS/function grants preventing self-promotion and ordinary-user execution;
5. an auditable bootstrap and revocation path;
6. behavior when the last administrator is removed;
7. development and production verification queries;
8. browser/admin adapter tests for result confirm, correct and clear.

UI route hiding is cosmetic and must never be the authorization boundary.

## Interim result operation

After the authoritative result-lifecycle migrations are approved, applied and verified, a privileged database owner may use the protected functions according to `docs/ops-result-entry.md`. That is an operational database-owner action, not a reusable end-user administrator model.

## Future bootstrap rule

When the authorization schema exists, add its migration, pgTAP permission tests, bootstrap runbook and hosted verification in the same reviewed workstream. Never document or execute a grant against a column or role value that is not present in the current schema.
