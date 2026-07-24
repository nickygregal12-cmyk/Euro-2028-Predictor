# Current quality status

> This is the live implementation and operations status document. Current code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Latest formal audit | [`2026-07-24-repeat-verification-audit.md`](audits/2026-07-24-repeat-verification-audit.md), designation `2026-07-24R` |
| Preceding live-environment audit | [`2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md), designation `2026-07-23L` |
| Production release state | [`2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md) |
| Application/database deploy gate | [`2026-07-24-app-schema-deployment-gate.md`](reconciliations/2026-07-24-app-schema-deployment-gate.md) |
| Production recovery readiness | [`2026-07-24-production-recovery-readiness.md`](reconciliations/2026-07-24-production-recovery-readiness.md) |
| Netlify context isolation | [`2026-07-24-netlify-environment-isolation.md`](reconciliations/2026-07-24-netlify-environment-isolation.md) |
| Legacy site and Turnstile | [`2026-07-24-legacy-development-site-and-turnstile.md`](reconciliations/2026-07-24-legacy-development-site-and-turnstile.md) |
| Hosted migration rehearsal | [`2026-07-23-hosted-migration-rehearsal.md`](reconciliations/2026-07-23-hosted-migration-rehearsal.md) |
| Function hardening | [`2026-07-24-function-privilege-hardening.md`](reconciliations/2026-07-24-function-privilege-hardening.md) |
| Submission settlement | [`2026-07-24-submit-save-barrier.md`](reconciliations/2026-07-24-submit-save-barrier.md) |
| Persisted score clearing | [`2026-07-24-score-clearing.md`](reconciliations/2026-07-24-score-clearing.md) |
| Production baseline proof | [`2026-07-23-production-migration-history-1-20.md`](reconciliations/2026-07-23-production-migration-history-1-20.md) |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current repository release-control baseline | `51c87e6e08ac102089db810b5e5eb2ecf757771c` |
| Production application-code baseline | `a403b0796853453cb4115aea55729aced192a6ca` — introduced the deployed bracket and score-clear RPC dependencies |
| Current ready production deploy | `6a630e4de510f100077bc120`, source commit `a6d3f1c97a93d48789435457769fd627c305ff27` |
| Repository application/database contract | 35 — `config/deployment-contract.json` |
| Production declared database contract | 20 — new production builds remain blocked |
| Repository migration count | 35 |
| Development Supabase | `iouzoutneyjpugbbtdem` — semantic contract through migration 35 applied and verified |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — original 20-migration shape; no tracked migration-history table; Free organization |

## Executed repository verification — `2026-07-24R`

Run in a clean container from the committed lockfile. These are repository-level results only; they carry no hosted assurance.

| Check | Result |
| --- | --- |
| `npm ci` | ✅ 136 packages from lockfile |
| `npx tsc -b` | ✅ exit 0 — weak evidence: no `strict`-family flags are set (`TYPE-001`) |
| `npx oxlint` | ✅ 0 errors, 0 warnings, 230 files |
| `npm run build` (incl. both prebuild guards) | ✅ built in 1.51s; `dist/` 1.5 MB, 186 kB gzip; entry chunk 212.85 kB, down from 251.52 kB |
| `npx vitest run` | ✅ **434 passing, 15 skipped, 0 failing** across 57 files |
| `npm audit` | ✅ 0 vulnerabilities across 181 dependencies |
| `node scripts/check-fixtures.mjs` | ✅ 11 fixtures validated |

Two qualifications:

- the 15 skipped tests are `tests/database-parity/predictedGroupOrderParity.test.ts`, correctly gated behind `DATABASE_PARITY`;
- `tests/scripts/envFileHygiene.test.ts` reports 8 failures in any checkout lacking a `.git` directory, and passes 8/8 once one exists. This is environmental, not a defect in the code under test — recorded as `TEST-003`.

The 12 pgTAP files under `supabase/tests/` were **read but not executed**; that requires a local Supabase stack. Their existence and CI wiring are verified, their pass state is not.

## Quality-governance position — new at `2026-07-24R`

The engineering position improved substantially since `2026-07-23R`. The system that measures it weakened, and that is now the notable concern:

| Finding | Position |
| --- | --- |
| `DOC-004` | `docs/quality/README.md` — the charter defining severity, status, evidence and resolution standards — was deleted. `audit-prompt.md:955` still mandates reading it, so the repeat-audit control is unsatisfiable. A restored draft accompanies the audit. |
| `DOC-005` | `feature-baseline.md` lost its stable `FEAT-*` / `PLAN-*` / `SAFE-*` identifiers (96 ID-bearing rows → 60 unidentified). The archive preserves the originals, but row-by-row regression comparison is no longer reliable. Owner action. |
| `TEST-002` | `database-parity.yml` filters on `scripts/database-parity/**`, which does not exist, and omits `scripts/database-rollout/**` — the SQL guarding the pending migrations 21–35 rollout. That gate currently never fires for those files. |
| `DOC-001` | Reopened as **Partially resolved**: `docs/test-script.md` cross-references a `build-todo` section and batch names removed by the 24 July rewrite. |
| `HYGIENE-001` | Corrected: the asset is present at `src/assets/vite.svg`; the previous "path not identified" note was wrong. |

