# Current quality status

> This is the live implementation and operations status document. Current code, current migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Evidence identity

| Field | Current value |
| --- | --- |
| Latest formal audit | [`2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md), designation `2026-07-23L` |
| Latest hosted rehearsal | [`2026-07-23-hosted-migration-rehearsal.md`](reconciliations/2026-07-23-hosted-migration-rehearsal.md) |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository migration count | 33 |
| Development Supabase | `iouzoutneyjpugbbtdem` — migrations 21–33 semantic contract applied and verified; remote migration history still requires CLI reconciliation |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — original 20-migration hosted shape; production remains unchanged |
| Production preflight | Hardened read-only preflight passed on 23 July 2026, including exact submitted timestamp and rehearsed payload fingerprints |

Project references identify environments. Credentials and private keys must not be committed to documentation.

## Current verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** Full disposable migration/database CI remains green. |
| Hosted development | **Semantically current through migration 33 and cleaned to the expected post-rollout mirror.** Migration-history metadata is not yet a clean mirror of repository timestamps. |
| Current production release | **Critical deployment mismatch remains.** The post-PR #14 client is deployed against the original 20-migration production schema. |
| Production migration readiness | **Preflight passed and rollout package prepared; execution not approved or performed.** |
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

Migrations 21–33 were then applied in timestamp order. Verified boundaries include:

- private PostgreSQL resolver schema denied to browser roles;
- RPC-only submission and server-derived group positions;
- same-tournament prediction guards;
- authoritative regulation/extra-time/penalty result lifecycle;
- immutable result revision history;
- serialized scoring recomputation;
- real winner propagation;
- full predicted bracket-tree replay;
- atomic expected-version complete-bracket replacement.

Migration 30’s exact revision-table revoke was applied through SQL after the connector wrapper blocked that single statement; the resulting privileges were verified directly.

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

The hardened post-rollout verifier also returned `overall_pass = true` against cleaned migrated development, including exact payload/timestamp preservation and complete result/revision privilege checks.

## Current blockers

| Group | Open position |
| --- | --- |
| Production compatibility | `OPS-006`: execute the approved migrations 21–33 rollout or restore another explicitly compatible release pair. |
| Migration history | Original hosted migrations were manually applied. Reconcile remote history with proven schema effects before `db push`. |
| Recovery | Obtain verified production backup/export evidence and name the recovery decision owner. |
| Environment isolation | `OPS-007`: production Netlify deploy-preview and branch contexts inherit production Supabase configuration. |
| Hosted function security | `SECURITY-003`: legacy mutable search paths and unnecessary browser execution grants remain. |
| Entry reliability | `REL-003`: manual submit does not flush/await pending debounced saves. |
| Product completeness | Automatic real R16 population, auto-submit, reminder emails and browser result administration remain absent. |
| Test assurance | No Playwright or equivalent authenticated browser E2E critical journeys. |
| Official data | Final regulations, qualified teams, draw, exact fixtures/times and lock instant remain future dependencies. |

## Migration-history position

The semantic development schema is current, but its remote migration-history table contains tool-generated timestamps for 12 operations; migration 30 was executed separately. The original 1–20 hosted changes were also applied manually.

Before a CLI rollout:

1. run `supabase migration list` against the explicitly linked target;
2. mark only independently proven existing migrations as applied using `supabase migration repair`;
3. rerun the list;
4. require `supabase db push --dry-run` to show only genuinely pending files.

Never use migration-history repair to claim missing SQL has executed.

## Scoring status

`docs/scoring-rules.md`, `src/domain/tournament/scoringConfig.ts` and the SQL scorer remain aligned:

- group correct result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 for the complete order;
- knockout progression 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

No migration rehearsal changed scoring values. Automatic deadline submission remains a documented rule but is not implemented (`FUNC-002`).

## Immediate order of work

1. Review and explicitly approve the production rollout window and recovery owner.
2. Obtain production backup/export and recovery evidence.
3. Re-run the committed production preflight immediately before the change; any fingerprint or timestamp change requires a new clone/replay rehearsal.
4. Reconcile production migration history and require a clean `db push --dry-run` showing migrations 21–33 only.
5. Explicitly approve and execute the controlled production rollout.
6. Run database post-verification and production application bracket save/reload smoke tests.
7. Isolate production Netlify preview contexts (`OPS-007`).
8. Run the separate legacy function grant/search-path hardening batch (`SECURITY-003`).
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