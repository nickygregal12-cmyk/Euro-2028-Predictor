# Ops note — Admin bootstrapping

How the first (and any) admin is granted. There is deliberately no in-app path to become admin — it's a one-time manual grant per environment, done in the Supabase SQL editor.

## Grant admin

```sql
update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
```

Verify:

```sql
select p.role, u.email from profiles p join auth.users u on u.id = p.id where p.role = 'admin';
```

> **Verify column/value names against the live schema before first use** — the role column and the exact value ('admin') must match what the admin RLS/functions check. If the admin result-entry build chose different naming, this note must be updated in the same commit.

## Rules

- Run per environment: dev project and (once it exists) the production project each need their own grant. **Do this in production as part of the production-project setup checklist (Phase 2 exit gate)** — not discovered missing in June 2028.
- Admin permission checks are server-side (RLS / SECURITY DEFINER functions). The UI hiding admin routes is cosmetic; this grant is what actually matters.
- Keep the admin set minimal: Nicky, plus at most one trusted backup for tournament-time result entry cover (holidays, matchday clashes). Grant the backup the same way.
- Revoke by setting `role` back to its default value.
- The dev seed never creates admins; seed users are always ordinary players.

## Related

- Admin result-entry page: Phase 2 build (checks this role server-side)
- Audit logging of admin actions: Phase 3
- Account deletion of an admin: transfer/delete owned leagues first (same ownership rules as any user), then revoke, then delete.
