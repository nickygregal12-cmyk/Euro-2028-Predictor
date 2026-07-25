# Production backup and repeat-audit reconciliation — 25 July 2026

## Scope

This reconciliation records the non-destructive 25 July production backup work, current hosted verification and `2026-07-25R` repeat audit. It does not authorize production migrations or close findings that require a successful disposable restore or production rollout.

## Repository identity

- repository: `nickygregal12-cmyk/Euro-2028-Predictor`;
- audited branch: `main`;
- audited commit: `bd509101dd1d21a9882f6c40bef9676986215919`;
- repository contract: 35;
- migration count: 35;
- draft migration 36 remains isolated in unmerged PR #76.

## Hosted identity

- production Netlify project: `euro28predictor`;
- current ready deploy: `6a630e4de510f100077bc120`;
- production deploy source: `a6d3f1c97a93d48789435457769fd627c305ff27`;
- production Supabase: `vkfnsqdyhvtwyqkisxhk`;
- development Supabase: `iouzoutneyjpugbbtdem`;
- disposable restore target reserved: `eckuehkcmkhuhmsfxtxu`.

## Production database evidence

Read-only production checks returned:

- all migration 1–20 structural effects present;
- migration-history table absent;
- contract-35 bracket-replacement and score-deletion RPCs absent;
- one submitted entry;
- 36 group predictions;
- two valid tie resolutions;
- eight progression rows;
- no score events, rank history or stored match results;
- no scope anomaly;
- valid knockout source tree;
- prediction fingerprint `320cf25d62767dee307d3602212909af`;
- tie fingerprint `a4dcf183f5c48e3ba11ff75c59622598`;
- progression fingerprint `0d7bc491daa9b24013204d061a2d38f1`.

The production schema and migration history were not changed.

## Development database evidence

Hosted development is now aligned through contract 35:

- physical schema matches the canonical migration chain;
- exactly 35 canonical migration-history rows exist;
- no contract-35 migration remains pending;
- application-schema diff is empty;
- function privilege and search-path verification passes.

No additional development migration action is required before future work starts from current authority.

## Backup evidence completed

A fresh logical production bundle was created on the owner’s Mac on 25 July 2026. The operator verified, without exposing user data, that it contains:

- separate role, schema and COPY-format data dumps;
- `auth.users` and `public.profiles`;
- production inventory;
- repository/tool provenance;
- managed Auth customization evidence;
- baseline, preflight and post-rollout verifier copies;
- recursive SHA-256 checksums.

Observed controls:

- owner-only plaintext permissions;
- every plaintext checksum passed;
- an AES-256 encrypted archive was created;
- the archive decrypted successfully;
- the encrypted archive checksum passed;
- the encrypted archive and checksum file were copied off the Mac.

No credentials, raw Auth data, archive password or private storage URL are recorded here.

## Recovery evidence still missing

The following required closure evidence does not yet exist:

1. retrieval of the off-device copy through the custody path;
2. checksum verification after retrieval;
3. restore to the disposable target;
4. restored count and fingerprint verification;
5. restored Auth user/profile verification;
6. restored `on_auth_user_created -> public.handle_new_user()` verification;
7. disposable signup/profile-trigger smoke proof;
8. preferred history-repair and migrations 21–35 forward rehearsal;
9. cleanup and recovery acceptance record.

Accordingly:

- `OPS-003` improves from “method/tooling only” to **partially resolved — encrypted off-device source artifact exists; restore proof absent**;
- `SAFE-033` improves from Not present to **Partial**;
- the production migration gate remains blocked.

## Repeat-audit documentation findings

`2026-07-25R` found that several live authority documents lagged behind merged implementation or current hosted evidence. This is a regression of the existing `DOC-001` root cause, not a new finding ID.

Corrected subjects include:

- production rollout fingerprint authority;
- canonical development migration history;
- backup/recovery stage;
- Browser E2E classification;
- route accessibility implementation;
- league options disclosure semantics;
- safe user-facing error mapping;
- removal of the Vite scaffold asset;
- current repository baseline and audit designation.

Runtime code, scoring, migrations and hosted configuration were not changed by the reconciliation.

## Production boundary retained

- production contract remains 20;
- repository contract remains 35;
- migrations 21–35 remain unapplied in production;
- migration history remains unrepaired;
- PR #76/migration 36 remains outside production scope;
- no direct-table compatibility fallback was introduced;
- the next production-sensitive action remains retrieval and disposable restore of the existing backup.
