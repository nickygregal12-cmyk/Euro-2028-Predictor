# Authenticated browser E2E foundation

**Date:** 24 July 2026  
**Issue:** #52  
**Pull request:** #53  
**Branch:** `agent/add-authenticated-browser-e2e`  
**Findings:** `TEST-001`, `DATA-005`  
**Status:** Pull-request validation passed; `main` merge pending

## Purpose

Add the first real authenticated browser gate without using production or the shared development Supabase project.

## Test environment

The dedicated GitHub Actions workflow:

1. starts disposable local Supabase;
2. rebuilds all committed migrations and seed data;
3. configures a future tournament lock only inside that disposable database;
4. creates a deterministic local-only user through the Admin API;
5. starts the Vite application with the development auto-login path;
6. runs Playwright Chromium sequentially at desktop and phone widths;
7. uploads traces, screenshots, video and the HTML report;
8. destroys the local database without backup.

The global setup accepts only the standard HTTP loopback Supabase API on port 54321. Executable workflow tests also prohibit production, shared-development and legacy project references.

## First journeys

- authenticated Home, Predict, Matches and Profile access at desktop and phone widths;
- real group-score save through the browser and successful PostgREST response;
- reload persistence proof;
- version-safe score clearing through `delete_match_prediction`;
- second reload proving the deleted prediction does not return.

## Defects exposed and repaired

The browser gate found two development-only integration defects that lower-level tests did not expose:

1. React Strict Mode's effect cleanup disposed the retained save controller, while the subsequent entry reset left it inert. `SaveController.reset()` now begins a fresh usable lifecycle, and regression tests prove reset-after-dispose saves while terminal dispose remains inert.
2. The development auto-login policy allowed only the shared development project. It now also allows the standard local Supabase endpoint in Vite development mode, while production builds, HTTPS loopback, wrong ports, arbitrary hosts and production Supabase remain fail-closed.

The provisional seed intentionally has no tournament lock. Browser setup assigns a future lock only in the disposable database so hardened write/delete functions can be exercised without changing committed seed or hosted data.

## Validation evidence

Final implementation head before this evidence-only update passed:

- CI run 237: dependency installation, Git-less environment proof, build, lint, complete Vitest suite and production-dependency audit;
- Browser E2E run 12: Chromium installation, local Supabase startup, all 35 migrations and seed rebuild, local environment export, authenticated desktop/mobile tests, score save/reload/delete/reload journey, diagnostics upload and no-backup cleanup.

## Evidence boundary

This is meaningful repository/development browser evidence for `DATA-005` and materially improves `TEST-001`. It does not close either production-dependent finding. Production migrations 21–35, compatible hosted application/database state and authenticated hosted smoke evidence remain separately required.

Later browser batches should cover immediate-final-edit submission, save failure/conflict behavior, bracket snapshot conflicts, locked-state rejection, invite/auth recovery and administrator journeys.

## Safety boundary

No production or shared-development credentials are used. No Supabase, Netlify, migration, deployment-contract, scoring or production-data changes are made by this batch.
