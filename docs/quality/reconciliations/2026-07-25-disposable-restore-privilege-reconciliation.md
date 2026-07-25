# Disposable restore privilege reconciliation

**Date:** 25 July 2026
**Scope:** Production logical-backup rehearsal into disposable Supabase project.
**Production impact:** None.

## Result

The production source bundle passed off-device retrieval, checksum, decryption,
baseline restore, Auth/profile/Storage verification, migration-history repair,
migrations 21–35 and committed post-rollout checks.

A subsequent hosted security-advisor run identified
`public.entry_totals` as an exposed owner-executed view on the disposable
target.

Read-only comparison established:

- production grants no direct access to `anon` or `authenticated`;
- the restored target granted both roles direct access;
- both roles could read the restored entry-total row;
- production remained unchanged and unexposed.

## Root cause

A fresh hosted Supabase target applies default table privileges while
`schema.sql` creates objects. The restore sequence had not performed Supabase's
required pre-schema revocation of target defaults.

The scoring migration itself already revokes browser access to
`entry_totals`; the mismatch was introduced only by the logical restore
procedure.

## Disposable reconciliation

The disposable target's `entry_totals` grants were reconciled to production:

- anonymous access denied;
- authenticated access denied;
- service-role access retained;
- migration history remained exactly 1–35;
- all committed post-rollout checks passed;
- all rollout fingerprints remained unchanged;
- no migration remained pending;
- the security-advisor error disappeared.

## Required permanent correction

The canonical restore procedure must:

1. require an empty disposable target;
2. restore roles;
3. run `prepare-disposable-restore-target.sql`;
4. restore schema and data;
5. make baseline migration 9 fail on any browser access to `entry_totals`;
6. repeat the same ACL assertions after migrations 21–35.

Recovery acceptance and production rollout remain blocked until one clean
disposable replay passes that corrected procedure without manual ACL repair.

Draft PR #76 and migration 36 remain separate and untouched.
