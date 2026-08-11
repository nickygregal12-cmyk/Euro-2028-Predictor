# Ops record — Production Supabase cutover

> **Historical record.** This documents the production Supabase cutover of 22 July 2026 and the contract-35 promotion of 25 July 2026 as they happened. It is **not** a reusable migration script and its environment tables are a dated snapshot — production has since been promoted to contract 38 (see `docs/quality/reconciliations/2026-07-27-contract-38-final-target-promotion.md`) and the repository/development have advanced further. For current facts use `docs/quality/current-status.md` and `docs/ops/ops-pending-migrations.md`; future production milestones follow the gate in `AGENTS.md`.

## Verified environment position — as of 25 July 2026 (superseded)

| Component | Verified position |
| --- | --- |
| Production domains | `euro28predictor.com` and `euro28predictor.netlify.app` |
| Approved/deployed source | `902a37aa6c50c967f8080d751147a5733b251fe3` |
| Current production deploy | `6a652c3d3416d26d595ae2ef` |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk`; exactly migrations 1–35; contract 35 |
| Development Supabase | `iouzoutneyjpugbbtdem`; exactly migrations 1–35; contract 35 |
| Repository shape | 35 migrations; contract 35 |
| Production pending chain through 35 | none |
| Draft migration 36 | PR #76 only; unmerged and unapplied |

Production remains connected only to production Supabase. Preserve that boundary in every release and incident.

## Release identity rule

A Netlify production release hash is not always an application-code change. Documentation-only merges can produce later releases with equivalent executable files.

For compatibility and rollback decisions, record both:

1. the current Netlify release/deploy, verified live;
2. the executable application baseline relevant to the database schema.

The verified contract-35 pair is source `902a37aa...`, deploy `6a652c3d3416d26d595ae2ef`, production database contract 35.

Do not treat one release hash as permanently current. Compare executable/configuration changes and the deployment contract before deciding compatibility.

## Contract-35 production promotion

The former mismatch is resolved. Production now contains:

- `replace_predicted_progression(...)` for atomic bracket persistence;
- `delete_match_prediction(...)` for protected persisted score clearing;
- RPC-only submission and server-derived group positions;
- authoritative result lifecycle and immutable revisions;
- serialized scoring recomputation;
- full predicted-bracket replay and real winner propagation;
- exact authenticated/service function allowlists and zero anonymous application execution.

The production migration history contains exactly 35 canonical rows. The final dry run reported no pending migration.

The committed production verifier returned exactly 63 passing checks before and after rollback-only smoke operations. Source counts, submitted timestamp and all three rollout fingerprints remained unchanged. Exactly 24 derived positions were created and no result, revision, score-event or rank-history data was invented.

## Live application verification

Netlify production declares contract 35 and serves the approved commit. Read-only live verification passed:

- production and immutable deploy roots returned HTTP 200 and matching HTML;
- metadata, canonical URL and React root were correct;
- CSP, HSTS and committed security headers were present;
- tested SPA paths and initial assets were healthy;
- production used production Supabase;
- the complete development Supabase endpoint was absent;
- no browser request targeted development or an unexpected Supabase host;
- anonymous login, signup, reset, protected-route and not-found journeys passed.

No form was submitted and no production data was changed during the live-site checks.

## Current production data evidence point

The completed rollout recorded:

| Object | Verified value |
| --- | ---: |
| Auth users | 1 |
| Profiles | 1 |
| Entries | 1 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Tie resolutions | 2 |
| Progression rows | 8 |
| Derived group positions | 24 |
| Stored/non-scheduled results | 0 |
| Result revisions | 0 |
| Score events | 0 |
| Rank history | 0 |

The submitted timestamp was `2026-07-21T21:51:49.639442+00:00`. Fingerprints were `320cf25d...`, `a4dcf183...` and `0d7bc491...`.

These values are rollout evidence, not permanent business limits. Legitimate future users and predictions may change counts.

## What the 22 July cutover established

The original cutover:

- created production Supabase separately from development;
- manually applied the then-current twenty migration effects;
- created the initial Euro 2028 reference dataset;
- connected production Netlify to production Supabase;
- configured public Auth/CAPTCHA-related environment values;
- switched public domains to the production backend.

The original inventory ended at `20260722120000_write_integrity.sql` and did not create canonical migration history.

## What the 25 July rollout established

The controlled contract-35 operation:

- accepted a verified encrypted backup and corrected clean restore;
- proved the original migration 1–20 effects;
- recorded exactly versions 1–20 through metadata-only repair;
- dry-ran and applied exactly migrations 21–35;
- verified exact 35-row history and zero pending migrations;
- ran the 63-check verifier and advisors;
- passed rollback-only authenticated/service database smoke checks;
- changed only the production Netlify contract declaration from 20 to 35;
- published the exact approved commit;
- verified the live production application and environment isolation.

The full record is `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`.

## Correction to the historical admin record

A previous version said an admin bootstrap grant had run. Direct inspection confirmed `profiles.role` does not exist. Therefore:

- no version-controlled administrator model was created;
- the claimed update did not establish the documented admin state;
- the issue was tracked under `OPS-002` (since resolved in development by PRs #120 and #126);
- `docs/ops/ops-admin-bootstrap.md` prohibits the obsolete SQL.

## Absolute environment boundary

- Production domains/deploys remain connected to production Supabase.
- Development Supabase is never a production fallback.
- Protected RPCs must not be replaced by direct-table client writes.
- Application rollback restores a release whose executable code is compatible with the current production schema.
- Repairing variables uses last-known-good production values only.
- Migration/data failure stops the rollout; it never triggers reset, improvised SQL or cross-environment swapping.
- Non-production Netlify contexts remain connected to development Supabase.

## Netlify position — as of 25 July 2026 (superseded; see `docs/ops/ops-pending-migrations.md` for current)

The production Netlify project was correctly isolated:

| Context | Supabase | Contract |
| --- | --- | ---: |
| production | production | 35 |
| deploy-preview | development | 35 |
| branch-deploy | development | 35 |
| dev | development | 35 |

Merging to `main` can change production release identity. Every executable change affecting database-dependent paths must include an explicit compatibility decision even though the current pair is aligned.

The separate legacy `euro28-predictor-dev.netlify.app` site remains outside this workstream under `OPS-008`.

## Future production migration gate

For any future production migration (`AGENTS.md` → Production milestones is the authoritative gate; this list is the cutover-era statement of the same discipline):

1. verify current Netlify release/deploy and executable diff;
2. verify the repository contract and exact migration set;
3. create and accept fresh recovery evidence appropriate to the change;
4. run read-only production preflights;
5. require a dry run listing only approved pending migrations;
6. obtain explicit owner approval;
7. apply migrations in timestamp order;
8. run exact post-verification, advisors and required smoke checks;
9. update the production Netlify contract only after database verification passes;
10. publish and verify the exact compatible release/schema pair;
11. update all current authority documents.

## Application rollback

A safe application rollback:

1. identifies a known-good executable application baseline compatible with the current production contract (38 since the 27 July 2026 milestone);
2. selects a Netlify release containing that baseline;
3. restores it through Netlify;
4. leaves production Supabase URL/key unchanged;
5. verifies Auth, reads and critical writes against production;
6. records release commit, executable baseline, operator, reason and checks.

Rollback is incomplete until application/database compatibility is demonstrated.

## Database incidents

The accepted backup/restore proof establishes recovery evidence, but restoration is still a deliberate incident decision:

- do not reset production;
- stop and investigate on migration or integrity failure;
- do not rewrite submitted entries without a reviewed remediation plan;
- document the exact migration boundary and preserved evidence;
- use the accepted/repeated recovery procedure only with explicit incident approval.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md`
- `docs/ops/ops-hosted-migration-rollout.md`
- `docs/ops/ops-pending-migrations.md`
- `docs/ops/ops-production-backup-restore.md`
- `docs/ops/ops-admin-bootstrap.md`
- `docs/quality/risk-register.md`