**Fix `TEST-002` before the production migration window opens.** The rollout sequence below depends on preflight and post-rollout SQL that currently receives no automated verification.

## Release identity rule

A Netlify release commit is not always an executable application change. Operational evidence must record:

1. the current ready Netlify deploy;
2. the executable application/database contract required by the repository;
3. the hosted database contract declared for that deploy context;
4. the actual hosted schema state.

Do not infer database compatibility from a successful build, a docs-only merge or a release hash alone.

## Current verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** The chain contains 35 migrations and executable coverage for the current database contract; `2026-07-24R` independently executed install, type-check, lint, build, 434 tests, dependency audit and fixture validation, all green. |
| Quality governance | **Degraded.** `DOC-004`, `DOC-005` and `TEST-002` weaken the controls that measure everything else. No feature or safeguard regression was detected. |
| Hosted development database | **Semantically current through migration 35.** Data, ACL, deletion, bracket and compatibility checks pass; remote migration-history metadata is not a clean repository mirror. |
| Netlify preview/branch/dev Supabase isolation | **Resolved for the current production Netlify project.** Non-production contexts use current development Supabase and a fail-closed prebuild guard. |
| Automatic production deployment compatibility | **Contained.** Repository contract 35 cannot deploy while production declares contract 20. The existing ready site remains active. |
| Current production application/database pair | **Critical mismatch remains.** The live client requires two RPCs absent from production. |
| Legacy `euro28-predictor-dev` site | **Not a current environment; open owner decision.** It belongs to the World Cup repository and inactive legacy staging backend. |
| Non-production Turnstile/CAPTCHA | **Unverified.** Production auth succeeds, but development CAPTCHA secret/toggle and Cloudflare hostname configuration are not proven. |
| Recovery readiness | **Tooling prepared; evidence absent.** No qualifying encrypted off-site artifact or successful disposable restore exists. |
| Production migration readiness | **Blocked.** Recovery proof, fresh preflights, named operator, approval and controlled window remain required. |
| Real scored competition | **Not ready.** Production integrity controls and authenticated browser E2E remain incomplete. |

## `OPS-006` — current production application/database mismatch

Application baseline `a403b0796853453cb4115aea55729aced192a6ca` requires:

1. `replace_predicted_progression(...)` for atomic complete-bracket persistence;
2. `delete_match_prediction(...)` for expected-version persisted score clearing.

Read-only production verification confirms both functions are absent. Production also retains old broad direct-write/delete privileges that migrations 21–35 remove.

Expected current effects:

- bracket edits fail rather than persist atomically;
- clearing a stored score reaches a save error and reload can restore the old row;
- the new client does not fall back to unsafe direct-table writes.

### Deployment containment

The repository contract is 35 while production declares hosted contract 20. `scripts/validate-deployment-contract.mjs` runs before Vite and rejects:

- a Netlify context whose declared hosted contract differs from the repository contract;
- an unreviewed repository migration-count change.

After the gate merged, the current production pointer remained deploy `6a630e4de510f100077bc120` at source commit `a6d3f1c97a93d48789435457769fd627c305ff27`.

This is an intentional release freeze, not an outage. Never change production `EURO28_DEPLOYED_DB_CONTRACT` from 20 to 35 merely to make a build pass.

## `OPS-007` — current Netlify context isolation

The current production Netlify project resolves:

| Context | Supabase project | Declared DB contract |
| --- | --- | ---: |
| `production` | production `vkfnsqdyhvtwyqkisxhk` | 20 |
| `deploy-preview` | development `iouzoutneyjpugbbtdem` | 35 |
| `branch-deploy` | development `iouzoutneyjpugbbtdem` | 35 |
| `dev` | development `iouzoutneyjpugbbtdem` | 35 |

`scripts/validate-netlify-environment.mjs` rejects crossed, missing or unknown Supabase contexts. A guarded deploy preview reached ready state and the regression suite passes. `OPS-007` remains resolved for this Netlify project.

This resolution does not classify every separately maintained Netlify site and does not prove authenticated preview journeys.

## `OPS-008` — public legacy development site

A separate Netlify site named `euro28-predictor-dev` was verified:

| Field | Value |
| --- | --- |
| Site ID | `e729912b-7fd7-4bd4-b7c1-d1ad7401f6fd` |
| Public URL | `https://euro28-predictor-dev.netlify.app` |
| Source repository | `nickygregal12-cmyk/worldcup2026` |
| Source branch | `euro28-development` |
| Source commit | `b6b33fe744601326432439f7e4e75002d3d2d924` |
| Current deploy | `6a5b8d18cb065545ee13da67`, ready |
| Supabase | inactive legacy staging project `gcfdwobpnanjchcnvdco` |
| Flags | `VITE_APP_ENV=staging`; `VITE_ENABLE_TIME_TRAVEL=true` |
| Functions | `_observability`, `health`, `scheduled-heartbeat` |
| Schedule | hourly `scheduled-heartbeat` |
| Access | public; no password or team-login requirement |

It is not a current Euro 2028 development, staging, preview or rollback target.

Issue #27 owns the separate legacy decision. Do not use, repoint, redeploy, pause, delete or alter that site, its World Cup source repository, functions, schedule or backend from this workstream.

## `AUTH-001` — Turnstile environment separation

The current production Netlify project scopes one real `VITE_TURNSTILE_SITE_KEY` value to all contexts.

Repository `.env.example` states that when the value is set:

- auth forms render Turnstile;
- `captchaToken` is sent to Supabase Auth;
- Supabase requires the matching CAPTCHA provider/secret;
- key/secret or enabled/disabled mismatches cause auth failure.

Read-only evidence:

- recent production sign-ups from `euro28predictor.com` completed successfully with no CAPTCHA-validation errors in retained Auth logs;
- development Auth logs had no recent requests;
- connected tools cannot read the Cloudflare widget hostname list or development Supabase CAPTCHA toggle/provider/secret.

Current Cloudflare guidance does not support hostname wildcards, limits Free widgets to ten hostnames and recommends separate production/development configurations. Do not add broad `netlify.app` access to cover dynamic previews.

Issue #28 requires one explicit non-production model:

1. development CAPTCHA off and non-production site key unset;
2. Cloudflare always-pass test site key plus matching test secret in development Supabase;
3. dedicated development widget plus matching development Supabase secret.

Production retains a separate real key/secret and restricted production hostnames. A successful static preview build does not prove preview login, signup or recovery works.

## Current production data and recovery snapshot

Read-only verification on 24 July 2026 found:

| Object | Count / value |
| --- | ---: |
| Database size | approximately 12 MB |
| Auth users / profiles | 5 / 5 |
| Entries / submitted entries | 5 / 1 |
| Match predictions | 36 |
| Predicted tie resolutions | 2 |
| Predicted progression rows | 8 |
| Matches with stored scores | 0 |
| Storage buckets / objects | 0 / 0 |
| Edge Functions | 0 |

Total users/profiles/entries may increase through legitimate signup activity. The submitted-entry source invariants, rather than total-account count, are the rollout guards.

Recovery-relevant facts:

- production is on Supabase Free; automatic backup/PITR must not be assumed;
- `auth.users` has custom trigger `on_auth_user_created`, calling `public.handle_new_user()`;
- no existing qualifying dump, checksum, off-site custody or restore-test evidence was found;
- repository tooling can create a guarded logical bundle, but prepared tooling is not recovery evidence.

The migration gate stays closed until an approved operator creates, encrypts, stores, retrieves, checksum-verifies and successfully restores a fresh production bundle.

## Verified development database contract

Migrations 21–35 are applied on current hosted development. Verified boundaries include:

- private resolver schema denied to browser roles;
- canonical TypeScript/PostgreSQL predicted group ordering;
- RPC-only submission and server-derived group positions;
- same-tournament and lock guards;
- authoritative result lifecycle and immutable revisions;
- serialized scoring;
- predicted bracket replay and real winner propagation;
- atomic expected-version bracket replacement;
- zero anonymous public-function execution;
- exact authenticated/service allowlists and fixed helper search paths;
- pending-write submission settlement;
- version-safe persisted score clearing;
- direct match-prediction deletion denied;
- stale/unknown deletion versions rejected with `PT409`;
- derived-position invalidation, idempotency and post-lock refusal.

These are not production capabilities until the full migrations 21–35 rollout is applied and verified there.

## Current finding positions

- `OPS-006`: open; production pair incompatible, further incompatible deployment contained.
- `OPS-007`: resolved for current production Netlify context isolation.
- `OPS-008`: open; issue #27 owns legacy-site classification and action.
- `AUTH-001`: open; issue #28 owns production/non-production CAPTCHA separation.
- `SECURITY-003`: implemented repository/development; production pending migrations 21–35.
- `REL-003`: repository tests pass; production/browser closure pending.
- `DATA-005`: repository/development passes; production RPC/browser closure pending.

