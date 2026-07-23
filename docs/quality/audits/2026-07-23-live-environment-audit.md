# Euro 2028 Predictor — Live Repository and Hosted Environment Audit

**Audit designation:** `2026-07-23L`  
**Audit date:** 23 July 2026  
**Mode:** Read-only evidence audit followed by a separate documentation-only reconciliation  
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`  
**Authoritative branch:** `main`  
**Audited repository commit:** `51d8ac607ee9d04bc932df1fea01a488f844f05a`  
**Production Netlify deploy:** same commit, ready  
**Development Supabase:** `iouzoutneyjpugbbtdem`  
**Production Supabase:** `vkfnsqdyhvtwyqkisxhk`

No application code, migration, hosted database data, Auth setting, Netlify setting or deployment was changed during the audit. Hosted database inspection used read-only SQL only. The documentation reconciliation that follows this report is isolated on a review branch.

## Executive verdict

| Area | Verdict |
| --- | --- |
| Repository development | **Safe to continue under controlled PR and CI discipline.** The repository has strong pure-domain coverage, disposable PostgreSQL integration tests and locally implemented integrity controls. |
| Current production deployment | **Not internally compatible with its database and not ready for a scored competition.** The deployed client is newer than the hosted schema. |
| Hosted database integrity | **Critical repository fixes are not deployed.** Both hosted projects remain on the original 20-migration shape. |
| Documentation | **Materially stale before this reconciliation.** Current-status, migration, agent and planning documents did not reflect the live hosted evidence. |

## Most important findings

### `OPS-006` — production application and database are on incompatible release states

**Severity:** Critical  
**Status:** Confirmed

Netlify production serves repository commit `51d8ac6`, which includes PR #14. The current bracket persistence service calls `replace_predicted_progression(...)` for every bracket replacement. The production database does not contain that function and still grants authenticated direct insert/update/delete privileges on `predicted_progression`.

Consequences:

- the current production bracket-save path is expected to fail at the RPC boundary;
- the intended atomic server replacement is not active;
- the deployed client and production schema cannot be described as one tested release;
- a code-only rollback or a migration rollout must be planned explicitly; neither should be improvised.

This is the first recovery priority. Do not continue ordinary production deployments while application/schema compatibility is unresolved.

### `DATA-001`, `SECURITY-001` and `SECURITY-002` remain live in both hosted databases

The repository implements RPC-only submission, server-derived predicted group positions and client-denied writes through PR #9. Neither hosted database has those migrations.

Direct read-only inspection confirmed on both development and production:

- authenticated users retain `UPDATE` privilege on `entries`;
- `entries` still uses the broad owner `ALL` policy;
- authenticated users retain `INSERT` and `UPDATE` on `predicted_group_positions`;
- `predicted_group_positions` still uses a broad owner `ALL` policy;
- the current private resolver and entry-boundary functions are absent.

The original competition-integrity defects therefore remain exploitable in hosted environments even though they are contained in the repository/local database chain.

### `DATA-002`, `FUNC-001` and `REL-004` are repository-only controls

Both hosted databases lack:

- authoritative result-state and result-method columns;
- 90-minute, 120-minute and penalty score fields;
- `winner_team_id` and result revisions;
- protected confirm/correct/clear result functions;
- the private bracket-tree validator;
- atomic complete-bracket replacement.

Production has no scored matches, which is favourable for the result-lifecycle preflight. Development has 12 scored matches and therefore cannot accept the result-lifecycle migration without explicit reset or classification/remediation.

### `OPS-007` — production Netlify deploy contexts inherit production Supabase configuration

**Severity:** High  
**Status:** Confirmed configuration risk

The production Netlify project's Supabase URL, publishable key and Turnstile site key are scoped to `all` deploy contexts. That includes deploy previews and branch deploys for the production site. The repository rule says previews must not point at production Supabase, but the current Netlify configuration does not enforce that rule.

The separate development Netlify site does not remove this risk from previews created by the production project. Production-project previews should use a non-production backend or be disabled/protected until context-specific values are configured.

### `SECURITY-003` — hosted exposed-function grants need a dedicated permission hardening review

**Severity:** High  
**Status:** Confirmed configuration; function-specific impact requires triage

Supabase's production security advisor reports:

- legacy functions with mutable `search_path`;
- internal-looking group-order helpers executable by browser roles;
- maintenance, trigger and score-recompute `SECURITY DEFINER` functions executable by `anon` and/or `authenticated`;
- leaked-password protection disabled.

Some public RPCs intentionally perform their own `auth.uid()` checks, so an advisor warning is not automatically an exploit. Trigger helpers, internal helpers and maintenance functions should nevertheless not retain blanket browser execution grants unless an explicit contract requires it. Review each exposed function and revoke by default.

## Hosted data and rollout evidence

### Production

Read-only aggregate inspection found:

- 3 profiles and 3 entries;
- 1 submitted entry;
- 36 match predictions, 2 saved tie resolutions and a complete 8-row `4/2/1/1` progression shape for that submitted entry;
- 0 stored match results;
- 0 cross-tournament anomalies in the inspected prediction relationships;
- the provisional lock remains `2028-06-09 00:00:00+00` and must be replaced by the official opening-match kickoff instant.

This is encouraging but is not a migration dry run. The submitted entry still needs to pass the exact repository preflight and bracket replay before any production migration is approved.

### Development

Read-only aggregate inspection found:

- 23 profiles and 23 entries;
- 22 submitted entries;
- 12 scored matches;
- 20 submitted entries with the legacy 16-row progression representation;
- 2 submitted entries with the current 8-row `4/2/1/1` representation;
- no cross-tournament anomalies in the inspected prediction relationships.

The later migration chain is expected to fail closed against this data. Because this is development seed/test data, a reviewed development reset may be safer than attempting to preserve every hostile fixture. Production must never be treated the same way.

## Repository and CI verification

The current repository contains:

- 33 append-only migration files: the original 20 plus 13 migrations from PRs #7, #9, #11, #12 and #14;
- application CI for install, build/type-check, lint, tests and high-severity production dependency audit;
- database parity CI for disposable Supabase rebuild, database lint, pgTAP and TypeScript/PostgreSQL differential parity;
- pure TypeScript group ordering and scoring configuration;
- local PostgreSQL entry, result, bracket-tree and atomic-persistence boundaries.

PR #14's application CI run #71 and database parity run #40 both passed. There is still no browser E2E framework or complete authenticated critical-journey suite.

## Scoring audit

The authoritative values remain aligned between `docs/scoring-rules.md` and `src/domain/tournament/scoringConfig.ts`:

| Area | Current value |
| --- | --- |
| Group correct result | 3 |
| Group exact score | 5 total, not cumulative |
| Joker | doubles group-match points only; 5 available |
| Correct group position | 2 per team |
| Complete group order bonus | 5 |
| R16 / QF / SF / Final / Champion | 10 / 15 / 20 / 25 / 40, stacking |
| Golden Boot | 25 |
| Group goals exact / within 5 / within 10 | 40 / 30 / 20, tiered |

No scoring value changed in the post-audit integrity PRs. The scoring rule document still promises automatic deadline submission, but `FUNC-002` remains unimplemented and must continue to be described as a rule awaiting implementation rather than a current capability.

## Current feature classification

### Implemented in application and original hosted schema

- Supabase authentication and password recovery screens;
- welcome gate;
- group score entry and jokers;
- predicted group tables and manual tie decisions;
- best-third calculation and winner-only Original Predictor bracket UI;
- Golden Boot selection and derived group-goals prediction;
- review/manual submission UI;
- overall/private leagues, invites and league membership flows;
- H2H, match list, match centre, own profile and points breakdown;
- share-card and scoring/leaderboard presentation.

### Implemented in repository/local database but not hosted

- private TypeScript/PostgreSQL predicted-group-order parity;
- RPC-only submission and derived predicted group positions;
- same-tournament prediction guards;
- authoritative result lifecycle and immutable revisions;
- serialized scoring recomputation;
- real knockout winner propagation;
- complete predicted bracket-tree replay;
- atomic complete-bracket replacement.

### Partially implemented

- admin/result operations: repository server functions and runbook exist, but no authenticated browser admin role/page;
- other-player profiles and richer H2H states;
- operational recovery and monitoring;
- environment isolation: separate projects exist, but production preview contexts are not isolated;
- automated testing: strong unit/component/database coverage, but no browser E2E.

### Planned or documented but not implemented

- automatic real Round of 16 population;
- pending-write flush before manual submission;
- automatic deadline submission;
- deadline reminder emails;
- browser result-entry administration;
- KO Predictor, Last Man Standing and Predictor Cup;
- wider expanded profile/H2H and tournament-state experience;
- verified backup/restore rehearsal and production monitoring.

## Existing findings retested

| Finding | Fresh status |
| --- | --- |
| `DATA-001`, `SECURITY-001`, `SECURITY-002` | Implemented and tested locally; **open in both hosted databases**. |
| `DATA-002` | Implemented and tested locally; **open in both hosted databases**. |
| `OPS-001` | **Resolved.** Repository rollback instructions preserve the production/development boundary, and production Netlify currently references production Supabase. |
| `DATA-003` | Partially addressed; wider immutable/reference constraints remain open. |
| `FUNC-001` | Implemented locally; hosted rollout remains open. |
| `FUNC-002` | Open. |
| `REL-001` | Materially addressed locally; hosted rollout remains open. |
| `DATA-004`, `DATA-005`, `REL-002`, `REL-003`, `DATA-006` | Open. |
| `REL-004` and `REL-007` | Implemented locally through atomic expected-version replacement; hosted rollout/open deployment mismatch remains. |
| `OPS-002` | Open; no version-controlled or hosted `profiles.role` column exists. |
| `TEST-001` | Partially resolved by CI and disposable database tests; browser E2E remains open. |
| `OPS-003` | Partially resolved by CI and safer rollback; monitoring, recovery and restore rehearsal remain open. |
| `OPS-005` | **Superseded by `OPS-002`.** Production does not contain the alleged untracked role column; the historical cutover statement was inaccurate. |
| `DOC-001` | Addressed by the documentation reconciliation paired with this audit. |
| `OPS-004` | CI Node version is pinned; Netlify runtime pinning remains unverified. |
| Remaining Medium/Low findings | No evidence of resolution unless explicitly recorded in the current risk register. |

## Required order of work

1. Freeze ordinary production promotion until app/schema compatibility is restored.
2. Choose and review a safe recovery boundary: compatible application rollback or a staged migration rollout. Do not point production at development.
3. Configure Netlify deploy-context isolation so previews cannot use production Supabase.
4. Prepare a read-only, exact production preflight for all 13 pending migrations, including complete replay of the existing submitted entry.
5. Decide how to reset/remediate the development seed data that blocks the later chain.
6. Review and revoke unnecessary browser execution grants on hosted `SECURITY DEFINER` functions; enable leaked-password protection if available on the plan.
7. After compatibility and hosted integrity are restored, implement `REL-003` pending-write flush and automatic real R16 population.
8. Add authenticated browser E2E and a verified backup/restore exercise before claiming launch readiness.

## Audit limitations

- No user account was created and no authenticated browser mutation was performed.
- Supabase Auth SMTP, redirect URLs, CAPTCHA secrets and email-confirmation settings were not directly readable through the available connector.
- GitHub branch-protection/required-check settings were not independently verified.
- No migration was applied and no destructive or remote-reset command was run.
- Final Euro 2028 regulations, qualified teams, draw results, per-match kickoff times and exact lock instant remain future official-data dependencies.
