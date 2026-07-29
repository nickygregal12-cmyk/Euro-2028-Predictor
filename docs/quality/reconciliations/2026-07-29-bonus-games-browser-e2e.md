# Bonus Games browser E2E reconciliation

**Date:** 29 July 2026  
**Audit finding:** `TEST-GAP-01`  
**Implementation PR:** #187  
**Implementation merge:** `9fcbcc7b4d932969708da887b6f0d9f73d57f21f`  
**Database contract:** unchanged at 60

## Finding

The 29 July full website/repository audit correctly identified that the production-hosted Bonus Games programme had strong unit and pgTAP coverage but no end-to-end browser lifecycle proof. Existing Playwright covered authentication, the Original Predictor, administration, leagues, profiles, Match Centre and accessibility, while KO Predictor, Last Man Standing and Predictor Cup were absent as interactive browser journeys.

## Implementation

PR #187 added a disposable-local Browser E2E harness that:

- rebuilds all 60 canonical migrations and the normal seed;
- executes `scripts/bonus-games/publish-catalogue.sql` inside the local PostgreSQL container;
- applies `e2e/bonus-games-fixture.sql` to open only the disposable registration/round windows and assign one future knockout kickoff;
- runs the normal authenticated application suite on desktop and phone;
- removes the disposable database without backup after the run.

The new journeys prove:

1. **KO Predictor:** voluntary registration, shared knockout scoreline save, saved-state feedback, zero-point standings membership, cleanup and withdrawal.
2. **Last Man Standing:** voluntary registration, first-round availability, one team selection, persisted picked state and withdrawal.
3. **Predictor Cup:** voluntary registration, shared knockout prediction, navigation to the Cup and the one-entrant waiting-for-draw state, followed by cleanup and withdrawal.

Workflow guard tests assert that all three test titles/routes, the local-only fixture step and the catalogue shape check remain present.

## Catalogue script repair

The release audit also exposed a repository/source mismatch. The committed repeatable catalogue script still used PostgreSQL's reserved `window` keyword as a table alias. Production publication had succeeded only after the statement was manually rerun with a safe alias.

PR #187 replaced the reserved alias with `competition_window` in both fixture publication and the final 3/14/102 validation queries. The corrected committed script then executed successfully from a clean local contract-60 rebuild before Playwright started.

This was an operational-script repair only. No migration, application contract or hosted database write was introduced.

## Validation

Exact final head `26badfd5e1ef47f9bd222ab40d1004aa170a9288` passed:

- **CI run `30442005168`:** build, lint, complete Vitest suite and production dependency audit;
- **Browser E2E run `30442002202`:** clean 60-migration rebuild, corrected catalogue publication, authenticated desktop/phone journeys, signup/password recovery and disposable cleanup;
- **deploy-preview smoke:** exact-head HTTP and Chromium smoke.

The first Browser E2E attempt (`30441134883`) passed KO Predictor and Last Man Standing but failed the Cup assertion because the reusable empty-state component exposes “Waiting for the draw” as text rather than a heading, and the live copy reads “The field (1 so far).” The test was corrected to match the real accessible page. No product or database defect was found, and the complete rerun passed.

## Safety evidence

- no hosted Supabase project reference appears in the authenticated test harness;
- fixture SQL runs only against the fixed loopback Supabase container;
- production Bonus Games registration remains closed;
- production entrants, predictions, Cup structures, score events and results were not touched;
- repository and hosted schema contracts remain at 60.

## Closure verdict

`TEST-GAP-01` is resolved. All three delivered Bonus Games now have database-rule proof, unit coverage, authenticated desktop/phone lifecycle coverage and exact deploy-preview smoke protection.

Remaining adjacent assurance work is separate:

- `TEST-GAP-02`: behavioural pgTAP for H2H rank-history capture;
- `RESULT-AUDIT-01`: direct assertions over result-revision before/after content;
- manual assistive-technology review;
- complete-volume dress rehearsal and rollback rehearsal.
