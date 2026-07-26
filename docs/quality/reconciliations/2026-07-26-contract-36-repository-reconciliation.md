# Contract 36 repository reconciliation

**Date:** 26 July 2026  
**Scope:** Repository authority and hosted-environment naming only  
**Branch:** `agent/reconcile-contract-36`

## Trigger

PR #76 merged migration `20260725010000_authoritative_reference_integrity.sql` and changed the repository deployment contract from 35 to 36.

Several live authority documents still described migration 36 as draft, outside `main` and unapplied. Those statements became stale when PR #76 merged.

## Environment terminology

The Supabase project historically called `production` is the intended final-target database. It is not supporting a live Euro 2028 tournament. Euro 2028 remains approximately two years away.

The repository will continue to retain the existing environment identifiers where required by Netlify, Supabase and scripts, but documentation should distinguish:

- **repository contract** — the migration and application contract represented by current `main`;
- **development hosted environment** — development Supabase and non-production Netlify contexts;
- **final-target hosted environment** — the Supabase and Netlify context historically named `production`;
- **live tournament production** — not yet applicable.

This terminology correction does not remove safety controls. The final-target environment still contains retained test/owner data and must not be modified casually.

## Verified repository facts

- PR #76 is merged.
- Migration 36 is present on `main` as `supabase/migrations/20260725010000_authoritative_reference_integrity.sql`.
- `config/deployment-contract.json` was changed by PR #76 to contract 36.
- Migration 36 adds authoritative tournament/reference integrity protections.
- The migration was accompanied by database test changes and deployment-contract guard coverage.
- PRs #95–#100 subsequently added and completed Match Centre v1 contract, lifecycle, navigation and browser coverage.
- PR #93 completed the supported Sentry SDK and deploy-preview verification foundation while keeping final-target reporting separately controlled.

## Hosted environment boundary

The last verified evidence for both hosted Supabase projects is contract 35.

This reconciliation does not claim either hosted database is contract 36. It also does not apply migration 36.

Required next evidence:

1. read-only migration-history and schema-effect inspection for development Supabase;
2. migration-36 precondition checks against development data;
3. exact one-migration dry run where development remains at 35;
4. controlled development upgrade and verification;
5. deploy-preview release identity and browser smoke at contract 36;
6. separate final-target upgrade decision and evidence.

Because the final-target environment is not live tournament production, its upgrade can be scheduled as controlled pre-launch engineering work rather than an emergency production change. It must still use backup, preflight, verification and rollback discipline.

## DATA-003 classification

Issue #72 should no longer state that migration 36 is merely proposed or outside authority.

The issue must be re-evaluated against the actual merged migration and its constraint inventory. It should close only if every acceptance criterion is now covered. Any remaining relationship should be recorded precisely rather than retaining the previous broad wording.

## Changes started in this branch

- corrected README repository/hosted-environment contract wording;
- added this reconciliation record;
- next: reconcile `docs/quality/current-status.md`, `docs/build-todo.md`, `docs/ops-pending-migrations.md`, the risk register and issue #72;
- next: record disposable CI/database evidence from the branch PR;
- next: inspect development Supabase read-only before any hosted write.

## Safety boundary

This reconciliation stage changes repository documentation only.

It does not:

- apply a migration to development Supabase;
- apply a migration to the final-target Supabase environment;
- change Supabase data, Auth settings, RLS or grants;
- change Netlify environment variables or deploy contexts;
- enable final-target Sentry delivery;
- change scoring, tournament rules or prediction data;
- claim tournament-launch readiness.
