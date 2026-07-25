# Current quality status

> This is the live implementation and operations status document. Current `main` code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Latest formal audit | [`2026-07-25-repeat-verification-audit.md`](audits/2026-07-25-repeat-verification-audit.md), designation `2026-07-25R` |
| Latest recovery/restore reconciliation | [`2026-07-25-final-recovery-acceptance.md`](reconciliations/2026-07-25-final-recovery-acceptance.md) |
| Preceding restore reconciliation | [`2026-07-25-disposable-restore-privilege-reconciliation.md`](reconciliations/2026-07-25-disposable-restore-privilege-reconciliation.md) |
| Preceding recovery/audit reconciliation | [`2026-07-25-production-backup-and-repeat-audit.md`](reconciliations/2026-07-25-production-backup-and-repeat-audit.md) |
| Route accessibility reconciliation | [`2026-07-25-browser-route-accessibility.md`](reconciliations/2026-07-25-browser-route-accessibility.md) |
| Private league browser reconciliation | [`2026-07-25-private-league-invite-browser.md`](reconciliations/2026-07-25-private-league-invite-browser.md) |
| Pending invite boundary | [`2026-07-25-pending-invite-render-boundary.md`](reconciliations/2026-07-25-pending-invite-render-boundary.md) |
| Home availability | [`2026-07-25-home-data-availability.md`](reconciliations/2026-07-25-home-data-availability.md) |
| League hub availability | [`2026-07-25-league-hub-data-availability.md`](reconciliations/2026-07-25-league-hub-data-availability.md) |
| Profile availability | [`2026-07-25-profile-data-availability.md`](reconciliations/2026-07-25-profile-data-availability.md) |
| Match Centre league-scope availability | [`2026-07-25-match-centre-league-scope-availability.md`](reconciliations/2026-07-25-match-centre-league-scope-availability.md) |
| Production release state | [`2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md) |
| Application/database deploy gate | [`2026-07-24-app-schema-deployment-gate.md`](reconciliations/2026-07-24-app-schema-deployment-gate.md) |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Latest formal-audit baseline | `bd509101dd1d21a9882f6c40bef9676986215919` |
| Production application-code baseline | `a403b0796853453cb4115aea55729aced192a6ca` — introduced the deployed bracket and score-clear RPC dependencies |
| Current ready production deploy | `6a630e4de510f100077bc120`, source commit `a6d3f1c97a93d48789435457769fd627c305ff27` |
| Repository application/database contract | 35 |
| Production declared database contract | 20 |
| Repository migration count | 35 |
| Development Supabase | `iouzoutneyjpugbbtdem` — schema and canonical history aligned through 35 |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — migration 1–20 effects, no tracked history, contract-35 RPCs absent |
| Final clean restore target | `cxbkesisqnhbmvltzujp` — empty-target restore, history repair, migrations 21–35, 63-check verification, advisors and rollback-only smoke checks passed without manual ACL repair |
| Preceding restore target | `eckuehkcmkhuhmsfxtxu` — first replay passed after a manual source-ACL reconciliation; retained only as preceding diagnostic evidence |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** Architecture, CI, database parity and browser E2E provide strong repository/disposable evidence. |
| Production application/database pair | **Critical mismatch remains, contained.** The live client requires two RPCs absent from production. |
| Automatic production promotion | **Correctly blocked.** Repository contract 35 cannot replace production while production declares contract 20. |
| Development database | **Current through migration 35.** Physical schema, canonical history, ACLs and application-schema diff are aligned. |
| Production preflight | **Passed read-only on 25 July.** Structural checks and all three rollout fingerprints match; repeat immediately before any production write. |
| Recovery readiness | **Technically proven and explicitly accepted.** Off-device retrieval, integrity, corrected clean restore, Auth/profile checks, forward migration, advisors and rollback-only smoke checks passed. The owner accepted OpenSSL AES-256-CBC with PBKDF2 as the approved artifact encryption method for this rollout. |
| Production migration readiness | **Still blocked pending a separate production window.** Production remains unchanged. Fresh production preflights and explicit owner approval to modify production remain mandatory. |
| Migration 36 | **Draft only.** PR #76 remains unmerged and outside the production contract. |
| Real scored competition | **Not launch-ready.** Production integrity rollout, admin journeys, monitoring, official data and dress rehearsal remain incomplete. |

## Repository and test position

The application is React 19, TypeScript, Vite, React Router and Supabase, hosted by Netlify. Node `22.22.2` is pinned across package metadata, CI and Netlify.

Current workflows provide:

- lockfile install, guarded build/type-check, Oxlint, Vitest and production dependency audit;
- full disposable 35-migration rebuild, database lint, pgTAP and TypeScript/PostgreSQL parity;
- authenticated Playwright journeys against disposable local Supabase;
- desktop and phone-width route, prediction, submission, conflict and lock journeys;
- signup, email confirmation and password-recovery journeys;
- retained keyboard skip-link, route-focus and live-region evidence;
- a two-account private league create, invite-preview, join and refreshed-member journey;
- signed-out invite persistence through signup confirmation, first-use Welcome and authenticated join;
- cleanup of disposable browser data without backup retention.

Recent evidence includes:

- PR #78: CI and Browser E2E passed before merge, retaining route-accessibility behaviour;
- PR #79: final CI and Browser E2E passed before merge, retaining the private-league invite/join lifecycle;
- PR #80 implementation head `e0010def1d794eefa26b926f23349beaad2cf7e3`: CI run 384 and Browser E2E run 116 passed before documentation reconciliation;
- PR #81 final head `6046f9357521b0ebc1fda14fa2b0942d64ca73e7`: CI run 403 and Browser E2E run 134 passed before merge, preserving Home source availability;
- PR #82 final head `d6f5e3062dfb1e7d28bfdaee1bf4d5ad29ffc38b`: CI run 406 and Browser E2E run 136 passed before merge, preserving League hub availability;
- PR #83 final head `ea184afce6c9df797cdb1f3004358b41f449f1df`: CI run 410 and Browser E2E run 139 passed before merge, preserving Profile availability;
- PR #85 final head `9b04c08c835913f5d1d8a1481c4096382671eb78`: CI run 415 and Browser E2E run 143 passed before merge, preserving Match Centre league-scope availability;
- PR #88 head `32a7b9f91d7eff1f59726b5ebd96513be3bb56cd`: CI run 421 and Database parity run 113 passed before merge, adding the corrected empty-target restore privilege procedure and strengthened ACL verification;
- final hosted recovery replay: contract-20 restore, exact history repair, migrations 21–35, 63-check post-verification, advisors and rollback-only authenticated/service smoke checks passed;
- draft PR #76: CI, Database parity and Browser E2E pass, but migration 36 remains outside current authority.

These results prove the accepted recovery procedure and provide strong repository/disposable-environment evidence. They do not prove that production has been migrated, real SMTP/Turnstile configuration, production browser smoke behaviour or a real screen-reader experience.

## Current production release and Netlify state

The current ready production deploy remains:

- deploy `6a630e4de510f100077bc120`;
- source `a6d3f1c97a93d48789435457769fd627c305ff27`;
- Performance 98;
- Accessibility 100;
- Best Practices 100;
- SEO 100;
- no deploy secret-scan matches;
- no deployed Functions or Edge Functions.

Current Netlify context matrix:

| Context | Supabase project | Declared DB contract |
| --- | --- | ---: |
| `production` | production `vkfnsqdyhvtwyqkisxhk` | 20 |
| `deploy-preview` | development `iouzoutneyjpugbbtdem` | 35 |
| `branch-deploy` | development `iouzoutneyjpugbbtdem` | 35 |
| `dev` | development `iouzoutneyjpugbbtdem` | 35 |

`validate-netlify-environment.mjs` rejects crossed environments. `validate-deployment-contract.mjs` rejects migration-count drift and incompatible hosted contracts. PR #76 correctly fails its contract-35 preview because it requires contract 36; do not change hosted values to make that draft deploy.

## Production application/database mismatch — `OPS-006`

Application baseline `a403b0796853453cb4115aea55729aced192a6ca` requires:

1. `replace_predicted_progression(uuid,jsonb,jsonb)` for atomic complete-bracket persistence;
2. `delete_match_prediction(uuid,uuid,integer)` for version-safe persisted score clearing.

Read-only production verification confirms both are absent. Bracket persistence fails closed, stored-score clearing can restore the old row after reload, and old broad table privileges remain until migrations 21–35. Never change production contract 20 to 35 before database rollout and post-verification pass.

## Production database snapshot and preflight

Read-only evidence on 25 July 2026 found:

| Object | Count / value |
| --- | ---: |
| Submitted entries | 1 |
| Match predictions | 36 |
| Predicted tie resolutions | 2 |
| Predicted progression rows | 8 |
| Matches with stored scores | 0 |
| Score events | 0 |
| Rank-history rows | 0 |
| Storage buckets / objects | 0 / 0 |

Total Auth users, profiles and unsubmitted entries may change through legitimate signup activity and are not rollout guard values.

Both committed read-only production verifiers passed:

- all twenty migration 1–20 structural checks;
- `overall_structural_pass = true`;
- prediction fingerprint `320cf25d62767dee307d3602212909af`;
- tie fingerprint `a4dcf183f5c48e3ba11ff75c59622598`;
- progression fingerprint `0d7bc491daa9b24013204d061a2d38f1`;
- no scope anomaly;
- valid `8/4/2/1` knockout tree and fourteen winner sources.

Production still has no `supabase_migrations.schema_migrations` table. Migration-history repair has not been run.

## Development database contract

Hosted development is aligned through migration 35:

- all 35 schema effects present and exactly 35 canonical history records;
- no pending contract-35 migration;
- private resolver schema denied to browser roles;
- RPC-only submission and server-derived positions;
- same-tournament, ownership, version and lock guards;
- authoritative result lifecycle and immutable revisions;
- serialized scoring;
- predicted bracket replay and real winner propagation;
- atomic expected-version bracket replacement;
- version-safe score deletion;
- exact function execution allowlists and fixed helper search paths;
- empty final application-schema diff.

Migration 36 exists only in draft PR #76. It is not development or production authority until reviewed and merged through the normal contract process.

## Production backup and recovery status — `OPS-003`

The 25 July production artifact and corrected restore procedure are technically proven and explicitly accepted for the contract-20 to contract-35 rollout.

The accepted evidence includes:

- browser-based retrieval from off-device custody;
- encrypted checksum verification after retrieval;
- restricted decryption and archive-safety checks;
- all plaintext checksums and source provenance;
- explicit acceptance of the executed OpenSSL AES-256-CBC with PBKDF2 encryption method;
- a new genuinely empty hosted replay target;
- roles restore followed by `prepare-disposable-restore-target.sql` before `schema.sql`;
- disposable schema/data/Auth-trigger restore;
- exact source counts, submitted timestamp and rollout fingerprints;
- Auth/profile presence and rollback-only signup/profile creation;
- empty Storage verification;
- all twenty strengthened contract-20 baseline checks, including source-equivalent `entry_totals` ACLs;
- metadata-only history repair for exactly migrations 1–20;
- a dry run listing exactly migrations 21–35;
- successful application of migrations 21–35;
- exactly 35 canonical migration-history records through `20260724003000`;
- exactly 63 true post-rollout checks;
- zero pending migrations;
- hosted security advisors with no `ERROR` finding;
- authenticated atomic bracket replacement and submission settlement;
- service-role result confirmation and clearing while direct revision-table access remained denied;
- complete rollback of every smoke-test write;
- all 63 checks and source fingerprints passing again after the smoke transaction.

The first rehearsal's target-default privilege mismatch is now proven corrected. The final clean replay required no manual ACL repair. Production was never exposed and remains unchanged at contract 20.

The recovery-proof portion of `OPS-003` is closed. The broader control remains open for production execution discipline, monitoring and final launch rollback readiness.

## Feature and safeguard status

### Implemented scope

- authentication, signup/login, password recovery, moderation and confirmed sign-out;
- first-use welcome gate, including pending-invite continuation;
- group score predictions, Jokers, predicted tables, manual ties and best-third ranking;
- Golden Boot and derived group-goals prediction;
- Review/manual submission UI;
- overall standings, private leagues, invite creation/joining, H2H, Match Centre and own profile;
- route-level code splitting, not-found recovery and security headers;
- substantial disposable database and browser tests.

### Deployed client / production backend absent

- atomic Original Predictor bracket persistence;
- version-safe persisted score clearing.

### Partial or planned

- trustworthy, privacy-reviewed signed-out invite context before signup (`UX-001`);
- other-player full profile and richer H2H;
- expanded Match Centre phases;
- browser result administration and an admin authorization model;
- automatic valid-entry submission and reminder emails;
- actual R16 population and unresolved actual-tie workflow;
- post-lock prediction trends;
- KO Predictor, Last Man Standing and Predictor Cup.

Bonus competitions remain separate planned products. No bonus game is implemented merely because it appears in design or roadmap documents.

## Accessibility, errors and browser confidence

Current implementation includes route-specific titles, polite announcements, post-navigation main focus, skip navigation, semantic bottom links, disclosure-based league options, sign-out confirmation and centralized safe error mapping.

Status:

- `A11Y-002`, `SEC-002` and `HYGIENE-001` are resolved;
- `A11Y-001` is partially resolved: desktop/mobile keyboard and DOM announcement proof exists, but manual screen-reader review remains;
- `UX-001` is partially improved: render-time invite mutation is removed and confirmation/Welcome continuation is browser-proven; anonymous pre-auth league context remains open;
- `UX-002` is partially resolved: Home, League hub, own Profile and Match Centre league-scope discovery preserve unavailable data instead of presenting false zero or empty states; remaining consumers still require review;
- `TEST-001` is substantially resolved for disposable browser coverage, including private league create/invite/join and signed-out confirmation continuation; result administration, manual assistive-technology review and compatible-production smoke remain open.

## Current finding positions

### Critical / High production-dependent

- `OPS-006`: open; production pair incompatible and contained.
- `DATA-001`, `SECURITY-001`, `SECURITY-002`, `DATA-002`: repository/development implemented, production open.
- `SECURITY-003`: repository/development implemented, production pending migrations 21–35.
- `DATA-003`: open/in progress through draft PR #76; not on `main`.
- `FUNC-001`, `REL-001`, `DATA-005`, `REL-003`, `REL-004`, `REL-007`: production closure pending.
- `DATA-004`, `DATA-006`, `OPS-002`: open.
- `TEST-001`: partial; remaining gaps are result administration, manual assistive-technology review and production smoke.
- `OPS-003`: recovery proof accepted; broader monitoring, production execution and final launch rollback controls remain open.

### Other open controls

- `OPS-008`: legacy public World Cup-sourced environment awaits separate owner action.
- `AUTH-001`: non-production Turnstile/CAPTCHA pairing unverified.
- `TYPE-001`: strict TypeScript/generated DB types open.
- `SEC-001`, `DATA-007`: abuse and atomic rate-limit work open.
- `UX-001`: anonymous pre-auth league context remains open after the render-boundary repair.
- `UX-002`: partially resolved across four primary surfaces; remaining remote-read consumers require audit.
- `UX-003`: other-player profile work remains open.
- `PERF-001`, `PERF-002`: profiling/measurement open.
- `SEO-001`, `SEO-002`: soft 404 and metadata scope open.
- `REPO-001`, `DOC-002`, `DOC-003`, `CODE-001`, `HYGIENE-002`: maintenance/policy work open.
- GitHub branch protection remains unverified through issue #33.

## Scoring status

`docs/scoring-rules.md`, TypeScript configuration, SQL scorer and tests remain aligned:

- group result 3;
- exact group score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

No audit, backup, accessibility, invite or browser-test change altered scoring.

## Immediate order of work

1. Review and merge the final recovery-acceptance reconciliation.
2. Retain non-secret replay evidence and confirm restricted plaintext cleanup according to the accepted recovery retention policy.
3. Pause or remove disposable hosted replay projects after evidence retention is confirmed.
4. Rerun both production preflights immediately before any production history repair.
5. Reconfirm production identity, current counts, source fingerprints, database version and absence of contract-35 RPCs.
6. Obtain explicit owner approval for the production write window.
7. Repair only migrations 1–20 metadata and require a 21–35-only production dry run.
8. Apply migrations 21–35 only after that approval and exact dry-run proof.
9. Run production post-verification, advisors and authenticated smoke journeys.
10. Change production contract 20 to 35 only after every production database and application check passes.
11. Continue `UX-002`, `DATA-003`, Turnstile, legacy-environment, branch-protection, admin and anonymous invite-context work separately.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. latest formal audit and reconciliation notes;
5. feature baseline and risk register;
6. historical audits;
7. roadmap/TODO for future intent only.

Do not claim production is migrated, contract 36, preview-auth verified or launch-ready until the corresponding evidence gates pass.