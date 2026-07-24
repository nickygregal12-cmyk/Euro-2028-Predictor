# Bracket-snapshot conflict browser E2E

**Date:** 24 July 2026  
**Issue:** #52  
**Pull request:** #55  
**Branch:** `agent/add-bracket-conflict-e2e`  
**Findings:** `TEST-001`, `REL-004`, `REL-007`  
**Status:** Repository/development browser evidence complete; production-dependent evidence remains open

## Purpose

Extend the authenticated Playwright launch gate across the compound knockout-bracket boundary. A bracket edit is not one independent row: changing an early winner can invalidate several downstream winners, and the client persists the resulting tree through the atomic `replace_predicted_progression` snapshot RPC.

This reconciliation proves that two stale devices cannot silently blend different bracket generations, and that server submission cannot overtake an unsettled bracket snapshot.

## Environment and isolation boundary

The existing Browser E2E workflow continues to:

1. start disposable local Supabase on standard HTTP loopback port `54321`;
2. rebuild every committed migration and the repository seed;
3. export local-only browser environment values;
4. run the Vite application and real Supabase sessions in Chromium;
5. upload Playwright traces, screenshots, video and HTML reports;
6. destroy local data without backup.

This batch creates a dedicated `bracket-e2e@euro28.local` account through the strictly guarded local service-role client. It does not reuse the account mutated by the score/submission journey. Both simulated devices sign out of development auto-login and authenticate through the real login form.

The deterministic fixture prepares all 36 group predictions, producing settled group and best-third ordering. The browser then selects all 15 knockout winners through the production UI.

## Browser evidence

### 1. Early-round replacement is one complete atomic snapshot

Device B loads the same complete bracket as device A. The test identifies an R16 winner that is also selected to win its QF, replaces that R16 winner and confirms the real cascade warning.

The application clears the dependent QF, SF and Final choices, the browser rebuilds every now-unresolved tie, and `replace_predicted_progression` persists the resulting complete tree. This exercises the dangerous multi-row replacement case rather than a leaf-only edit.

### 2. Stale device is blocked and can choose Load latest

Device A retains its original complete bracket and changes only the Final winner. Because device B advanced the stored row versions, the atomic replacement reaches the real PT409 optimistic-concurrency boundary.

The browser proves:

- the warning **These picks were changed on another device** is visible;
- Review cannot submit while the bracket key is conflicted;
- no `submit_entry` request is sent;
- choosing **Load latest** fetches the authoritative progression snapshot;
- every round then exactly matches device B's complete snapshot.

Local edits are discarded only after the explicit recovery choice.

### 3. Keep mine reapplies one complete local tree

Device B performs a second advancing-R16 replacement and saves a newer authoritative tree. Device A makes another stale complete-bracket edit and reaches PT409 again.

This time the browser chooses **Keep mine**. The provider reloads every current progression version and reissues device A's entire desired tree through one atomic replacement. The test reloads both browser contexts and compares all selected R16, QF, SF and Final winners exactly.

Both devices show the same complete local-mine snapshot. There is no mixture of old R16 rows with newer downstream rows, and no stale-device deletion can silently remove a newer pick.

### 4. Submission waits for the atomic bracket replacement

The final scenario intercepts and deliberately holds `replace_predicted_progression` after a complete Final edit. The user navigates to Review and confirms submission while that snapshot is still in flight.

The browser proves:

- `submit_entry` is not requested while the bracket write is held;
- releasing the request allows the atomic snapshot to succeed first;
- `submit_entry` then succeeds exactly once;
- the UI reports **Entry submitted**.

The server validator therefore cannot observe the entry before the user's latest bracket generation settles.

## Validation evidence

Implementation head `8af8e45686537dadc3afdb4fa68e61676b3007a4` passed:

- **CI run 250:** dependency installation, Git-less environment proof, build, lint, complete Vitest suite, E2E fixture safety checks and production dependency audit;
- **Browser E2E run 23:** Chromium installation, disposable Supabase startup, full migration and seed rebuild, local environment export, existing authenticated journeys, the complete two-device bracket conflict/recovery lifecycle, diagnostics upload and no-backup cleanup.

## Finding impact

- `TEST-001`: materially improved with executable authenticated browser assurance for the compound bracket boundary.
- `REL-004`: repository/development atomic snapshot behavior now has real browser evidence, including the submission barrier. Production remains open until the compatible backend is rolled out and verified.
- `REL-007`: repository/development multi-device behavior now proves a stale client cannot silently delete or blend newer bracket picks; production remains open until rollout and hosted verification.

Issue #52 remains open for locked-state rejection, invitation/authentication recovery and administrator journeys.

## Safety boundary

No production, shared-development or legacy Supabase credential is used. This batch changes no migration, repository seed, scoring rule, deployment-contract value, Netlify setting, hosted database or production data.
