# Final recovery acceptance

**Date:** 25 July 2026  
**Scope:** Production logical-backup recovery proof and migrations 21–35 rehearsal.  
**Production impact:** None. Production remained at declared database contract 20.  
**Repository authority:** `main` commit `6c3eeff04d1063400b86dae2e214f36af74452f1`.  
**Final clean replay project:** `cxbkesisqnhbmvltzujp` in `eu-west-2`.  
**Final clean replay status:** Paused after final evidence capture and verification.

## Owner acceptance

The owner explicitly recorded the following acceptance on 25 July 2026:

> I accept the verified production recovery artifact encrypted using OpenSSL
> AES-256-CBC with PBKDF2 as the approved recovery backup for this rollout.

This accepts the encryption method actually used by the verified artifact. It
does not approve a production migration, production migration-history repair,
deployment-contract change or launch.

## Accepted production artifact

The accepted source artifact is the production backup created at
`20260725T182646Z`, retained as an encrypted off-device archive and verified
through retrieval, decryption, archive-safety and plaintext-checksum checks.

No archive passphrase, database credential, raw Auth record, private backup URL
or secret checksum value is recorded in this repository.

## Final clean replay evidence

The clean replay started from a newly created empty hosted Supabase project and
used the corrected sequence:

1. restore `roles.sql`;
2. run `prepare-disposable-restore-target.sql` before source object creation;
3. restore `schema.sql`;
4. restore `data.sql` with replication triggers disabled for the import;
5. restore managed Auth customizations;
6. verify the contract-20 source baseline;
7. repair only migrations 1–20 as metadata;
8. dry-run exactly migrations 21–35;
9. apply migrations 21–35;
10. run post-rollout verification, advisors and rollback-only smoke checks.

The following non-secret local evidence directories were produced:

- `final-clean-baseline-20260725T200842Z`;
- `final-clean-history-20260725T201225Z`;
- `final-clean-forward-20260725T201700Z`;
- `final-recovery-smoke-corrected-20260725T202536Z`.

The directories are retained under the operator's restricted
`Documents/euro28-restore-evidence` location. They are not committed because
they may contain operational database output and machine-specific paths.

## Hosted cleanup

After the final state, advisors and rollback-only smoke evidence were captured:

- final clean replay project `cxbkesisqnhbmvltzujp` was paused;
- preceding diagnostic replay project `eckuehkcmkhuhmsfxtxu` remained paused;
- production `vkfnsqdyhvtwyqkisxhk` remained active, healthy and unchanged;
- no disposable project was repointed into any Netlify context;
- no development or production database write was performed as part of cleanup.

The paused projects may be removed later through a separate owner-approved
cleanup action after the retained evidence and plaintext-retention decision are
confirmed.

## Verified results

The final clean replay proved all of the following without manual ACL repair:

- the target was genuinely empty before restore;
- PostgreSQL was compatible with the source environment;
- source bundle checksums and provenance passed;
- all twenty contract-20 structural checks passed;
- migration 9 proved source-equivalent `public.entry_totals` privileges;
- `anon` and `authenticated` had no direct `entry_totals` access;
- `service_role` retained the intended `entry_totals` access;
- source counts, submission timestamp and all three rollout fingerprints matched;
- Auth/profile restoration and rollback-only signup/profile creation passed;
- Storage remained empty as recorded by the source inventory;
- history repair created exactly migrations 1–20 and changed no source data;
- the dry run listed exactly migrations 21–35;
- migrations 21–35 applied successfully;
- migration history contained exactly 35 canonical versions through
  `20260724003000`;
- the strengthened post-rollout verifier returned exactly 63 true checks;
- the two contract-35 client RPCs and private resolver schema were present;
- 24 derived group-position rows were created without changing source picks;
- no score, result, revision or rank-history data was invented;
- no migrations remained pending;
- authenticated atomic bracket replacement passed;
- authenticated submitted-entry settlement passed;
- service-role result confirmation and clearing passed;
- direct service-role access to the internal revision table remained denied;
- every smoke-test write rolled back;
- all 63 checks and source fingerprints still passed after the smoke transaction.

## Advisor disposition

The final hosted advisor review returned no security `ERROR` finding.

Accepted non-blocking findings were limited to:

- RLS-enabled internal tables with no browser policy;
- the existing trigger-only `enforce_joker_rules` search-path warning;
- intentional authenticated `SECURITY DEFINER` RPC allowlist warnings;
- leaked-password protection disabled on the disposable project;
- performance `INFO` findings for unused indexes and unindexed foreign keys on a
  newly created rehearsal database.

The exact function allowlists and table boundaries were independently enforced
by the 63-check post-rollout verifier.

## Recovery verdict

The production recovery artifact and corrected restore procedure are accepted
as technically proven recovery evidence for the contract-20 to contract-35
rollout.

The recovery-proof portion of `OPS-003` is closed. The broader finding remains
open for monitoring, production execution controls and final launch rollback
readiness.

## Remaining production gates

Production remains unchanged and blocked from automatic promotion. A production
rollout still requires, in a separate explicit window:

1. fresh production backup and read-only baseline/source preflights;
2. explicit owner approval to modify production;
3. metadata-only repair of migrations 1–20;
4. a dry run listing exactly migrations 21–35;
5. application of migrations 21–35 only;
6. production post-verification, advisors and authenticated smoke journeys;
7. changing the production deployment contract from 20 to 35 only after every
   database and application check passes.

Draft PR #76 and migration 36 remain separate, unmerged and outside this
recovery acceptance.
