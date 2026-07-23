# Ops record — Production Supabase cutover

This is a historical record of the separate production Supabase project created on 22 July 2026. It is **not** a reusable current migration script.

## Current verified environment position — 23 July 2026

| Component | Verified position |
| --- | --- |
| Production domains | `euro28predictor.com` and `euro28predictor.netlify.app` |
| Production Netlify | `main`, commit `51d8ac607ee9d04bc932df1fea01a488f844f05a`, ready |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk`, active |
| Development Supabase | `iouzoutneyjpugbbtdem`, active and separate |
| Hosted database shape | Both projects remain on the original 20-migration schema |
| Repository shape | 33 migrations |

Production currently points to production Supabase. Preserve that boundary in every release and incident.

## Critical release mismatch

The production application contains PR #14's atomic bracket client, but production Supabase does not contain `replace_predicted_progression`. The current production app/database pair is incompatible (`OPS-006`).

Do not use this document to apply migrations ad hoc. Follow `docs/ops-pending-migrations.md` and the latest audit for the required staged preflight, remediation and approval process.

## What the 22 July cutover established

The original cutover:

- created a production Supabase project separate from development;
- applied the then-current 20 migration files manually;
- created the initial Euro 2028 tournament/reference dataset;
- connected the production Netlify site to production Supabase;
- configured public Auth/CAPTCHA-related environment values;
- switched the public domains to the production backend.

The original migration inventory ended at `20260722120000_write_integrity.sql`. Migrations 21–33 were added later and are not hosted.

## Correction to the historical record

A previous version said the admin bootstrap grant had been run. Direct production inspection confirmed that `profiles.role` does not exist. Therefore:

- no version-controlled administrator model was created;
- the claimed role update could not have established the documented admin state;
- this is tracked under `OPS-002`, not as untracked schema drift;
- `docs/ops-admin-bootstrap.md` now explicitly prohibits the obsolete SQL.

## Absolute environment boundary

- Production domains and production deploys remain connected to production Supabase.
- Development Supabase is never a production fallback.
- Application rollback restores a known-good production application while leaving production database configuration unchanged.
- Repairing an accidental variable change uses last-known-good **production** values only.
- A database migration or data failure stops the rollout for investigation; it never triggers remote reset, improvised repair SQL or cross-environment swapping.

## Current Netlify configuration concern

Production Supabase environment values are presently scoped to `all` Netlify deploy contexts. That can expose production Supabase to production-project deploy previews and branch deploys. Fix this under `OPS-007` before treating previews as safe test environments.

## Future production rollout gate

Before migrations 21–33 are applied:

1. confirm the exact production application commit and schema state;
2. retain appropriate schema/data backup evidence;
3. execute exact read-only preflights against real production data;
4. prove the existing submitted entry replays through the current group and bracket rules;
5. review stop/remediation/rollback decisions;
6. apply development first and verify behavior;
7. obtain explicit approval for production;
8. apply in timestamp order;
9. verify grants, policies, RPCs, result lifecycle, scoring, propagation and bracket save/reload;
10. record the resulting compatible application/schema pair.

## Application rollback

A safe application rollback:

1. identifies a known-good production deploy compatible with the current production schema;
2. restores that deploy through Netlify;
3. leaves production Supabase URL/key unchanged;
4. verifies auth, read paths and critical writes against production;
5. records the rollback commit, operator, reason and checks.

Rollback is not complete until the application and database are demonstrated compatible.

## Database incidents

Until backup/restore has been verified and rehearsed:

- do not claim database rollback capability;
- stop and investigate on any failed migration or data-integrity check;
- do not reset production;
- do not delete or rewrite submitted entries without a reviewed remediation plan;
- document the exact migration boundary and preserved evidence.

## Related current documents

- `docs/quality/current-status.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/ops-pending-migrations.md`
- `docs/ops-admin-bootstrap.md`
- `docs/quality/risk-register.md`
