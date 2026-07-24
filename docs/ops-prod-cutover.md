# Ops record — Production Supabase cutover

This is a historical record of the separate production Supabase project created on 22 July 2026. It is **not** a reusable migration script.

## Current verified environment position — 24 July 2026

| Component | Verified position |
| --- | --- |
| Production domains | `euro28predictor.com` and `euro28predictor.netlify.app` |
| Production application-code baseline | `a403b0796853453cb4115aea55729aced192a6ca` — introduced the current bracket and score-clear RPC dependencies |
| Netlify release commits | May advance on docs-only merges without executable application changes. Verify the current deploy live before any operation. First verified docs-only descendant: `83e071c2`, deploy `6a62c93afeb9b400086e1e3f`. |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk`; original 20-migration semantic shape; no migration-history table |
| Development Supabase | `iouzoutneyjpugbbtdem`; migrations 21–35 applied and verified |
| Repository shape | 35 migrations |
| Production pending chain | migrations 21–35, fifteen files |

Production remains connected to production Supabase. Preserve that boundary in every release and incident.

## Release identity rule

A Netlify production release hash is not always an application-code change. Documentation-only merges can produce later release commits with identical built application files.

For compatibility and rollback decisions, record both:

1. the current Netlify release/deploy, verified live;
2. the last executable application-code baseline relevant to the database schema.

Do not treat one release hash as permanently current. Compare the current release diff with baseline `a403b079` before deciding whether the executable client changed.

## Critical release mismatch

The executable production client calls:

- `replace_predicted_progression(...)` for atomic bracket persistence;
- `delete_match_prediction(...)` for persisted score clearing.

Read-only production inspection confirms neither RPC exists. Production also retains old direct authenticated progression and match-prediction delete privileges and broad owner `ALL` policies.

Expected effects:

- bracket edits fail rather than persist atomically;
- clearing a stored score reaches a save error and reload can restore the old row;
- the client does not fall back to unsafe direct writes.

A later docs-only Netlify release does not change this verdict unless its diff modifies executable/configuration files.

Do not apply migrations ad hoc from this document. Follow:

- `docs/ops-hosted-migration-rollout.md`;
- `docs/ops-pending-migrations.md`;
- `docs/quality/current-status.md`;
- `docs/quality/reconciliations/2026-07-24-post-merge-production-release-state.md`.

## Current production data snapshot

Post-deploy read-only verification found:

| Object | Count |
| --- | ---: |
| Profiles | 4 |
| Entries | 4 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Tie resolutions | 2 |
| Progression rows | 8 |
| Matches with stored scores | 0 |

The earlier audit recorded three profiles and entries. The current count of four is live user data; no row was changed during verification.

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

The controlled 23–24 July rehearsal applied migrations 21–35, replayed the normalized production entry, regenerated 24 predicted positions, resolved the R16 and full bracket, rehearsed results and winner propagation, verified exact function allowlists, and proved version-safe score clearing. Temporary evidence changes were removed afterward.

This is rehearsal evidence only. It does not authorize or imply production rollout.

## Absolute environment boundary

- Production domains/deploys remain connected to production Supabase.
- Development Supabase is never a production fallback.
- Missing production RPCs must not be replaced by old direct-table client writes.
- Application rollback restores a release whose **executable code** is compatible with the current production schema; a docs-only release hash alone does not prove or disprove compatibility.
- Repairing variables uses last-known-good **production** values only.
- Migration/data failure stops the rollout; it never triggers reset, improvised repair SQL or cross-environment swapping.

## Current Netlify concerns

Production Supabase values are scoped to `all` deploy contexts. Production-project previews and branch deploys may therefore access production Supabase (`OPS-007`).

Merging to `main` can also automatically change the production release identity before a database rollout. Every merge affecting executable database-dependent paths must include an explicit app/schema compatibility decision.

## Future production rollout gate

Before migrations 21–35 are applied:

1. verify the current Netlify release/deploy live;
2. compare its executable/configuration diff with application-code baseline `a403b079`;
3. retain verified backup/recovery evidence;
4. rerun both production preflights;
5. prove the submitted entry still matches the rehearsed timestamp/fingerprints;
6. apply the exact 1–20 migration-history repair only while every baseline check remains true;
7. require `supabase db push --dry-run` to show migrations 21–35 only;
8. review failure/recovery decisions and obtain explicit approval;
9. apply migrations 21–35 in timestamp order;
10. run the exact verifier and security advisors;
11. verify bracket save/reload, immediate final-edit submission, score clear/reload/conflict/lock behavior and critical reads;
12. record the compatible application-code baseline, current release and database schema pair.

## Application rollback

A safe application rollback:

1. identifies a known-good executable application baseline compatible with the current schema;
2. selects a Netlify release containing that executable baseline;
3. restores it through Netlify;
4. leaves production Supabase URL/key unchanged;
5. verifies auth, reads and critical writes against production;
6. records release commit, executable baseline, operator, reason and checks.

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
- `docs/quality/reconciliations/2026-07-24-post-merge-production-release-state.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`
- `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md`
- `docs/quality/reconciliations/2026-07-24-score-clearing.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-pending-migrations.md`
- `docs/ops-admin-bootstrap.md`
- `docs/quality/risk-register.md`
