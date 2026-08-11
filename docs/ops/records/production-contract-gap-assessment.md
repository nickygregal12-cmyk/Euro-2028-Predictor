# Production contract gap assessment

**Status date:** 7 August 2026  
**Status:** Read-only assessment in progress; no production promotion authorised  
**Scope:** Define the evidence and staged route required to bring production forward from its current supported contract without mutating production.

## Current position

The repository is at contract **131** on `main`. Hosted Development is independently confirmed at contract **125**, ending at migration `20260806160000_season_fixture_result_entry`. Hosted Production is independently confirmed at contract **63**, ending at `20260729154931_prediction_consensus_minimum_cohort`. Promotion remains explicitly unauthorised.

Contracts **126–131 are repository-only** at this point. They are not yet part of a supported hosted promotion target and must not be promoted to Production before Development has hosted and verified the same chain.

This document starts the work recorded under `OPS-006`: production must not remain on an indefinitely frozen version with no declared support boundary, but the existence of a contract gap does not itself authorise closing it.

No database migration, Netlify production deployment, secret change, provider call, production write or production backup run is performed by this assessment.

## Verified Phase 0 evidence — first read-only pass

The following was read directly from hosted Supabase on 6 August 2026. The queries were metadata-only and made no writes.

| Evidence | Production reading | Development control |
| --- | --- | --- |
| Migration count | **63** | **125** |
| Latest migration | `20260729154931_prediction_consensus_minimum_cohort` | `20260806160000_season_fixture_result_entry` |
| PostgreSQL | 17 series, same managed release family as Development | same managed release family |
| `pg_cron` | installed, version `1.6.4` | not yet re-read in this pass |
| Vault | `supabase_vault` installed, version `0.3.1` | not yet re-read in this pass |
| `pg_net` | **not installed** | expected only from later provider-dispatch work; must be verified before its batch |
| Active cron jobs | one job: `process_due_entry_submissions()` every minute | not compared yet |
| Provider cron/targets | no provider cron job present in the production cron inventory | provider state not copied or inferred |

The production schema inventory at contract 63 contains 34 public tables, one public view and one `predictor_internal` table. That is a baseline description only; it is not yet an object-level parity proof.

### Security-advisor baseline

The hosted security advisor was run read-only. It reports:

- one mutable-search-path warning on `public.enforce_joker_rules`;
- leaked-password protection disabled as a hosted Auth setting;
- numerous informational `RLS enabled, no policy` findings on tables deliberately reached through bounded RPCs rather than direct table policies;
- security-definer executability warnings for the browser RPC surface.

These findings are **not automatically migration blockers**: many security-definer RPCs are intentionally browser reachable and must be judged against their internal identity/authority checks and the repository allowlist, not against the advisor title alone. The Phase 0 parity pass still has to distinguish accepted architecture, already-tracked risks and genuine production-only drift. The leaked-password setting remains a separate hosted action and is not corrected by schema promotion.

### First conclusion

The recorded contract-63 baseline reproduces exactly. No unexpected migration-history drift was found, and the provider-dispatch prerequisites have not appeared early in Production. This clears the first stop condition only: it does **not** clear object-level drift, recovery readiness or any migration batch.

## Why this cannot be treated as one 63 → 131 deployment

The gap contains multiple distinct change classes:

- competition and season schema expansion;
- scoring, settlement and lifecycle functions;
- browser-reachable RPC and privilege changes;
- provider-ingestion custody, scheduling and fixture-revision paths;
- cron, vault and `pg_net` dependencies;
- application routes and feature-flagged journeys;
- operational authority and hosted-state records;
- a repository-only tail at contracts 126–131 that has not yet been proven in hosted Development.

A single undifferentiated promotion would make failure attribution, rollback judgement and postflight verification needlessly broad. The promotion therefore requires reviewed batches with an explicit stop/go decision between them. Production must not be promoted beyond the highest contract already hosted and verified in Development.

## Phase 0 — remaining read-only evidence

Before batch selection, the assessment still must capture without exposing user data:

