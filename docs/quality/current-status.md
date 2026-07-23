# Current quality status

> This is the live implementation and operations status document. Current code, current migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Latest formal audit | [`2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md), designation `2026-07-23L` |
| Latest hosted rehearsal | [`2026-07-23-hosted-migration-rehearsal.md`](reconciliations/2026-07-23-hosted-migration-rehearsal.md) |
| Function privilege hardening | [`2026-07-24-function-privilege-hardening.md`](reconciliations/2026-07-24-function-privilege-hardening.md) |
| Production baseline proof | [`2026-07-23-production-migration-history-1-20.md`](reconciliations/2026-07-23-production-migration-history-1-20.md) |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository migration count | 34 |
| Development Supabase | `iouzoutneyjpugbbtdem` — migrations 21–34 semantic contract applied and verified; remote migration history still requires CLI reconciliation |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — original 20-migration hosted shape; production remains unchanged |
| Production preflight | Hardened read-only preflight passed on 23 July 2026, including exact submitted timestamp and rehearsed payload fingerprints |
| Production history baseline | All structural effects for migrations 1–20 independently verified; hosted migration-history list remains empty |

Project references identify environments. Credentials and private keys must not be committed to documentation.

## Current verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** The migration chain now contains 34 files and executable privilege coverage. |
| Hosted development | **Semantically current through migration 34 and verified as the expected post-rollout mirror.** Migration-history metadata is not yet a clean mirror of repository timestamps. |
| Current production release | **Critical deployment mismatch remains.** The post-PR #14 client is deployed against the original 20-migration production schema. |
| Production migration readiness | **Baseline and entry preflights passed; migrations 21–34 are rehearsed; exact history-repair and rollout procedures are prepared; execution is not approved or performed.** |
| Real scored competition | **Not ready.** Production integrity controls are not live, browser E2E is absent and recovery is not rehearsed. |

## Critical current condition — `OPS-006`

The deployed client calls `replace_predicted_progression(...)`, introduced by PR #14. Production does not contain that RPC and still permits authenticated direct progression DML under the old owner policy.

Expected effect: bracket edits on the live application fail rather than persist through the intended atomic path. Ordinary production promotion remains frozen until a compatible application/database pair is restored through the reviewed hosted rollout procedure.

## Hosted development result

Development-only disposable competition state was cleared while preserving:

- 23 Auth-backed profiles;
- the Euro 2028 tournament;
- six groups and 24 provisional teams;
- the 51-match fixture skeleton.

Migrations 21–34 were applied in timestamp order. Verified boundaries include:

- private PostgreSQL resolver schema denied to browser roles;
- RPC-only submission and server-derived group positions;
- same-tournament prediction guards;
- authoritative regulation/extra-time/penalty result lifecycle;
- immutable result revision history;
- serialized scoring recomputation;
- real winner propagation;
- full predicted bracket-tree replay;
- atomic expected-version complete-bracket replacement;
- no anonymous execution of public application functions;
- exact authenticated and service-role function allowlists;
- owner-only default execution for future public functions;
- immutable search paths for the three previously mutable helpers.

Migration 30’s exact revision-table revoke was applied through SQL after the connector wrapper blocked that single statement; the resulting privileges were verified directly.

## Function privilege hardening — `SECURITY-003`

Migration `20260724001500_harden_function_privileges.sql` was applied to hosted development only.

It:

- revoked inherited and direct function execution from `PUBLIC`, `anon`, `authenticated` and `service_role` before regranting explicit allowlists;
- preserved the 15 authenticated application RPCs;
- limited scoring and result administration functions to `service_role`;
- removed direct execution of trigger, signup and internal helper functions;
- made future public functions owner-only by default;
- set empty search paths on `gen_invite_code()`, `_stage_ord(text)` and `enforce_write_version()`.

Live verification found no anonymous executable public functions, no missing or unexpected authenticated/service grants, and no remaining mutable-search-path advisor warning. The signup trigger and authenticated leaderboard, prediction-distribution and idempotent submission paths still worked.

Supabase’s advisor continues to warn that the intentionally authenticated `SECURITY DEFINER` application RPCs are callable by signed-in users. That is their designed API boundary; ownership, co-membership, lock and scope checks remain inside those functions. Leaked-password protection remains a separate Auth configuration action.

`SECURITY-003` is therefore **implemented and verified in repository/development; production pending**.

## Production-entry compatibility proof

The one submitted production entry was mapped into development using stable match references and team names. Current rollout-guard fingerprints matched for:

- all 36 predictions: `8d76619fe4b44fdac17de1cc2afe5aaa`;
- both manual tie decisions: `a4dcf183f5c48e3ba11ff75c59622598`;
- all eight progression rows: `0d7bc491daa9b24013204d061a2d38f1`.

The exact clone produced 24 server-derived group positions, resolved all eight R16 fixtures, passed the full 15-match bracket replay, passed the shared submission validator and submitted through `submit_entry()`.

The atomic RPC accepted the initial complete snapshot and rejected a deliberately stale snapshot with SQLSTATE `PT409` without changing the stored bracket.

## Result lifecycle proof

Hosted development successfully rehearsed:

1. confirming an R16 result;
2. propagating its winner into the correct QF side;
3. correcting the result to reverse the winner;
4. replacing the QF participant;
5. clearing the result and removing the propagated participant.

The fixtures were restored to scheduled/null-participant state and score events returned to zero. Three revisions proved the confirm/correct/clear audit path during rehearsal. After evidence capture, those development-only revisions were cleared and the clone timestamp was restored to the exact production timestamp, leaving zero revisions, zero score events and zero rank history.

## Production read-only preflight

The hardened committed production preflight returned `overall_structural_pass = true`.

Confirmed:

- exactly one submitted entry with timestamp `2026-07-21 21:51:49.639442+00`, before the configured lock;
- six complete groups with four teams, six valid fixtures and six predictions each;
- 36 predictions and exactly two valid exact-set tie decisions;
- all three rollout-guard fingerprints match the payload replayed on development;
- progression shape `4 QF / 2 SF / 1 final / 1 champion`;
- zero legacy group-position rows before migration 26 rebuilds them;
- zero legacy match scores, score events and rank history;
- zero inspected match/progression/group-position scope anomalies;
- complete knockout source tree `8 R16 / 4 QF / 2 SF / 1 final`;
- 14 valid unique winner-source references.

Production has zero predicted group-position rows under the old schema. The exact clone proves migrations 26–27 regenerate all 24 rows before submission revalidation.

The migrations 21–34 post-rollout verifier returned `overall_pass = true` against hosted development, including exact data fingerprints, object/table privileges and the complete function execution matrix.

## Production migration-history proof

The committed baseline verifier returned:

```text
all_structural_effects_present = true
```

All twenty per-migration checks passed. Evidence covers tables, columns, RLS, policies, constraints, FK deletion semantics, functions, triggers, scorer integration, Match Centre RPCs and write-version/submission guards.

The hosted migration-history API still returns no production migration rows. The rollout runbook therefore contains an exact history-only repair command for repository timestamps 1–20, followed by mandatory `migration list` and `db push --dry-run` checks.

Production still has the old broad function ACLs. Migration 34 is now the reviewed repair and must be applied as the final file in the migrations 21–34 production chain rather than replaying old migration files.

## Current blockers

| Group | Open position |
| --- | --- |
| Production compatibility | `OPS-006`: execute the approved migrations 21–34 rollout or restore another explicitly compatible release pair. |
| Migration history | Apply the prepared 1–20 metadata-only repair only inside the approved window, then require a dry run showing 21–34 only. |
| Recovery | Obtain verified production backup/export evidence and name the recovery decision owner. |
| Environment isolation | `OPS-007`: production Netlify deploy-preview and branch contexts inherit production Supabase configuration. |
| Hosted function security | `SECURITY-003`: repository/development fixed and verified through migration 34; production remains pending. |
| Auth security | Leaked-password protection remains disabled and requires a separately approved Auth configuration change. |
| Entry reliability | `REL-003`: manual submit does not flush/await pending debounced saves. |
| Product completeness | Automatic real R16 population, auto-submit, reminder emails and browser result administration remain absent. |
| Test assurance | No Playwright or equivalent authenticated browser E2E critical journeys. |
| Official data | Final regulations, qualified teams, draw, exact fixtures/times and lock instant remain future dependencies. |

## Migration-history position

The semantic development schema is current through migration 34, but its remote migration-history table contains tool-generated timestamps rather than a clean repository mirror.

Production’s migrations 1–20 were manually applied and all structural effects are independently verified. Production migration history remains empty because no metadata repair has been performed.

Before a CLI rollout:

1. run `scripts/database-rollout/production-baseline-1-20-verification.sql` and require all checks true;
2. run `supabase migration list` against the explicitly linked production target;
3. apply only the exact prepared 1–20 history repair from `docs/ops-hosted-migration-rollout.md`;
4. rerun the list and require 1–20 aligned with 21–34 pending;
5. require `supabase db push --dry-run` to show migrations 21–34 only.

Never use migration-history repair to claim missing SQL has executed. Do not mark migrations 21–34 applied before their SQL runs.

## Scoring status

`docs/scoring-rules.md`, `src/domain/tournament/scoringConfig.ts` and the SQL scorer remain aligned:

- group correct result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 for the complete order;
- knockout progression 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

No security hardening changed scoring values. Automatic deadline submission remains a documented rule but is not implemented (`FUNC-002`).

## Immediate order of work

1. Review and explicitly approve the production rollout window and recovery owner.
2. Obtain production backup/export and recovery evidence.
3. Re-run both committed production preflight scripts immediately before the change.
4. Apply the prepared 1–20 history-only repair and require a clean `db push --dry-run` showing migrations 21–34 only.
5. Explicitly approve and execute the controlled production rollout.
6. Run the migrations 21–34 database post-verification, security advisors and production application bracket save/reload smoke tests.
7. Isolate production Netlify preview contexts (`OPS-007`).
8. Enable leaked-password protection through the separately approved Auth-setting workstream.
9. Close `REL-003`, then implement automatic real R16 population.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. the latest formal audit and workstream reconciliation notes;
5. dated audits and archived risk evidence;
6. roadmap/build-todo history for product intent only.

Do not claim production is migrated until the approved rollout, post-verification and application smoke test are complete.