# Current quality status

> This is the live implementation and operations status document. Current code, current migrations, executable tests and verified hosted evidence override older roadmap, TODO, audit and chat narratives.

## Audit identity

| Field | Current value |
| --- | --- |
| Latest formal audit | [`2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md), designation `2026-07-23L` |
| Audited repository commit | `51d8ac607ee9d04bc932df1fea01a488f844f05a` |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Production Netlify deploy | Ready, `main`, same audited commit |
| Development Supabase | `iouzoutneyjpugbbtdem`, active, original 20-migration hosted shape |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk`, active, original 20-migration hosted shape |
| Repository migration count | 33 |
| Hosted inspection | Read-only schema, policy, privilege and aggregate-data verification on 23 July 2026 |

Project references identify environments. Credentials and private keys must not be committed to documentation.

## Current verdicts

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue controlled development.** PRs #7, #9, #11, #12 and #14 have executable repository/local evidence. |
| Current production release | **Critical deployment mismatch.** The post-PR #14 client is deployed against the original 20-migration production schema. |
| Real scored competition | **Not ready.** Critical integrity controls are not live, browser E2E is absent and recovery is not rehearsed. |
| Hosted database assurance | **Directly inspected and confirmed behind the repository.** Both hosted projects lack the 13 later migrations. |
| Documentation | Reconciled by the documentation branch containing the live audit; historical planning remains non-authoritative. |

## Critical current condition

### Production application/schema incompatibility — `OPS-006`

The deployed client calls `replace_predicted_progression(...)`, introduced by PR #14. Production does not contain that RPC. Production still permits authenticated direct progression DML under the old owner policy.

Expected effect: bracket edits on the live application fail rather than persist through the intended atomic path. Treat this as the first recovery priority. Do not continue normal production promotion until a compatible application/database pair is restored through a reviewed plan.

### Repository fixes are not hosted fixes

The following are implemented and tested in disposable local PostgreSQL, but remain absent from development and production Supabase:

- RPC-only entry submission;
- server-derived predicted group positions;
- client-denied group-position and entry-status writes;
- same-tournament prediction guards;
- authoritative regulation/extra-time/penalty result lifecycle;
- immutable result revision history;
- serialized tournament score recomputation;
- real winner propagation into later fixtures;
- full predicted bracket-tree replay;
- atomic complete-bracket replacement.

The original `DATA-001`, `DATA-002`, `SECURITY-001` and `SECURITY-002` risks therefore remain open in hosted environments.

## Repository/local implementation evidence

Merged work after the original audit:

- PR #1 — baseline application CI;
- PRs #3–#4 — canonical TypeScript predicted group ordering;
- PR #6 — manual group and best-third tie resolution;
- PR #7 — private PostgreSQL resolver, pgTAP and differential parity;
- PR #9 — entry boundary, submission, derived group positions and same-tournament guards;
- PR #10 — safe production-only rollback boundary;
- PR #11 — authoritative result lifecycle, revisions and scoring serialization;
- PR #12 — predicted bracket replay and real winner propagation;
- PR #13 — documentation authority reconciliation;
- PR #14 — atomic, expected-version complete-bracket replacement.

PR #14 application CI run #71 and database parity run #40 passed. The current CI workflows cover reproducible install, build/type-check, lint, application tests, high-severity production dependency audit, migration rebuild, database lint, pgTAP and TypeScript/PostgreSQL parity.

## Hosted verification summary

### Production

- 3 profiles, 3 entries, 1 submitted entry;
- submitted entry has 36 match predictions, 2 tie resolutions and a complete 8-row `4/2/1/1` progression shape;
- no stored match results;
- no inspected cross-tournament prediction anomalies;
- no `profiles.role` column;
- no authoritative result columns/functions;
- no private resolver/bracket validator;
- no atomic bracket RPC;
- old broad owner policies and direct authenticated write privileges remain.

The production data shape is promising for a rollout, but it has not passed the exact migration preflights or complete bracket replay. No production migration is approved by this document.

### Development

- 23 profiles, 23 entries, 22 submitted entries;
- 12 scored matches;
- 20 submitted entries use the legacy 16-row progression representation;
- 2 submitted entries use the current 8-row representation;
- no inspected cross-tournament prediction anomalies.

The later migration chain is expected to fail closed on development because of existing results and legacy submitted brackets. Plan an explicit development reset or remediation. Never copy that reset logic to production.

## Current blockers

| Group | Open position |
| --- | --- |
| Release compatibility | `OPS-006`: deployed client and production schema are incompatible. |
| Hosted integrity | Apply/reconcile the 13 later migrations only through reviewed preflights and recovery planning. |
| Environment isolation | `OPS-007`: production Netlify deploy-preview and branch contexts inherit production Supabase configuration. |
| Hosted function security | `SECURITY-003`: review mutable search paths and unnecessary browser execution grants on `SECURITY DEFINER` functions. |
| Entry reliability | `REL-003`: manual submit does not flush/await pending debounced saves. |
| Data behavior | `DATA-004`, `DATA-005`, `DATA-006` and wider `DATA-003` remain open. |
| Product completeness | Automatic real R16 population, auto-submit, reminder emails and browser result administration remain absent. |
| Test assurance | No Playwright or equivalent authenticated browser E2E critical journeys. |
| Operations | Monitoring, backup verification and restore rehearsal remain incomplete. |
| Official data | Final regulations, qualified teams, draw, exact fixtures/times and lock instant remain future dependencies. |

## Security and configuration findings

- Production Netlify currently points to production Supabase, so the old cross-environment rollback hazard `OPS-001` is resolved.
- Production Netlify environment values are scoped to `all` contexts, which conflicts with the rule that previews must never use production Supabase.
- Supabase security advisor flags legacy mutable function search paths and numerous browser-executable `SECURITY DEFINER` functions; review each grant rather than assuming every warning is exploitable or harmless.
- Supabase leaked-password protection is disabled.
- The claimed production admin bootstrap did not create a version-controlled or hosted `profiles.role` column. `OPS-005` is superseded by the unresolved admin model finding `OPS-002`.

## Scoring status

`docs/scoring-rules.md`, `src/domain/tournament/scoringConfig.ts` and the SQL scorer remain aligned:

- group correct result 3; exact score 5 total;
- five jokers, doubling group-match points only;
- group positions 2 each plus 5 for the complete order;
- knockout progression 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group-goals bands 40 / 30 / 20, tiered.

No post-audit PR changed a scoring value. Automatic deadline submission remains a documented rule but is not implemented (`FUNC-002`).

## Immediate order of work

1. Restore a compatible production application/database pair; freeze ordinary production promotion meanwhile.
2. Isolate production Netlify deploy contexts from production Supabase.
3. Prepare exact read-only preflights and a reviewed rollout/remediation/backup plan for the 13 pending migrations.
4. Resolve development legacy seed incompatibility separately.
5. Harden hosted function grants/search paths and review leaked-password protection.
6. Close `REL-003` by flushing or awaiting every pending write before manual submit.
7. Implement automatic real R16 population from confirmed standings and the authoritative best-third table.
8. Add browser E2E and rehearse backup/restore before launch-readiness claims.

## Documentation authority

Use sources in this order:

1. current `main` code, migrations and executable tests;
2. verified current hosted evidence;
3. this file;
4. the latest formal audit and workstream reconciliation notes;
5. dated audits and archived risk evidence;
6. roadmap/build-todo history for product intent only.

Do not claim a repository/local fix is deployed until an approved hosted rollout is applied and verified. Do not infer hosted compatibility from a successful Netlify build.
