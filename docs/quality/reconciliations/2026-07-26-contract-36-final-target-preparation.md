# Contract-36 final-target preparation

**Date:** 26 July 2026  
**Repository base:** `ea0d0113087cd377379d01b5e09f82706fba6dd3`  
**Final-target Supabase:** `vkfnsqdyhvtwyqkisxhk`  
**Final-target Netlify project:** `euro28predictor`  
**Scope:** read-only inspection and execution planning only

## Decision boundary

This preparation does **not** authorize or perform:

- final-target SQL;
- migration-history repair;
- a production Netlify contract change;
- a production deploy-pointer change;
- an Auth, Turnstile, Sentry, scoring or product-rule change.

Migration 36 and the production contract lift remain blocked until:

1. a fresh recoverable source bundle is created and accepted;
2. the immediate pre-write checks are rerun inside a controlled quiet window;
3. the owner gives explicit approval for the final-target database write.

## Current contract identity

Read-only inspection established:

- repository migration count: 36;
- final-target migration-history count: 35;
- first version: `20260719120000`;
- latest applied version: `20260724003000`;
- latest applied name: `exact_function_execution_allowlist`;
- repository migration 36: `20260725010000_authoritative_reference_integrity.sql`;
- migration-36 functions installed in final target: 0;
- migration-36 triggers installed in final target: 0.

No history anomaly was found. Migration 36 is the sole canonical repository migration not yet applied to the final target. No `migration repair` is required or permitted.

## Migration-36 read-only preflight

All six incompatibility counts returned zero:

| Relationship group | Invalid rows |
| --- | ---: |
| group-to-team assignments | 0 |
| match group/home/away/winner references | 0 |
| player-to-team references | 0 |
| result revision-to-match references | 0 |
| Golden Boot player selection | 0 |
| score-event match/team references relative to entry tournament | 0 |

The current data is compatible with migration 36 at the time of this inspection. These checks must be rerun immediately before an approved write.

## Current retained-data snapshot

Only counts, timestamps and hashes are recorded; no identity or prediction payload is stored here.

| Item | Current value |
| --- | ---: |
| Auth users | 1 |
| Profiles | 1 |
| Tournaments | 1 |
| Groups | 6 |
| Teams | 24 |
| Group-team assignments | 24 |
| Matches | 51 |
| Players | 0 |
| Entries | 1 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Joker predictions | 4 |
| Predicted tie-resolution rows | 3 |
| Predicted progression rows | 8 |
| Predicted group-position rows | 24 |
| Score events | 0 |
| Result revisions | 0 |
| Rank-history rows | 0 |

Latest retained-data timestamps:

- prediction update: `2026-07-26 08:57:03+00`;
- tie-resolution update: `2026-07-26 22:47:31+00`;
- progression update: `2026-07-25 07:55:55+00`;
- group-position update: `2026-07-26 22:47:31+00`;
- submitted timestamp: `2026-07-23 20:19:12+00`.

Fresh non-sensitive fingerprints:

- match predictions: `0f8dd7807a87b2dced1678e026fcb7f5`;
- tie resolutions: `d7315c50d02bf833e72bf2e57cf02e19`;
- progression: `2d5df35a81a3c2a48f926517d1b001e0`;
- group positions: `721fcb70165b1dd52892960fe22acb5b`.

The previous production reconciliation recorded two tie-resolution rows. The current final target has three, with a later update on 26 July. The accepted 25 July recovery artifact is therefore historical recovery proof but is not the fresh source bundle required for this migration window.

## Current production deployment boundary

Read-only Netlify inspection confirmed:

- production project: `euro28predictor`;
- current production deploy: `6a6612da3628de000862baea`;
- deploy state: ready;
- deployed source commit: `16ac10d42ff1e9b547303c3e85b8a29ceaa70056`;
- production Supabase project: `vkfnsqdyhvtwyqkisxhk`;
- production deployed database contract: 35;
- development, branch and preview contexts: contract 36 on development Supabase.

Merging PR #105 did not move the production deploy pointer or production contract. The existing compatible 35/35 pair remains active.

Production Sentry delivery remains enabled through the previously approved privacy boundary. No Sentry configuration change belongs in the migration-36 database window.

## Advisor observations

Read-only Supabase advisors surfaced existing separate work:

- mutable search path on `public.enforce_joker_rules`;
- authenticated `SECURITY DEFINER` functions requiring continued allowlist review;
- leaked-password protection disabled;
- missing supporting indexes on several foreign keys;
- unused-index notices requiring representative-load evidence before removal.

