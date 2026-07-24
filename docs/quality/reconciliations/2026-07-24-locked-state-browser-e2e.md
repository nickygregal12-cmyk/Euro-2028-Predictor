# Locked-state rejection browser E2E

**Date:** 24 July 2026  
**Issue:** #52  
**Pull request:** #56  
**Branch:** `agent/add-locked-state-e2e`  
**Findings:** `TEST-001`, `DATA-005`, `REL-004`  
**Status:** Repository/development browser evidence complete; production-dependent evidence remains open

## Purpose

Extend the authenticated Playwright launch gate across the tournament lock boundary. Client controls are helpful, but the database must remain authoritative when a page loaded before kickoff becomes stale and attempts to write after the lock.

This reconciliation proves that every current Original Predictor mutation surface fails closed at the server after lock, while the entry remains safely readable.

## Environment and isolation boundary

The Browser E2E workflow continues to:

1. start disposable local Supabase on standard HTTP loopback port `54321`;
2. rebuild every committed migration and the repository seed;
3. export local-only browser environment values;
4. run the Vite application and real Supabase sessions in Chromium;
5. upload Playwright traces, screenshots, video and HTML reports;
6. destroy local data without backup.

This batch creates a dedicated `locked-e2e@euro28.local` account through the strictly guarded local service-role client. The deterministic fixture prepares all 36 group predictions before lock, inserts two local-only squad players and completes all 15 bracket picks through the real UI.

Five independent authenticated browser pages load while the tournament still has its future lock. The guarded fixture then moves only the disposable tournament's `lock_at` into the past. This deliberately leaves the open pages with stale pre-lock UI state, forcing each attempted mutation to reach the authoritative database boundary rather than being stopped only by newly rendered controls.

The original future lock is restored in `finally`, even if an assertion fails.

## Browser evidence

### 1. Score update fails closed

A pre-lock Group A page changes a complete saved score after `lock_at` has moved into the past. The browser sends the ordinary `match_predictions` upsert.

The server rejects the request with **Predictions are locked — the tournament has started**, and the match card exposes its visible retry state. The optimistic local edit does not replace the stored score.

### 2. Protected score deletion fails closed

A second pre-lock Group A page clears one side of the same saved score. The client calls the version-safe `delete_match_prediction` RPC.

The RPC rejects after lock with the same authoritative lock message, and the UI exposes the failed-save retry control. This supplies authenticated browser evidence that a stale device cannot clear a newer or existing persisted prediction after kickoff.

### 3. Atomic bracket replacement fails closed

A pre-lock bracket page changes the Final winner. The client sends one complete `replace_predicted_progression` snapshot.

The RPC rejects the whole transaction after lock and the bracket displays **Save failed**. No partial replacement is committed, preserving the original complete R16, QF, SF and Final tree.

### 4. Golden Boot insertion fails closed

A pre-lock Review page searches for and selects a local-only seeded player after the lock transition. The client sends the `bonus_predictions` upsert.

The database rejects the write with the tournament-lock message and the UI displays **Golden Boot pick not saved** with its retry action. Bonus entry state therefore cannot bypass the same lock boundary.

### 5. Entry submission fails closed

A separate pre-lock Review page confirms submission after the lock transition. The browser proves that `submit_entry` is requested exactly once and rejected by its explicit lock check with **Entry submission is closed — the tournament has started**.

The UI displays **Couldn't submit**. Submission does not rely on a stale client-side lock calculation.

### 6. Saved entry remains readable after lock

A fresh authenticated browser context opens after the tournament is locked. It proves:

- the group predictor renders the locked/read-only state rather than editable score controls;
- the original home and away scores remain visible;
- the complete bracket exactly matches the pre-lock snapshot across R16, QF, SF and Final;
- Review displays **Predictions are locked — the tournament has started**.

The five rejected optimistic mutations therefore leave the authoritative entry unchanged and readable.

## Validation evidence

Implementation head `30ef3b41abe21e486f701030c9fbfc595cb1bece` passed:

- **CI run 254:** dependency installation, Git-less environment proof, build, lint, complete Vitest suite, locked-state fixture safety checks and production dependency audit;
- **Browser E2E run 26:** Chromium installation, disposable Supabase startup, full migration and seed rebuild, local environment export, all existing authenticated journeys, five post-lock server rejections, fresh read-only verification, diagnostics upload, future-lock restoration and no-backup cleanup.

## Finding impact

- `TEST-001`: materially improved with executable authenticated browser assurance for the complete tournament-lock boundary.
- `DATA-005`: repository/development protected score deletion now has authenticated post-lock rejection and post-reload readability evidence. Production remains open until migrations 21–35 are rolled out and hosted verification passes.
- `REL-004`: repository/development atomic bracket replacement now has authenticated post-lock rejection evidence in addition to conflict and submission-order assurance. Production remains open until compatible backend rollout and hosted verification.

Issue #52 remains open for invitation/authentication recovery and administrator journeys.

## Safety boundary

No production, shared-development or legacy Supabase credential is used. This batch changes no migration, repository seed, scoring rule, deployment-contract value, Netlify setting, hosted database or production data.
