# Administrator assignment and revocation

## Current model

Result administration was introduced at contracts 37–38 and extended at
contract 40 with actual third-place qualification-boundary resolution.
Authorization is stored only in Supabase Auth `app_metadata`
(`auth.users.raw_app_meta_data`), which an ordinary user cannot edit.

The result capability is:

```json
{
  "admin_capabilities": ["results"]
}
```

`{"admin_role":"super_admin"}` authorizes every current capability and is
reserved for an owner-level emergency operator. A normal result operator gets
only `admin_capabilities: ["results"]`.

`profiles.role` does not exist and must never be used. `user_metadata` /
`raw_user_meta_data` is user-editable and must never authorize an administrator.

The browser route check is convenience only. Each `admin_*_match_result` and
`admin_*_third_place_tie*` database function independently reads the signed-in
user's server-owned JWT `app_metadata`, requires the `results` capability, and
rejects anonymous or ordinary authenticated callers. (The client capability
parser also recognises `users`, `leagues` and `tournament` for future surfaces;
`results` is the only capability any shipped RPC enforces today.)

## Assignment boundary

There is deliberately no in-app “make admin” control. Assignment and revocation
are owner operations performed through a separately authenticated Supabase Auth
administrator surface or Admin API using credentials that are never exposed to
the browser or committed to GitHub.

Before assigning production access:

1. identify the exact Auth user UUID and email;
2. obtain explicit owner approval naming the user and `results` capability;
3. capture the existing `raw_app_meta_data`;
4. preserve unrelated app metadata while adding only `results`;
5. record operator, approver, target UUID, reason and timestamp in the controlled
   release/operations record;
6. require the target user to sign out and sign in again before verification.

Prefer the narrow `results` capability. Do not use `super_admin` merely because
it is shorter.

## Read-only verification

Run against the intended project and target UUID:

```sql
select
  id,
  email,
  raw_app_meta_data ->> 'admin_role' as admin_role,
  raw_app_meta_data -> 'admin_capabilities' as admin_capabilities
from auth.users
where id = '<AUTH-USER-UUID>'::uuid;
```

Inventory every result-capable account:

```sql
select
  id,
  email,
  raw_app_meta_data ->> 'admin_role' as admin_role,
  raw_app_meta_data -> 'admin_capabilities' as admin_capabilities
from auth.users
where raw_app_meta_data ->> 'admin_role' = 'super_admin'
   or coalesce(raw_app_meta_data -> 'admin_capabilities', '[]'::jsonb)
      ? 'results'
order by email;
```

Acceptance requires:

- an ordinary authenticated browser is redirected from `/admin/results`;
- its direct `admin_confirm_match_result` RPC call returns permission denied;
- the assigned account can open `/admin/results`;
- a disposable/development confirm → correct → clear journey succeeds;
- all three actions appear in immutable revision history.

Do not use production match mutation as a bootstrap test.

## Revocation

1. obtain explicit owner approval and record the reason;
2. preserve unrelated app metadata while removing `results`, or remove the
   account's `admin_role` when that is the approved scope;
3. revoke/terminate the user's active Auth sessions using the currently
   supported Supabase Auth administrator control;
4. verify the inventory query no longer lists the capability;
5. verify a fresh login is denied `/admin/results` and the direct RPC;
6. record operator, approver, target UUID and completion timestamp.

JWT claims are not instantly refreshed when `app_metadata` changes. Removing
metadata without terminating existing sessions is not complete revocation.

## Continuity and audit rules

- During active development, one owner-controlled result administrator is
  acceptable.
- Before tournament operations, assign at least two separately controlled
  result administrators and rehearse grant/revocation.
- Never remove the last verified result administrator during tournament
  operations without first assigning and accepting a replacement.
- Auth metadata does not provide a complete business audit trail by itself.
  Every grant/revocation therefore requires the controlled operations record.
- Every result mutation is independently recorded in
  `match_result_revisions`; operators cannot edit that table directly.
- A future dedicated administrator-membership table may replace this model, but
  only through a reviewed migration and explicit production promotion.

## Related controls

- `supabase/migrations/20260727075922_admin_result_authorization.sql`
- `docs/ops-result-entry.md`
- `docs/ops-production-promotion-contract-38.md`
- `docs/quality/current-status.md`
