# Production promotion batch classification

**Status date:** 7 August 2026  
**Status:** Proposed rehearsal boundaries; no production promotion authorised  
**Hosted support chain:** Development verified through contract 125  
**Repository chain:** `main` through contract 131  
**Authority:** Planning evidence for PR #545 only.

## Decision rule

A batch endpoint must be dependency-complete and give a useful stop/go checkpoint. It must not be chosen only because a fixed number of migrations has elapsed.

Production is at contract 63. Hosted Development is at 125. The repository is at 131. The production promotion chain is therefore classified in two layers: contracts 64–125 are eligible for rehearsal because the same chain is already hosted in Development; contracts 126–131 are repository-only and are **not** eligible for Production until Development hosts and verifies them.

## Proposed Batch A — contracts 64–67

**Endpoint:** contract **67**, `20260803180000_matchweek_lock_scope`

| Contract | Migration | Role |
| ---: | --- | --- |
| 64 | `cup_winner_deletion_semantics` | Closes retained winner/deletion behaviour before widening the product model. |
| 65 | `stage_c1_competition_season_foundation` | Introduces the competition/season foundation. |
| 66 | `c1b_game_catalogue_memberships` | Adds game catalogue and membership structure on that foundation. |
| 67 | `matchweek_lock_scope` | Moves lock scope to the model required by the season game path. |

### Why 67 is the first clean endpoint

Contract 68 is `season_fixtures`, the first migration that begins the domestic season gameplay spine. Stopping at 67 therefore leaves Production with a complete platform foundation but without partially introducing season fixtures, predictions or scoring.

This is the smallest meaningful rehearsal batch. It is preferred over stopping at 64, 65 or 66 because those are intermediate states inside one foundation sequence.

### Batch A exposure boundary

- no provider custody;
- no provider key, target, request or polling job;
- no `pg_net` installation;
- no season fixture, prediction or scoring data;
- no season game feature flag exposure;
- no Netlify production deployment implied.

### Required rehearsal evidence

1. Fresh encrypted backup of the verified contract-63 source.
2. Disposable restore that reproduces the contract-63 object fingerprints and aggregate counts.
3. Dry-run showing exactly contracts 64–67 pending in the approved batch and 68 onward excluded from execution.
4. Apply 64–67 to the disposable restore.
5. Contract-67 pgTAP/database parity and security inventory checks.
6. Prove the eleven recorded critical source counts remain unchanged unless a contract explicitly requires otherwise.
7. Prove `pg_net` remains absent and the only production-shaped cron job remains the existing automatic submission job.
8. Verify an application build compatible with both contract 63 and 67, because database and application deployment are separate decisions.

**Current readiness:** not ready. A fresh contract-63 backup/restore rehearsal and the remaining production-shaped evidence are still required.

## Proposed Batch B — contracts 68–96

**Endpoint:** contract **96**, `20260804243000_cup_tie_settlement_refusal_order`

This group builds the domestic season gameplay and scoring spine:

- season fixtures, predictions and scoring (68–70);
- Last Man Standing resolution, persistence, settlement and jobs (71–73, 84–89);
- season Cup rules, neutral sources, schedule and persisted domains (74–79);
- card lock/status/no-prefill and scheduler (80–83);
- season matchweek scores, replay, scoring job, standings and browser leaderboard read (90–95);
- deterministic refusal ordering for Cup tie settlement (96).

Contract 97 begins provider-ingestion custody, so 96 is the clean boundary before provider infrastructure enters the schema.

Required additional evidence includes settlement replay, correction replay, privilege/RLS diff review and proof that migration application invents no score, result, rank or lifecycle rows.

## Proposed Batch C — contracts 97–114

**Endpoint:** contract **114**, `20260805100000_season_card_rpcs`

This group contains provider custody and the competition lifecycle/mapping foundation while stopping before database-driven provider dispatch:

- provider response custody (97);
- neutral fixture facts and automatic-submission integrity fixes (98–100);
- Euro reveal scope and split-stage persistence (101–102);
- repeatable competition lineage and live caller conversion (103–104);
- split tables, terminal-aware rederive and Last Man Standing restart lifecycle (105–109);
- season Cup calendar and launch (110–111);
- provider entity mapping and round play windows (112–113);
- bounded season-card RPCs (114).

Contract 115 is `provider_poll_dispatch`; it installs/uses the outbound dispatch boundary and schedules it. Stopping at 114 prevents a schema promotion from incidentally enabling database-to-Edge-Function calling.

Provider custody at 97 remains inert evidence storage. No provider credentials, poll targets or requests are authorised by this batch.

## Proposed Batch D — contracts 115–125

**Endpoint:** contract **125**, `20260806160000_season_fixture_result_entry`

This is the highest contract currently hosted and verified in Development. It advances the deliberately separated execution and current read/write authorities:

- provider polling dispatch and `pg_net` boundary (115);
- season Last Man Standing read (116);
- provider fixture revision import and neutral fixture facts (117–118);
- rescheduled fixture locks (119);
- season Cup phase, play context and period standings reads (120–122);
- stale-window refresh and Cup split transition (123–124);
- protected season fixture result entry (125).

This batch requires separate approval for every hosted dependency:

- `pg_net` installation and residual grants;
- vault secrets;
- Edge Function deployment and caller-key configuration;
- cron dispatch job;
- poll targets;
- provider credentials;
- application feature exposure.

Applying the migrations must not be interpreted as permission to configure or call a provider. A no-op/unconfigured dispatch state is the required default unless separately authorised.

## Deferred Batch E — contracts 126–131

Contracts **126–131 are merged to `main` but are not hosted in Development**. They are therefore deliberately outside the current Production promotion target.

| Contract | Migration | Current status |
| ---: | --- | --- |
| 126 | `rejoin_before_start` | Repository-only; Development verification required first. |
| 127 | `season_competition_bootstrap` | Repository-only; Development verification required first. |
| 128 | `season_league_standings` | Repository-only; Development verification required first. |
| 129 | `season_head_to_head` | Repository-only; Development verification required first. |
| 130 | `season_prediction_consensus` | Repository-only; Development verification required first. |
| 131 | `period_standings_display_names` | Repository-only; Development verification required first. |

Before Batch E can become eligible for Production, Development must host the exact 126–131 chain and pass hosted migration inventory, database parity/pgTAP, Browser E2E and the feature-specific contract checks on that hosted state. Production must not leapfrog Development.

## Current recommendation

Proceed only with **Batch A rehearsal preparation to contract 67**:

- use the repaired production-backup authority so the source is validated at hosted contract 63 rather than the repository tip;
- prepare a disposable restore and exact 64–67 allowlist;
- run forward rehearsal;
- produce a readiness record;
- request explicit owner authorisation only after every Batch A gate passes.

Production remains at contract 63. Development remains the hosted support ceiling at contract 125 until separately advanced. Contracts 126–131 remain repository-only. This recommendation authorises planning and rehearsal only, not a hosted production change.
