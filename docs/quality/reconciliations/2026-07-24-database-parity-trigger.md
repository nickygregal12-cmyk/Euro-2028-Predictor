# Database-parity workflow trigger repair

**Date:** 24 July 2026  
**Finding:** `TEST-002`  
**Issue:** #44  
**Pull request:** #45  
**Branch:** `agent/fix-database-parity-trigger`  
**Status:** Repository implementation and pull-request validation complete; merge/current-status closure pending

## Problem

The database-parity workflow watched `scripts/database-parity/**`, a directory that does not exist, while omitting the real `scripts/database-rollout/**` SQL directory. It also did not watch `config/deployment-contract.json`.

This meant changes to the production preflight, post-rollout verification, migration-history preparation or application/database contract could avoid the disposable database workflow.

## Repository repair

- replaced the dead `scripts/database-parity/**` filter with `scripts/database-rollout/**`;
- added `config/deployment-contract.json` to the pull-request path contract;
- added `tests/scripts/databaseParityWorkflow.test.ts` to enforce the trigger paths and retain manual `workflow_dispatch` support;
- included the regression test itself in the workflow paths.

No migration, hosted database, Netlify setting, Supabase configuration or deployment-contract value changed in this batch.

## Pull-request validation

PR #45 at head commit `1e7c6f42aa849d120d4e83904ee49a1f2e0d1ec6` produced both required workflows:

- `CI` run 187 — passed;
- `Database parity` run 64 — passed;
- disposable Supabase started successfully;
- all committed migrations rebuilt successfully;
- database lint passed;
- pgTAP passed;
- TypeScript/PostgreSQL differential parity passed;
- disposable local data cleanup completed successfully.

The appearance and successful completion of `Database parity` on this PR proves the corrected trigger contract is active for the workflow file/test scope changed here.

## Remaining closure work

After merge:

1. update `current-status.md` and `risk-register.md` with the merged commit and workflow evidence;
2. confirm the merged `main` checks remain green;
3. close issue #44 and mark `TEST-002` resolved.

Until those post-merge records exist, `TEST-002` remains open rather than overstating repository validation as full closure.
