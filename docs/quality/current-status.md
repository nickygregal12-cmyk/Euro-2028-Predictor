# Current quality status

> This is the live implementation and operations status document. Current code, migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Latest formal audit | [`2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md), designation `2026-07-23L` |
| Current production release evidence | [`2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md) |
| Hosted migration rehearsal | [`2026-07-23-hosted-migration-rehearsal.md`](reconciliations/2026-07-23-hosted-migration-rehearsal.md) |
| Function hardening | [`2026-07-24-function-privilege-hardening.md`](reconciliations/2026-07-24-function-privilege-hardening.md) |
| Submission settlement | [`2026-07-24-submit-save-barrier.md`](reconciliations/2026-07-24-submit-save-barrier.md) |
| Persisted score clearing | [`2026-07-24-score-clearing.md`](reconciliations/2026-07-24-score-clearing.md) |
| Production baseline proof | [`2026-07-23-production-migration-history-1-20.md`](reconciliations/2026-07-23-production-migration-history-1-20.md) |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Production application-code baseline | `a403b0796853453cb4115aea55729aced192a6ca` — introduced the currently deployed bracket and score-clear RPC dependencies |
| Netlify release identity | May advance on docs-only `main` merges without executable code changes. Verify the current deploy live before an operation. First verified docs-only descendant: `83e071c2`, deploy `6a62c93afeb9b400086e1e3f`. |
| Repository migration count | 35 |
| Development Supabase | `iouzoutneyjpugbbtdem` — migrations 21–35 semantic contract applied and verified; remote history still requires CLI reconciliation |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — original 20-migration hosted shape; no tracked migration-history table |
| Production preflight | Hardened source/baseline preflights passed on 23 July 2026; post-deploy RPC/privilege/count snapshot verified on 24 July 2026 |

### Release identity rule

A Netlify release commit is not always an application-code change. Documentation-only merges can create a later production release with the same built application. Operational checks must therefore record both:

1. the current Netlify release/deploy, verified live;
2. the last executable application-code baseline relevant to database compatibility.

Do not hard-code one release hash as permanently current.

## Current verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** The chain contains 35 migrations with application/database coverage for submission settlement and persisted score clearing. |
| Hosted development | **Semantically current through migration 35.** Exact data, ACL, deletion and compatibility checks pass; migration-history metadata is not a clean repository mirror. |
| Current production application/database pair | **Critical mismatch.** The executable client baseline depends on two RPCs absent from the original 20-migration production schema. Docs-only release descendants do not change that verdict. |
| Production migration readiness | **Prepared, not approved.** Baseline/source preflights and development rehearsal exist for migrations 21–35; backup/recovery evidence, operator approval and the change window remain required. |
| Real scored competition | **Not ready.** Production integrity controls are absent, browser E2E is missing and recovery has not been rehearsed. |

## Critical current condition — `OPS-006`

Application-code baseline `a403b0796853453cb4115aea55729aced192a6ca` depends on two absent production RPCs:

1. `replace_predicted_progression(...)` for atomic complete-bracket persistence;
2. `delete_match_prediction(...)` for expected-version persisted score clearing.

Read-only production verification confirmed both functions are absent. Production retains the old broad owner `ALL` policies and direct authenticated write/delete privileges that migrations 21–35 remove.

Expected live effects:

- bracket edits fail rather than persist atomically;
- clearing a previously stored score fails through the save controller, and reload can restore the old row;
- no old direct-table fallback is used by the new client.

The score-clear path fails closed instead of falsely reporting success, but it is not operational in production.

PR #21’s docs-only release changed the Netlify commit/deploy identity but did not change executable application code or this mismatch. Treat future docs-only descendants the same unless their diff changes executable/configuration files.

Ordinary production promotion remains frozen until a compatible application/database pair is restored through the approved rollout. Never point production at development Supabase.

## Current production data snapshot

Read-only verification after the application-code deployment found:

| Object | Count |
| --- | ---: |
| Profiles | 4 |
| Entries | 4 |
| Submitted entries | 1 |
| Match predictions | 36 |
| Predicted tie resolutions | 2 |
| Predicted progression rows | 8 |
| Matches with stored scores | 0 |

The earlier audit had three profiles and entries. The current count of four is live user data, not evidence that a migration ran. No production row was changed during verification.

## Verified development database contract

Migrations 21–35 are applied on hosted development. Verified boundaries include:

- private resolver schema denied to browser roles;
- canonical TypeScript/PostgreSQL predicted group ordering;
- RPC-only submission and server-derived group positions;
- same-tournament and pre-lock guards;
- authoritative regulation/extra-time/penalty result lifecycle;
- immutable revisions and serialized score recomputation;
- real winner propagation and predicted bracket replay;
- atomic expected-version complete-bracket replacement;
- zero anonymous public-function execution;
- exact authenticated/service allowlists, owner-only defaults and fixed helper paths;
- version-safe persisted score clearing;
- direct match-prediction deletion denied to API roles;
- stale/unknown deletion versions rejected with `PT409`;
- derived-position invalidation, idempotency and post-lock refusal.

