# Ops record — Production Supabase cutover

This is a historical record of the separate production Supabase project created on 22 July 2026. It is **not** a reusable migration script.

## Current verified environment position — 24 July 2026

| Component | Verified position |
| --- | --- |
| Production domains | `euro28predictor.com` and `euro28predictor.netlify.app` |
| Production Netlify | `main`; deployed application remains post-PR #14 and expects the atomic bracket RPC |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk`; original 20-migration semantic shape |
| Development Supabase | `iouzoutneyjpugbbtdem`; migrations 21–35 applied and verified |
| Repository shape | 35 migrations |
| Production pending chain | migrations 21–35, fifteen files |

Production currently points to production Supabase. Preserve that boundary in every release and incident.

## Critical release mismatch

The production application includes PR #14’s atomic bracket client, but production Supabase does not contain `replace_predicted_progression`. The current production app/database pair is incompatible (`OPS-006`).

Do not apply migrations ad hoc from this document. Follow:

- `docs/ops-hosted-migration-rollout.md`;
- `docs/ops-pending-migrations.md`;
- `docs/quality/current-status.md`.

## What the 22 July cutover established

The original cutover:

- created a production Supabase project separate from development;
- manually applied the then-current twenty migration files;
- created the initial Euro 2028 reference dataset;
- connected production Netlify to production Supabase;
- configured public Auth/CAPTCHA-related environment values;
- switched the public domains to the production backend.

The original inventory ended at `20260722120000_write_integrity.sql`. Migrations 21–35 were added later and are not applied to production.

## Correction to the historical admin record

A previous version said an admin bootstrap grant had run. Direct inspection confirmed `profiles.role` does not exist. Therefore:

- no version-controlled administrator model was created;
- the claimed update did not establish the documented admin state;
- the issue is tracked under `OPS-002`;
- `docs/ops-admin-bootstrap.md` prohibits the obsolete SQL.

## Hosted development rehearsal addendum

The controlled 23–24 July rehearsal:

- cleared disposable development competition state while preserving Auth-backed profiles/reference data;
- applied migrations 21–35;
- replayed the normalized production entry;
- regenerated all 24 predicted group positions;
- resolved all eight R16 fixtures and the full predicted bracket;
- rehearsed result confirm/correct/clear and winner propagation;
- verified atomic bracket stale-snapshot rejection;
- removed anonymous public-function execution and enforced exact allowlists;
- verified version-safe persisted score clearing, conflict protection and derived-position invalidation;
- restored the mirror to 36 predictions, 24 positions, eight progression rows, zero revisions, zero score events and zero rank history;
- passed the complete migrations 21–35 post-rollout contract.

This is rehearsal evidence only. It does not authorize or imply production rollout.

## Absolute environment boundary

- Production domains/deploys remain connected to production Supabase.
- Development Supabase is never a production fallback.
- Application rollback restores a production deploy compatible with the current production schema while leaving production database configuration unchanged.
- Repairing variables uses last-known-good **production** values only.
- Migration/data failure stops the rollout; it never triggers reset, improvised repair SQL or cross-environment swapping.

## Current Netlify concern

Production Supabase values are scoped to `all` deploy contexts. Production-project previews and branch deploys may therefore access production Supabase. Resolve `OPS-007` before treating previews as safe test environments.

## Future production rollout gate

Before migrations 21–35 are applied:

1. confirm the exact production app commit and schema state;
2. retain verified backup/recovery evidence;
3. rerun both production preflights;
4. prove the submitted entry still matches the rehearsed timestamp/fingerprints;
5. apply the exact 1–20 migration-history repair only while every baseline check remains true;
6. require `supabase db push --dry-run` to show migrations 21–35 only;
7. review failure/recovery decisions and obtain explicit approval;
8. apply migrations 21–35 in timestamp order;
9. run the exact object/data/table/function verifier and security advisors;
10. verify bracket save/reload, immediate final-edit submission, score clear/reload/conflict/lock behavior, result lifecycle, scoring, leaderboard, Match Centre and leagues;
11. record the compatible app/schema pair.

## Application rollback

A safe application rollback:

1. identifies a known-good production deploy compatible with the current schema;
2. restores it through Netlify;
3. leaves production Supabase URL/key unchanged;
4. verifies auth, reads and critical writes against production;
5. records commit, operator, reason and checks.

Rollback is incomplete until application/database compatibility is demonstrated.

## Database incidents

Until backup/restore is verified and rehearsed:

- do not claim database rollback capability;
- stop and investigate on migration or integrity failure;
- do not reset production;
- do not rewrite submitted entries without a reviewed remediation plan;
- document the exact migration boundary and preserved evidence.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`
- `docs/quality/reconciliations/2026-07-24-score-clearing.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `docs/ops-admin-bootstrap.md`
- `docs/quality/risk-register.md`
