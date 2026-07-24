# Submission-barrier browser E2E

**Date:** 24 July 2026  
**Issue:** #52  
**Pull request:** #54  
**Branch:** `agent/add-submission-barrier-e2e`  
**Findings:** `TEST-001`, `DATA-005`  
**Status:** Repository/development evidence complete; production-dependent evidence remains open

## Purpose

Extend the authenticated Playwright gate from basic persistence into the critical submission boundary: the server validator must never observe an entry before the user's latest saves have reached a terminal state.

## Environment and fixture boundary

The existing dedicated workflow continues to:

1. start disposable local Supabase;
2. rebuild every committed migration and the repository seed;
3. create the deterministic local authenticated user;
4. run the Vite application through the real development auto-login path;
5. run desktop and phone-width Chromium projects;
6. upload diagnostics;
7. destroy local data without backup.

The new fixture helper refuses every URL except standard HTTP loopback Supabase (`127.0.0.1` or `localhost`, port `54321`). It fills the existing unsubmitted E2E entry with deterministic predictions for all 36 group matches. The score pattern produces settled group and best-third ordering without manual tie decisions. It does not use privileged table deletion to reset protected prediction rows.

## Browser evidence

The desktop browser completes all 15 knockout winner selections through the real bracket UI, then proves one ordered submission lifecycle:

1. **Retry exhaustion blocks submission**
   - the final score write is forced to return HTTP 503;
   - the save coordinator performs the initial attempt plus its two bounded automatic retries;
   - Review waits for the terminal error;
   - the UI reports that changes could not be saved;
   - no `submit_entry` request is sent.

2. **Manual retry recovers the retained edit**
   - the forced failure route is removed;
   - the visible match-card retry control reissues the retained local value;
   - the real Supabase write succeeds.

3. **Optimistic-concurrency conflict blocks submission**
   - the local service-role fixture advances the stored prediction version to simulate another device;
   - the browser's stale write receives the real PT409 conflict boundary;
   - Review reports that the conflict must be resolved;
   - no `submit_entry` request is sent;
   - choosing **Keep mine** reloads versions and successfully reissues the user's local value.

4. **A final in-flight edit delays server validation**
   - the last score request is deliberately held in flight;
   - the user navigates to Review and confirms submission;
   - no `submit_entry` request is sent while that score request remains held;
   - after release, the score write succeeds first;
   - `submit_entry` then succeeds exactly once and the UI shows **Entry submitted**.

The existing desktop/mobile authenticated route smoke and save/reload/protected-delete/reload journey remain part of the same workflow.

## Validation evidence

Head `16160e3b5d97bfaf483252665bf2c593779b6905` passed:

- **CI run 244:** dependency installation, Git-less environment proof, build, lint, complete Vitest suite and production dependency audit;
- **Browser E2E run 18, successful rerun job `89505678399`:** Chromium installation, disposable Supabase startup, full migration/seed rebuild, local environment export, all authenticated browser journeys, diagnostics upload and no-backup cleanup.

The first run-18 job failed during `supabase db reset --local` before environment export or browser execution. The same immutable head was rerun on a fresh runner; the full migration chain and browser suite then passed. No repository change was made for that isolated infrastructure failure.

## Evidence boundary

This materially improves `TEST-001` and strengthens repository/development evidence for `DATA-005`. It does not prove hosted production compatibility or close production-dependent findings.

Issue #52 remains open for later browser batches covering bracket snapshot conflicts, locked-state rejection, invitation and authentication recovery, and administrator journeys.

## Safety boundary

No production, shared-development or legacy Supabase credential is used. This batch changes no migration, repository seed, scoring rule, deployment-contract value, Netlify setting, hosted database or production data.
