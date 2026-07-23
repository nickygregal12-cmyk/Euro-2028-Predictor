# Ops record — Production Supabase cutover

This is a historical record of the separate production Supabase project created on 22 July 2026. It is **not** a reusable current migration script.

## Current verified environment position — 24 July 2026

| Component | Verified position |
| --- | --- |
| Production domains | `euro28predictor.com` and `euro28predictor.netlify.app` |
| Production Netlify | `main`; production application remains post-PR #14 and expects the atomic bracket RPC |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk`, active; original 20-migration semantic shape |
| Development Supabase | `iouzoutneyjpugbbtdem`, active and separate; migrations 21–34 applied and verified |
| Repository shape | 34 migrations |
| Production pending chain | migrations 21–34, fourteen files |

Production currently points to production Supabase. Preserve that boundary in every release and incident.

## Critical release mismatch

The production application contains PR #14's atomic bracket client, but production Supabase does not contain `replace_predicted_progression`. The current production app/database pair is incompatible (`OPS-006`).

Do not use this document to apply migrations ad hoc. Follow `docs/ops-hosted-migration-rollout.md`, `docs/ops-pending-migrations.md` and `docs/quality/current-status.md`.

## What the 22 July cutover established

The original cutover:

- created a production Supabase project separate from development;
- applied the then-current 20 migration files manually;
- created the initial Euro 2028 tournament/reference dataset;
- connected the production Netlify site to production Supabase;
- configured public Auth/CAPTCHA-related environment values;
- switched the public domains to the production backend.

The original migration inventory ended at `20260722120000_write_integrity.sql`. Migrations 21–34 were added later and are not applied to production.

## Correction to the historical record

A previous version said the admin bootstrap grant had been run. Direct production inspection confirmed that `profiles.role` does not exist. Therefore:

- no version-controlled administrator model was created;
- the claimed role update could not have established the documented admin state;
- this is tracked under `OPS-002`, not as untracked schema drift;
- `docs/ops-admin-bootstrap.md` explicitly prohibits the obsolete SQL.

## Hosted development rehearsal addendum

Development is no longer on the original 20-migration shape.

The controlled 23–24 July rehearsal:

- cleared disposable development competition data while preserving Auth-backed profiles and reference data;
- applied migrations 21–34;
- replayed the exact normalized production entry;
- regenerated all 24 predicted group positions;
- resolved all eight R16 fixtures and the full 15-match bracket;
- rehearsed result confirmation, correction, clearing and winner propagation;
- verified atomic bracket stale-snapshot rejection;
- removed anonymous public-function execution;
- applied exact authenticated/service function allowlists and fixed helper search paths;
- returned the development mirror to zero revisions, score events and rank history;
- passed the complete migrations 21–34 post-rollout verifier.

This is rehearsal evidence only. It does not authorize or imply a production rollout.

## Absolute environment boundary

- Production domains and production deploys remain connected to production Supabase.
- Development Supabase is never a production fallback.
- Application rollback restores a known-good production application while leaving production database configuration unchanged.
- Repairing an accidental variable change uses last-known-good **production** values only.
- A database migration or data failure stops the rollout for investigation; it never triggers remote reset, improvised repair SQL or cross-environment swapping.

## Current Netlify configuration concern

Production Supabase environment values are presently scoped to `all` Netlify deploy contexts. That can expose production Supabase to production-project deploy previews and branch deploys. Fix this under `OPS-007` before treating previews as safe test environments.

## Future production rollout gate

Before migrations 21–34 are applied:

1. confirm the exact production application commit and schema state;
2. retain verified schema/data backup or equivalent recovery evidence;
3. rerun both committed read-only production preflights;
4. prove the existing submitted entry still matches the rehearsed timestamp and payload fingerprints;
5. run the exact 1–20 migration-history repair only when every baseline check remains true;
6. require `supabase db push --dry-run` to show migrations 21–34 only;
7. review stop/remediation/rollback decisions and obtain explicit approval;
8. apply migrations 21–34 in timestamp order;
9. run the exact post-rollout object/data/table/function privilege verifier;
10. verify advisors, bracket save/reload, submission, result lifecycle, scoring, propagation, leaderboard, Match Centre and league RPCs;
11. record the resulting compatible application/schema pair.

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
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `docs/ops-admin-bootstrap.md`
- `docs/quality/risk-register.md`