## Production-entry compatibility proof

The one submitted production entry was replayed on development using stable match/team references. Rollout fingerprints remain:

- 36 predictions: `8d76619fe4b44fdac17de1cc2afe5aaa`;
- two tie decisions: `a4dcf183f5c48e3ba11ff75c59622598`;
- eight progression rows: `0d7bc491daa9b24013204d061a2d38f1`.

The replay produced 24 derived positions, resolved all eight R16 fixtures, passed full bracket replay/submission validation and retained the production submission timestamp.

Any source payload, submitted timestamp or fingerprint change requires a fresh production-to-development replay. Do not weaken rollout guards to accommodate changed source data.

## Production baseline and migration history

The production baseline verifier returned every migration 1–20 structural check true. `supabase_migrations.schema_migrations` does not exist in production.

Controlled rollout order:

1. verify current ready deploy, repository contract and production declared contract;
2. create and prove the encrypted off-site recovery artifact through a disposable restore;
3. rerun production baseline and source preflights;
4. inspect `supabase migration list` against production;
5. apply only the prepared metadata repair for proven migrations 1–20;
6. require migrations 1–20 aligned and 21–35 pending;
7. require `supabase db push --dry-run` to show migrations 21–35 only;
8. obtain explicit approval before SQL execution;
9. apply migrations 21–35 and pass post-verification/advisors;
10. run authenticated production smoke tests against the existing ready application;
11. only then change production contract 20 to 35 and retry the approved deployment;
12. verify the ready production pointer advances and record the exact release/schema pair.

Never edit migration history directly, mark absent SQL as applied or lift the deploy gate early.

## Current blockers

| Group | Open position |
| --- | --- |
| Production compatibility | `OPS-006`: production lacks two required RPCs; migrations 21–35 rollout or another explicitly compatible application baseline is required. |
| Recovery | `OPS-003`: no qualifying encrypted off-site backup or successful disposable restore. |
| Migration history | Exact 1–20 metadata repair only in the approved production window; dry run must show 21–35 only. |
| Legacy environment | `OPS-008` / issue #27: public World Cup-sourced legacy site awaits a separate owner decision. |
| Non-production auth | `AUTH-001` / issue #28: Turnstile/CAPTCHA context model and preview auth journeys are unverified. |
| Hosted function security | `SECURITY-003`: production pending migrations 21–35. |
| Auth security | Leaked-password protection remains disabled and requires a separate approved Auth change. |
| Entry reliability | `REL-003` and `DATA-005` await compatible-production browser closure; `REL-002` and `REL-006` remain unimplemented. |
| Product completeness | Automatic real R16 population, auto-submit, reminders and browser result administration remain absent. |
| Test assurance | No Playwright or equivalent authenticated browser E2E suite. `TEST-002`: the database-parity gate does not fire for `scripts/database-rollout/**`. |
| Quality governance | `DOC-004` (charter absent), `DOC-005` (baseline identifiers lost), `DOC-001` (reopened). Repair before the next remediation batch so that batch can be measured. |
| Official data | Final regulations, qualified teams, draw, fixtures/times and lock instant remain future dependencies. |

## Scoring status

`docs/scoring-rules.md`, `src/domain/tournament/scoringConfig.ts` and SQL remain aligned:

- group result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

No reliability, deletion, backup, environment, deployment-contract, legacy-site or CAPTCHA inspection changed scoring values.

## Immediate order of work

1. Choose the trusted backup machine, encryption/custody method, off-site destination, operator and recovery reviewer.
2. Freeze approved production writes/deployments and verify the current ready release plus contract identities.
3. Rerun both production preflights.
4. Create the production logical bundle.
5. Encrypt/store it off-site, retrieve it and restore it to a disposable target.
6. Retain reviewed non-secret restore evidence; preferably rehearse migrations 21–35 from the restored backup.
7. Only then approve the production migration window.
8. Apply the exact 1–20 history repair and require a 21–35-only dry run.
9. Apply migrations 21–35 only after explicit approval.
10. Run post-verification, advisors and authenticated production smoke journeys.
11. Change production contract 20 to 35 only after step 10 passes; retry and verify the approved deploy.
12. Resolve `AUTH-001` through issue #28 and verify preview login/signup/recovery.
13. Resolve `OPS-008` through issue #27 in a separate legacy workstream; do not touch the World Cup environment from this repository.
14. Enable leaked-password protection through a separate approved Auth workstream.
15. Address `REL-002`, then `REL-006`, before automatic real R16 population.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. latest formal audit and reconciliation notes;
5. dated audits and archived risk evidence;
6. roadmap/TODO history for intent only.

Do not claim production is migrated, recovery-ready, preview-auth verified or `REL-003`/`DATA-005` closed until the corresponding evidence gates pass.