## Current finding positions

### `SECURITY-003`

Implemented and verified in repository/development through migrations 34–35. Production retains the old broad grants until migrations 21–35 roll out. Leaked-password protection remains a separate Auth configuration action.

### `REL-003`

Manual submission flushes score/bracket debounces, waits for match/tie/bracket/Golden Boot writes—including deletion—and blocks on terminal errors/conflicts. Repository tests pass. Closure still requires compatible-production browser and durable E2E evidence.

### `DATA-005`

The score-clear client is part of the deployed executable baseline, but production lacks migration 35 and its RPC. Repository/development expected-version deletion, conflict protection, derived-position invalidation, idempotency and lock behavior are verified. Production closure requires migrations 21–35 plus authenticated clear/reload/conflict/lock browser journeys.

## Production-entry compatibility proof

The one submitted production entry was mapped into development using stable match references and team names. Rollout guards remain:

- 36 predictions: `8d76619fe4b44fdac17de1cc2afe5aaa`;
- two tie decisions: `a4dcf183f5c48e3ba11ff75c59622598`;
- eight progression rows: `0d7bc491daa9b24013204d061a2d38f1`.

The clone produced 24 derived positions, resolved all eight R16 fixtures, passed full bracket replay and submission validation, and retained the production submission timestamp. Migration-35 hosted proof was rolled back.

Any source payload, timestamp or fingerprint change requires a fresh production-to-development replay.

## Production baseline and migration history

The baseline verifier returned every migration 1–20 structural check true. Read-only inspection confirmed `supabase_migrations.schema_migrations` does not exist in production.

Before production rollout:

1. verify the current Netlify deploy and compare executable changes with application-code baseline `a403b079`;
2. rerun `production-baseline-1-20-verification.sql` and `production-preflight.sql`;
3. inspect `supabase migration list` against the exact production project;
4. apply only the prepared metadata repair for proven migrations 1–20;
5. require 1–20 aligned and 21–35 pending;
6. require `supabase db push --dry-run` to show migrations 21–35 only;
7. obtain explicit approval before executing SQL.

Never edit migration history directly or mark missing SQL as applied.

## Current blockers

| Group | Open position |
| --- | --- |
| Production compatibility | `OPS-006`: executable baseline requires two absent RPCs; execute the approved migrations 21–35 rollout or restore another explicitly compatible application-code baseline. |
| Recovery | Obtain verified production backup/export evidence and name the operator/recovery decision owner. |
| Migration history | Apply the prepared 1–20 metadata-only repair only in the approved window, then require a 21–35-only dry run. |
| Environment/deployment isolation | `OPS-007`: production previews/branch deploys inherit production Supabase values; automatic `main` deploys also need an app/schema compatibility gate. |
| Hosted function security | `SECURITY-003`: repository/development fixed; production pending migrations 21–35. |
| Auth security | Leaked-password protection remains disabled and requires a separate approved Auth change. |
| Entry reliability | `REL-003` and `DATA-005` are repository/development complete but await production/browser closure. `REL-002` and `REL-006` remain unimplemented. |
| Product completeness | Automatic real R16 population, auto-submit, reminder emails and browser result administration remain absent. |
| Test assurance | No Playwright or equivalent authenticated browser E2E critical journeys. |
| Official data | Final regulations, qualified teams, draw, fixtures/times and lock instant remain future dependencies. |

## Scoring status

`docs/scoring-rules.md`, `src/domain/tournament/scoringConfig.ts` and SQL remain aligned:

- group result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

No reliability, deletion or security hardening changed scoring values. Automatic deadline submission remains documented but unimplemented (`FUNC-002`).

## Immediate order of work

1. Review and explicitly approve the production rollout window, operator and recovery owner.
2. Obtain production backup/export and recovery evidence.
3. Verify the current Netlify release and executable diff.
4. Rerun both production preflights immediately before change.
5. Apply the exact 1–20 history-only repair and require a dry run showing 21–35 only.
6. Execute migrations 21–35 only after explicit approval.
7. Run the exact post-rollout verifier, security advisors and application smoke tests.
8. Browser-verify bracket save/reload, immediate final-edit submission, error/conflict blocking and score clear/reload/conflict/lock behavior; add durable E2E and close `REL-003`/`DATA-005`.
9. Isolate Netlify preview contexts and add compatibility gating for automatic production deploys.
10. Enable leaked-password protection through a separate approved Auth workstream.
11. Address `REL-002`, then `REL-006`, before automatic real R16 population.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. latest formal audit and reconciliation notes;
5. dated audits and archived risk evidence;
6. roadmap/TODO history for intent only.

Do not claim production is migrated or `REL-003`/`DATA-005` are closed until the approved rollout and browser verification are complete.
