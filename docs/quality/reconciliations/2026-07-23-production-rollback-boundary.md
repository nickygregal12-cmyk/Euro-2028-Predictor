# Production rollback boundary reconciliation

**Workstream:** `OPS-001-PRODUCTION-ROLLBACK-BOUNDARY`  
**Finding:** `OPS-001`  
**Evidence boundary:** repository documentation only

This note records the current repository position after removing the production-to-development rollback instruction from `docs/ops-prod-cutover.md`. It does not rewrite the dated 23 July 2026 audits or silently change the historical risk register.

## Hazard removed

The previous section 10 instructed an operator to replace the live Netlify Supabase URL and key with development-project values. After the 22 July production cutover, following that instruction would have connected the public production domains to development data, development Auth/CAPTCHA settings and seeded accounts.

The current runbook now states an absolute environment boundary:

- production domains and production deploys must remain connected to production Supabase;
- development Supabase is never a production fallback;
- application rollback restores a previous known-good production deploy while leaving production database configuration unchanged;
- an accidental environment-variable change may be repaired only with last-known-good production values;
- a database migration or data failure stops the rollout for investigation rather than triggering a remote reset, unreviewed SQL repair or cross-environment swap.

## Additional safeguards recorded

The cutover document is now explicitly a historical execution record rather than a reusable current migration script. It warns that:

- its migration list reflects the original 22 July stand-up and must be reconciled against the current repository;
- production keys and secrets remain outside version control;
- the historical seed inventory must be re-audited before future production use;
- admin bootstrap must be checked against the current production schema;
- database restore is not considered available until a backup and restore procedure have been verified or rehearsed;
- every incident record must confirm that production remained attached to production Supabase.

## Finding reconciliation

| Finding | Repository result | Remaining boundary |
| --- | --- | --- |
| `OPS-001` — rollback crosses environment boundaries | The unsafe instruction no longer exists in the current runbook; application-only rollback and production-only configuration restoration are explicit | A targeted finding-status review is still required because the dated risk register is historical |
| `OPS-003` — release, monitoring and recovery controls incomplete | Narrowed by a safer application rollback decision tree and incident record requirements | Verified backups, rehearsed database restore, monitoring/alert ownership and a tested recovery exercise remain open |
| `OPS-005` — possible production schema drift | No change | Requires an explicitly approved production verification query |

## No hosted action

This documentation repair did not query or modify Netlify, development Supabase or production Supabase. It does not prove that current production environment variables are correct, that backups exist, or that a database restore would succeed.

## Next operations work

1. Keep the production/development boundary as a hard release rule.
2. Resolve `OPS-005` only through an explicitly approved, read-only production verification process.
3. Create and rehearse a separate backup/restore and incident-recovery procedure before claiming full recovery readiness.