Migration-36 private functions are not yet present in the final target, as expected. Advisor findings must not be bundled into this migration window unless separately reviewed and approved.

## Required fresh recovery evidence

Before any final-target SQL, follow `docs/ops-production-backup-restore.md` and require:

1. a fresh logical source bundle created after the quiet window begins;
2. roles, schema and COPY-format data dumps;
3. Auth/profile and managed-schema evidence;
4. current inventory, migration list, tool/repository provenance and checksums;
5. owner-only plaintext permissions;
6. approved encrypted off-machine custody and retrieval verification;
7. successful clean disposable restore;
8. source-count, Auth/profile, trigger, ACL and fingerprint verification;
9. forward rehearsal from contract 35 to 36;
10. retained non-secret acceptance and cleanup evidence.

The 25 July artifact must not be reused as though it captured the current three tie-resolution rows or the current fingerprints.

## Preferred approved execution path

The preferred official path is the linked Supabase CLI from a clean checkout of the exact approved commit.

### 1. Identity and quiet window

- name one operator;
- confirm the repository commit and clean working tree;
- confirm final-target project `vkfnsqdyhvtwyqkisxhk`;
- prevent/avoid user edits during the window;
- confirm production Netlify remains contract 35;
- create and accept the fresh recovery bundle.

### 2. Immediate read-only replay

Rerun:

- exact migration history;
- the six migration-36 preflight counts;
- retained-data counts, timestamps and the four fingerprints;
- production deploy/contract/Supabase identity.

Any mismatch stops the window for review. Do not edit a fingerprint or weaken a preflight.

### 3. Exact pending-set proof

From the clean linked checkout:

```bash
supabase migration list
supabase db push --dry-run
```

The dry run must list exactly:

```text
20260725010000_authoritative_reference_integrity.sql
```

Any additional or missing migration stops the operation.

### 4. Approval gate

After the backup, fresh preflight and dry run are accepted, obtain explicit owner approval naming:

- final-target project;
- migration filename/version;
- repository commit;
- operator;
- backup/recovery record;
- proposed Netlify contract change after database verification.

### 5. Database application

Only after approval:

```bash
supabase db push
```

Stop on the first failure. Never skip the migration, reset the project, repair history or apply an edited copy.

If the official linked CLI path is unavailable, any connected-query fallback requires a separately stated operator decision and must repeat the exact development safeguards: canonical SQL, post-effect verification, canonical history verification and an explicit statement that no CLI dry run occurred.

### 6. Database verification

Require:

- exactly 36 canonical history versions;
- latest version/name `20260725010000` / `authoritative_reference_integrity`;
- stored migration SQL hash matching the repository file;
- six private `SECURITY DEFINER` functions with empty search paths;
- execution denied to `public`, `anon` and `authenticated`;
- six intended triggers present and enabled;
- all preflight counts still zero;
- rollback-only legal same-tournament writes succeeding;
- rollback-only cross-tournament writes rejected in all six classes;
- zero temporary verification rows;
- relevant application/database verifier and advisor review passing;
- `supabase db push --dry-run` reporting zero pending migrations.

### 7. Production contract and deploy

Only after database verification:

1. change only the production `EURO28_DEPLOYED_DB_CONTRACT` from 35 to 36;
2. keep production pointed only at `vkfnsqdyhvtwyqkisxhk`;
3. update production smoke to require contract 36 and restore exact-head commit enforcement;
4. publish the exact reviewed `main` commit;
5. require ready deployment and `/release.json` showing production, 36/36, exact commit and final-target Supabase;
6. run HTTP and anonymous browser smoke;
7. verify no development Supabase request;
8. verify privacy-safe production Sentry tracing remains healthy;
9. record a dated final-target promotion reconciliation.

## Failure handling

- **Fresh backup/restore failure:** no SQL; fix recovery evidence outside the window.
- **History, count, timestamp or fingerprint drift:** stop and recapture/review; never overwrite evidence.
- **Preflight incompatibility:** no migration; investigate the exact rows without weakening migration 36.
- **Dry-run mismatch:** no migration or history repair.
- **Migration failure:** keep production Netlify at 35; establish whether the transaction rolled back and prepare a reviewed forward/recovery decision.
- **Post-verification failure:** keep production Netlify and deploy pointer at the retained 35/35 pair.
- **Deploy/smoke failure after verified database 36:** do not point production at development or weaken guards; use a reviewed compatible application/deployment decision.

## Prepared verdict

Final-target migration 36 is technically preflight-compatible and is the sole canonical pending migration. The operation is **not yet authorized** because a fresh recovery bundle and explicit owner approval are still required.
