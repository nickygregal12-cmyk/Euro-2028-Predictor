# Audit-control cleanup

**Date:** 24 July 2026  
**Issue:** #46  
**Pull request:** #47  
**Branch:** `agent/repair-audit-controls`  
**Findings:** `TEST-002`, `TEST-003`, `DOC-001`, `DOC-006`  
**Status:** Closed on `main`

## Scope

This repository-only batch:

- records the post-merge closure boundary for the repaired database-parity trigger;
- makes the environment-file hygiene suite skip explicitly when no Git work tree exists while retaining real ignore-policy enforcement in normal checkouts;
- repairs stale entry-flow test-script references to the current integrity-gated project sequence;
- repairs relative links in archived quality evidence after those files moved into `docs/quality/history/`;
- adds permanent Markdown-link and obsolete-reference regression coverage;
- adds a CI execution from `git archive` to prove Git-less checkouts skip rather than fail;
- updates the live quality status and risk register conservatively while merge is pending.

It does not change migrations, hosted Supabase data or configuration, Netlify configuration, deployment-contract values, application behaviour, tournament rules or scoring.

## Implementation evidence

- PR #45 merged as `d9bba09543409067624223f6f3fc0a0c75152cc2`; its latest head passed CI run 188 and Database parity run 65 before merge.
- `.github/workflows/database-parity.yml` watches `scripts/database-rollout/**`, `config/deployment-contract.json` and its regression test.
- `tests/scripts/envFileHygiene.test.ts` detects whether Git work-tree semantics are available and names the skipped suite explicitly.
- `.github/workflows/ci.yml` runs the environment-file test from a `git archive` extraction with no `.git` directory.
- `docs/test-script.md` now uses current environment safety boundaries and finding IDs instead of superseded phase/batch names.
- both archived quality files now resolve moved links through `../audits/` and `../risk-register.md` without altering their finding/baseline contents.
- `tests/scripts/markdownDocumentation.test.ts` checks relative inline Markdown links repository-wide and prevents the obsolete entry-test terms from returning.

## Validation evidence

PR #47 permanent-file head `eab67c8f56579d038e1d1164ee1675082df2ed91` completed CI run 195 successfully:

1. dependency installation passed;
2. the Git-less `git archive` execution passed, reporting the environment-file suite as explicitly skipped rather than producing eight false failures;
3. build and lint passed;
4. the complete Vitest suite passed, including normal Git-checkout environment-file assertions, repository-wide relative Markdown-link validation and obsolete test-script reference checks;
5. the production-dependency audit passed.

The temporary reconciliation helpers used while preparing the branch were removed and are not part of the permanent PR scope.

## Post-merge closure evidence

- PR #47 merged into `main` as `fd5b8c4c936812ea772dad3c2ec7bfad58b01cf8`.
- The final clean PR head `fd0fc31f4e0038e89b0d286927554de897e6d04f` passed CI run 200, including the Git-less archive proof, build, lint, complete test suite, repository-wide Markdown-link checks and dependency audit.
- GitHub automatically closed issue #46 as completed at merge.
- `DOC-001`, `TEST-003` and `DOC-006` are therefore resolved at the repository layer.
- `TEST-002` and `DOC-004` remain resolved.
- The connected GitHub workflow-run endpoint did not expose a separate push-triggered run for the squash merge commit; this note does not claim an unseen `main` run.

No production, Supabase, Netlify, migration, deployment-contract, scoring or application-runtime change occurred in this closure batch.
