# Authenticated browser E2E foundation

**Date:** 24 July 2026  
**Issue:** #52  
**Branch:** `agent/add-authenticated-browser-e2e`  
**Findings:** `TEST-001`, `DATA-005`  
**Status:** Repository implementation prepared; pull-request validation pending

## Purpose

Add the first real authenticated browser gate without using production or the shared development Supabase project.

## Test environment

The dedicated GitHub Actions workflow:

1. starts disposable local Supabase;
2. rebuilds all committed migrations and seed data;
3. creates a deterministic local-only user through the Admin API;
4. starts the Vite application with the existing development auto-login path;
5. runs Playwright Chromium sequentially at desktop and phone widths;
6. uploads traces, screenshots, video and the HTML report when available;
7. destroys the local database without backup.

The global setup rejects every non-local Supabase hostname. Executable workflow tests also prohibit production, shared-development and legacy project references.

## First journeys

- authenticated Home, Predict, Matches and Profile access at desktop and phone widths;
- real group-score save through the browser;
- reload persistence proof;
- version-safe score clearing through `delete_match_prediction`;
- second reload proving the deleted prediction does not return.

## Evidence boundary

This is meaningful repository/development browser evidence for `DATA-005` and materially improves `TEST-001`. It does not close either production-dependent finding. Production migrations 21–35, compatible hosted application/database state and authenticated hosted smoke evidence remain separately required.

Later browser batches should cover immediate-final-edit submission, save failure/conflict behavior, bracket snapshot conflicts, locked-state rejection, invite/auth recovery and administrator journeys.

## Safety boundary

No production or shared-development credentials are used. No Supabase, Netlify, migration, deployment-contract, scoring or production-data changes are made by this batch.