1. the production source/deploy commit and current Netlify production environment contract value;
2. Development extension and cron control readings;
3. relation, routine, RLS, grant and trigger fingerprints needed by the hosted parity controls;
4. row-count and invariant evidence for critical Auth/profile, tournament, prediction, scoring and league data;
5. performance-advisor findings and classification of security-advisor findings;
6. whether any production-only object drift exists outside the canonical migrations;
7. confirmation that the production backup workflow secrets remain configured and that its hosted-source expectation is correct before use;
8. a fresh list of contracts 64 onward classified by dependency, blast radius, hosted support state and rollback character.

This evidence must be attached to a reviewable record before any promotion workflow is enabled.

## Proposed promotion shape

The exact boundaries remain subject to Phase 0 evidence. The starting proposal is:

### Batch A — platform and competition foundations

Advance the schema and internal competition model only as far as the first stable multi-competition foundation. Exclude provider execution and exclude exposing unfinished season journeys.

Required proof:

- fresh encrypted production backup;
- disposable restore of the production source;
- forward rehearsal through the exact Batch A endpoint;
- full pgTAP/database parity at the endpoint;
- browser regression against a schema-compatible application build;
- zero pending migrations within the approved batch and all later migrations still pending.

### Batch B — season game and scoring spine

Advance the season fixture, prediction, scoring, standings and game lifecycle authorities needed for the domestic competition model.

Required proof:

- settlement and correction replay tests on restored production-shaped data;
- no invented score, result, rank or lifecycle rows during migration;
- privilege/RLS diff reviewed separately from structural diff;
- feature flags remain off unless their hosted dependencies are proven.

### Batch C — provider custody and acquisition path

Advance provider archive, mapping, scheduling and revision infrastructure, but do not configure credentials, poll targets or provider authority as an incidental part of schema promotion.

Required proof:

- server-only custody and service-role boundaries intact;
- no browser-reachable route into `net` or provider write authorities;
- cron jobs either deliberately unconfigured/no-op or separately approved;
- no provider request made during promotion verification.

### Batch D — hosted Development-supported target

Advance the remaining reviewed contracts only as far as the highest contract already hosted and verified in Development, currently **125**, then update application deployment and hosted-state records as separately authorised.

Required proof:

- exact-head CI, database parity and Browser E2E green;
- production postflight inventory agrees with the authorised target contract;
- Netlify production contract value matches the promoted database;
- rollback route, monitoring ownership and incident decision points recorded;
- production support target stated explicitly rather than inferred from `main`.

### Batch E — repository-only contracts 126–131

Contracts **126–131** are merged repository history but are not yet hosted in Development. They are therefore **deferred from Production**. Before they can become a production target, Development must first host the exact chain and pass hosted inventory, database parity, Browser E2E and any feature-specific verification required by those contracts.

## Stop conditions

The assessment or any future promotion must stop on the first occurrence of:

- production migration history not matching the recorded contract-63 baseline;
- unreviewed production-only schema, grant, trigger, cron or function drift;
- backup restore or forward rehearsal failure;
- a migration that is not additive where the approved batch assumes additive rollout;
- unexpected writes or derived-row creation during rehearsal;
- inability to prove the application build is compatible with both pre- and post-batch schema at the chosen handover point;
- missing production credential/backup custody evidence;
- an attempted Production target above the highest contract already hosted and verified in Development;
- any required check being cancelled, skipped or unavailable rather than passed.

## Work now started

- [x] Establish a dedicated branch for production-gap assessment.
- [x] Record the repository/development/production boundary.
- [x] Define the read-only evidence required before batch selection.
- [x] Define an initial staged promotion shape and stop conditions.
- [x] Confirm production migration history directly against hosted Production.
- [x] Capture the first extension, cron and security-advisor baseline.
- [x] Classify contracts 64–125 into dependency-complete rehearsal batches.
- [x] Record contracts 126–131 as repository-only and ineligible for Production until Development hosts and verifies them.
- [x] Repair the production backup workflow so it validates the hosted contract-63 source independently of the repository tip.
- [ ] Complete object-level hosted drift/parity evidence.
- [ ] Rehearse the first batch on a disposable restored copy.
- [ ] Seek explicit owner authorisation for the first production-changing operation.

## Authority boundary

This file is an execution record, not promotion authority. Production remains at contract 63 until a separate, explicit owner instruction authorises a named batch against a named commit and verified fresh recovery evidence. Contracts 126–131 remain repository-only until Development hosts and verifies them.
