# Feature-baseline identifier restoration

**Date:** 24 July 2026  
**Issue:** #49  
**Pull request:** #50  
**Branch:** `agent/restore-feature-baseline-ids`  
**Finding:** `DOC-005`  
**Status:** Pull-request validation complete; `main` closure pending

## Problem verified

The archived baseline contains exactly 96 stable identifiers:

- `FEAT-001`–`FEAT-044`;
- `PLAN-001`–`PLAN-008`;
- `SAFE-001`–`SAFE-044`.

The compact live baseline removed its ID column and did not record which archived entries were consolidated, preserved outside the compact tables or superseded by stronger post-audit controls. That made repeat-audit comparison non-deterministic even though the 24 July repeat audit detected no feature or safeguard regression.

The compact tables contain 59 current data rows. The earlier narrative described the rewrite as 60 rows; this repair uses an executable row count and does not treat the narrative count as feature-loss evidence.

## Traceability model

The repaired live baseline uses three controls:

1. every compact current row has one unique primary stable ID;
2. every archived ID appears in an explicit continuity/disposition register and remains permanently reserved;
3. post-archive capabilities and safeguards receive new IDs beginning at `FEAT-045` and `SAFE-045`.

Consolidation does not retire an ID. If the same capability, safeguard or root cause returns, the original archived ID remains the comparison key.

## New identifiers

Six post-archive capability IDs are introduced:

- `FEAT-045`–`FEAT-050`.

Eleven post-archive safeguard IDs are introduced:

- `SAFE-045`–`SAFE-055`.

No archived identifier is reused for a materially different concept.

## Current-authority reconciliation

The repair preserves the compact classifications except where a higher-authority current control already supersedes stale wording:

- `SAFE-013` now records the verified current Netlify preview/branch/development isolation; the unrelated legacy public site remains tracked separately by `OPS-008`;
- `SAFE-054` records the implemented application/schema deployment-contract gate that contains repository contract 35 against production contract 20.

These are documentation reconciliations of already implemented controls, not runtime changes.

## Executable control

`tests/scripts/markdownDocumentation.test.ts` now verifies:

- the archived file contains the exact expected 96-ID set;
- every archived ID appears in the live baseline;
- every compact table data row begins with a stable ID;
- the 59 current primary IDs are unique;
- the continuity and new-identifier registers remain present;
- new IDs do not reuse archived IDs;
- the obsolete open traceability notice cannot return.

## Validation evidence

PR #50 implementation head `6ece7ee0a6a7406274fbe1b069a3d923074330d5` passed CI run 211, documented head `9ed0a051952c1eb9c8d755350db2e08d9f427a3e` passed CI run 212, and the final review head `589e67e754bc740458f623fa87f4740a7cf8ea7d` passed CI run 213:

1. dependency installation passed;
2. the Git-less environment-hygiene proof passed;
3. build and lint passed;
4. the complete test suite passed, including the new identifier-continuity assertions and repository-wide Markdown-link checks;
5. the production-dependency audit passed.

## Safety boundary

This batch changes documentation and documentation-control tests only. It does not change application code, scoring, migrations, Supabase data or configuration, Netlify settings, deployment-contract values or production data.

## Closure boundary

Until the pull request is merged, `DOC-005` remains open because an unmerged branch is not the live quality authority.

After merge:

1. confirm the exact `main` merge commit and green final-head CI;
2. mark `DOC-005` resolved in `current-status.md` and `risk-register.md`;
3. update the risk totals;
4. close issue #49.
