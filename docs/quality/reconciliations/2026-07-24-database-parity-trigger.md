# Database-parity workflow trigger repair

**Date:** 24 July 2026  
**Finding:** `TEST-002`  
**Issue:** #44  
**Branch:** `agent/fix-database-parity-trigger`  
**Status:** Implementation prepared; pull-request workflow evidence pending

## Problem

The database-parity workflow watched `scripts/database-parity/**`, a directory that does not exist, while omitting the real `scripts/database-rollout/**` SQL directory. It also did not watch `config/deployment-contract.json`.

This meant changes to the production preflight, post-rollout verification, migration-history preparation or application/database contract could avoid the disposable database workflow.

## Repository repair

- replace the dead `scripts/database-parity/**` filter with `scripts/database-rollout/**`;
- add `config/deployment-contract.json` to the pull-request path contract;
- add `tests/scripts/databaseParityWorkflow.test.ts` to enforce the trigger paths and retain manual `workflow_dispatch` support;
- include the regression test itself in the workflow paths.

No migration, hosted database, Netlify setting, Supabase configuration or deployment-contract value is changed by this batch.

## Validation required before closure

1. application CI passes;
2. the new workflow-contract test passes;
3. the pull request causes the `Database parity` workflow to appear and complete successfully;
4. after merge, update `current-status.md` and `risk-register.md` with the merged commit and workflow evidence, then close issue #44.

Until those checks pass, `TEST-002` remains open.
